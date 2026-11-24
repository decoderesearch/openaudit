"""Flags an eval's attempts again with the flaggers and the current flag prompt, for the runs that
the cards use. Builds no card: a card uses the snippets of this prompt only, so build it when all
of its evals have them.

    uv run python scripts/reflag_eval.py fortress            # counts, and a cost estimate
    uv run python scripts/reflag_eval.py fortress --apply    # check and save
    uv run python scripts/reflag_eval.py all                 # all evals
    uv run python scripts/reflag_eval.py abstentionbench --link --apply
    uv run python scripts/reflag_eval.py abstentionbench --link --replace --apply

The estimate checks a few attempts of each eval and saves nothing. `--link`: flags the runs of
each model's published card version, and adds the new snippets to that version (feeds and flag
counts show them), with no card build. The card's text stays the same. `--replace`: also checks
the attempts that have a check with this prompt, and puts the new snippets in place of the old
ones in each card version.
"""

import argparse
import asyncio
import random
from collections import defaultdict
from typing import Any

from openaudit_runner import cards
from openaudit_runner.env import load_env
from openaudit_runner.redact import redact_runs
from openaudit_runner.store import Bucket, Db, open_bucket

PUBLISHED = """SELECT v.id FROM openaudit_card_version v JOIN openaudit_card c ON c.id = v."cardId"
  WHERE c."modelId" = %s AND v.status = 'published' AND v."reviewedAt" IS NOT NULL
  ORDER BY v.number DESC LIMIT 1"""
PUBLISHED_RUNS = (
    cards.RUNS_SQL
    + """ AND r.id IN (SELECT "runId" FROM openaudit_card_run WHERE "versionId" = %s)"""
)


def todo(
    db: Db, slug: str, link: bool = False, recheck: bool = False
) -> list[tuple[dict[str, Any], list[str], list[dict[str, Any]], list[tuple]]]:
    """Each carded model with its flaggers, its runs of the eval, and their candidates. `link`:
    the runs of its published card version (in `model["version"]`), not the next card's runs.
    `recheck`: the candidates include the checked attempts."""
    out = []
    for model in db.execute(
        """SELECT m.id, m.name, m."displayName" FROM model m
           WHERE EXISTS (SELECT 1 FROM openaudit_card c WHERE c."modelId" = m.id) ORDER BY m."displayName" """
    ).fetchall():
        if link:
            version = db.execute(PUBLISHED, (model["id"],)).fetchone()
            if not version:
                continue
            model["version"] = str(version["id"])
            found_runs = db.execute(PUBLISHED_RUNS, (model["id"], version["id"])).fetchall()
        else:
            found_runs = cards.select_runs(db, str(model["id"]))
        runs = [
            r
            for r in found_runs
            if slug in ("all", r["slug"])
            and r.get("evalStatus") not in cards.DATED_STATUSES
        ]
        if not runs:
            continue
        _, flaggers = cards.reviewers(model["name"])
        found = [
            (r, a, s) for r in runs for a, s in cards.candidates(db, r, flaggers[0], recheck)
        ]
        print(
            f"  {model['displayName']:32} {len(runs):3} runs {len(found):6} attempts",
            flush=True,
        )
        out.append((model, flaggers, runs, found))
    return out


async def estimate(work: list, per_eval: int) -> dict[str, tuple[int, float]]:
    """Each eval's count and mean cost of one check, from a few real checks. Saves nothing."""
    by_eval: dict[str, list] = defaultdict(list)
    for _, flaggers, _, found in work:
        for r, a, s in found:
            by_eval[r["slug"]].append((r, a, s, flaggers))
    bucket = open_bucket()
    gate = asyncio.Semaphore(16)
    async with cards.openrouter_client(16) as client:

        async def cost(run, a, signals, flaggers) -> float | None:
            async with gate:
                try:
                    _, usage, _ = await cards.flag_with_fallback(
                        client, bucket, run, a, signals, flaggers
                    )
                    return usage["costUsd"]
                except cards.CallFailed:
                    return None

        out = {}
        for slug, items in by_eval.items():
            picks = random.Random(0).sample(items, min(per_eval, len(items)))
            costs = [
                c
                for c in await asyncio.gather(*(cost(*p) for p in picks))
                if c is not None
            ]
            out[slug] = (len(items), sum(costs) / len(costs) if costs else 0.0)
    return out


def main() -> None:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("slug", help="The eval's slug, for example fortress, or all.")
    p.add_argument(
        "--apply", action="store_true", help="Check the attempts and save the results."
    )
    p.add_argument(
        "--sample", type=int, default=8, help="Checks of each eval in the estimate."
    )
    p.add_argument(
        "--link",
        action="store_true",
        help="Flag the published cards' runs, and add the snippets to those versions.",
    )
    p.add_argument(
        "--replace",
        action="store_true",
        help="With --link: check the checked attempts again, and replace their snippets in the cards.",
    )
    args = p.parse_args()
    if args.link and args.slug == "all":
        p.error("--link needs one eval.")
    if args.replace and not args.link:
        p.error("--replace needs --link.")
    load_env()
    with Db() as db:
        print(f"Prompt {cards.FLAG_PROMPT}. Attempts to check for {args.slug}:")
        work = todo(db, args.slug, args.link, args.replace)
        print(f"  Total: {sum(len(found) for *_, found in work)}")
        if not args.apply:
            total = 0.0
            means = asyncio.run(estimate(work, args.sample))
            for slug, (n, mean) in sorted(means.items()):
                total += n * mean
                print(f"  {slug:36} {n:6} x ${mean:.4f} = ${n * mean:.2f}")
            print(
                f"Estimated cost: ${total:.2f}. Nothing saved. Run with --apply to check and save."
            )
            return
        stats = defaultdict(float)
        for model, flaggers, runs, _ in work:
            print(f"{model['displayName']}:", flush=True)
            since = db.execute("SELECT now() AS t").fetchone()["t"]
            s = asyncio.run(
                cards.flag_runs(db, runs, flaggers=flaggers, recheck=args.replace)
            )
            for k in ("candidates", "flags", "blocked", "failed", "costUsd"):
                stats[k] += s[k]
            if args.replace:
                added, removed = replace(db, runs, flaggers, since)
                stats["replacedOld"] += removed
                stats["replacedNew"] += added
            if args.link:
                stats["linked"] += link(db, model["version"], runs, flaggers)
        print(f"Done: {dict(stats)}")
        if args.link:
            ids = [str(r["id"]) for *_, runs, _ in work for r in runs]
            print(f"Redacted logs: {redact_runs(db, Bucket(), ids)}", flush=True)


def link(
    db: Db, version_id: str, runs: list[dict[str, Any]], flaggers: list[str]
) -> int:
    """Adds the runs' snippets (`cards.snippets_for`) to the card version. Leaves out the attempts
    that have a snippet in the version already."""
    snippets = cards.snippets_for(db, [str(r["id"]) for r in runs], flaggers)

    def save(conn: Any) -> int:
        with conn.transaction(), conn.cursor() as cur:
            cur.executemany(
                """INSERT INTO openaudit_card_snippet ("versionId", "snippetId")
                   SELECT %s, %s WHERE NOT EXISTS (
                     SELECT 1 FROM openaudit_card_snippet j JOIN openaudit_snippet x ON x.id = j."snippetId"
                     WHERE j."versionId" = %s AND x."attemptId" = %s AND x.id <> %s)
                   ON CONFLICT DO NOTHING""",
                [(version_id, s["id"], version_id, s["attemptId"], s["id"]) for s in snippets],
            )
            return cur.rowcount

    n = db.call(save) if snippets else 0
    print(f"  Linked {n} of {len(snippets)} snippets to card version {version_id}.", flush=True)
    return n


def replace(
    db: Db, runs: list[dict[str, Any]], flaggers: list[str], since: Any
) -> tuple[int, int]:
    """For the attempts of `runs` that the flagger checked again since `since`: each card version
    that has an older snippet of a run gets the run's new snippets, and the older snippets go.
    Attempts with no new check keep theirs. Returns the new links and the old snippets deleted."""
    run_ids = [str(r["id"]) for r in runs]

    def save(conn: Any) -> tuple[int, int]:
        with conn.transaction(), conn.cursor() as cur:
            cur.execute(
                """CREATE TEMP TABLE old_snippet ON COMMIT DROP AS
                   SELECT s.id, s."runId" FROM openaudit_snippet s JOIN openaudit_flag_check c
                     ON c."attemptId" = s."attemptId" AND c.flagger = %s AND c."promptVersion" = s."promptVersion"
                   WHERE s."runId" = ANY(%s) AND s.flagger = ANY(%s) AND s."promptVersion" = %s
                     AND c."checkedAt" >= %s AND s."createdAt" < c."checkedAt" """,
                (flaggers[0], run_ids, flaggers, cards.FLAG_PROMPT, since),
            )
            cur.execute(
                """INSERT INTO openaudit_card_snippet ("versionId", "snippetId")
                   SELECT DISTINCT j."versionId", n.id FROM openaudit_card_snippet j
                   JOIN old_snippet o ON o.id = j."snippetId"
                   JOIN openaudit_snippet n ON n."runId" = o."runId" AND n."createdAt" >= %s
                     AND n.flagger = ANY(%s) AND n."promptVersion" = %s
                   ON CONFLICT DO NOTHING""",
                (since, flaggers, cards.FLAG_PROMPT),
            )
            added = cur.rowcount
            cur.execute("DELETE FROM openaudit_snippet WHERE id IN (SELECT id FROM old_snippet)")
            return added, cur.rowcount

    added, removed = db.call(save)
    print(f"  Replaced {removed} old snippets with {added} new links.", flush=True)
    return added, removed


if __name__ == "__main__":
    main()
