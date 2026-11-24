# Add a new model

This guide tells an agent how to add a newly released model to OpenAudit: the seed entry, its
documents (system card and release post), the database rows, the OpenAudit eval runs, the
OpenAudit Card and the Deploymeter panel. Follow
the steps in order. The system card has its own guide, `IMPORT_SYSTEM_CARD.md`; this guide says
when to use it.

The repo root is the folder of this file. Run commands from the repo root unless a step says
`apps/web`.

## Rules

- Do not push, and do not open a pull request. The remotes are public.
- Commit only when the user asks. Add files by explicit path: other agents work in this repo at the
  same time.
- Six steps change shared systems or cost money. Do them only when the user says so. Ask once, with
  the dry runs and the cost estimate:
  - `pnpm seed:import --apply` writes to the database.
  - `pnpm docs:mirror --apply` uploads to R2.
  - `scripts/queue-model-evals.ts --apply` starts paid eval runs on Cloudflare. `--resend` only
    sends runs that the user already approved.
  - The card import (step 6) writes to the database again.
  - The OpenAudit Card build (step 8) makes paid calls and writes a draft.
  - The Deploymeter panel (step 9) makes paid calls and writes a draft.
- Never reset a database. Never print secrets: filter `postgres://` out of any output you show.
- Do not re-serialize JSON files with a different formatter (see `IMPORT_SYSTEM_CARD.md`).

## 1. Find the release facts

Get these from the lab's release post, its API docs and its system card:

- The release date, the API model id (for example `claude-haiku-5-5`) and the family.
- The release post URL and the system card URL. Open each one and check the title and date. A
  card URL often redirects to a PDF; keep the publisher's URL in the seed.
- The OpenRouter id and its price, from `https://openrouter.ai/api/v1/models`. A new model is often
  on OpenRouter on its release day. If it is not, the runs wait (step 7).

## 2. Add the model and its documents to the seed

Edit `data/seed/system_cards.json`. Look at the newest model of the same lab, and copy its pattern.
Run `node spec/scripts/seed-lookup.mjs models "<name>"` to find it, and to check that the new model
is not there yet.

Add one entry at the end of `models`:

```json
{
  "id": "anthropic/claude-haiku-5.5",
  "source": "api",
  "displayName": "Claude Haiku 5.5",
  "organizationId": "anthropic",
  "family": "Claude 5.5",
  "releaseDate": "2026-10-07",
  "whyMajor": "Current small, fast Claude model",
  "documents": [
    "anthropic-claude-haiku-5-5-blog",
    "anthropic-claude-haiku-5-5-system_card"
  ],
  "checkpoints": [],
  "apiIds": ["claude-haiku-5-5"]
}
```

Add one entry at the end of `documents` for each document: the system card (`kind: system_card`)
and the release post (`kind: blog`). Field rules are in `IMPORT_SYSTEM_CARD.md`, step 1. For an
open-weights model (`source: hf`), also run `data/scripts/fetch-hf.mjs` (same guide, step 1).

Then check the link:

```sh
node spec/scripts/seed-lookup.mjs card <system card key>
```

## 3. Check the run route

```sh
cd apps/web
pnpm routes:check <model id>
```

It must print the same model on OpenRouter, from the lab itself or a licensed cloud. A wrong match
goes in `apps/web/lib/runs/route-overrides.json` (see `IMPORT_SYSTEM_CARD.md`, step 8). A full route
there can pin a provider whose weights are the lab's release precision (Kimi K2.5 is int4). Before
you pin a provider, send it one request with no `max_tokens` and one with `tools`: AtlasCloud
returns 400 when a request has no `max_tokens`.

When the first runs finish, check that the target wrote tokens (`eval_attempt.tokens`). Petri
does not fail when every target call fails: it scores the empty transcripts.

### A model with no route: our own vLLM server

When the check says "not on OpenRouter" or "no provider passes the rule", an open-weights model can
run on our own vLLM server, as `Qwen/Qwen3.6-27B` did. Do steps 1 to 6 as usual. Then do this in
place of step 7. Ask the user first: the pod and the judges cost money.

1. Estimate the cost. `queue-model-evals.ts` needs a route, so it cannot quote these runs. The
   judges cost about the same as for other models (most of the cost); the target costs only the
   pod hours. Get the hourly price from the RunPod MCP (`list-gpu-types`).
2. Make a new RunPod pod with the RunPod MCP. Never use an existing pod: those serve other work.
   Use the `vllm/vllm-openai` image, on a GPU that holds the weights and a KV cache (bf16: about
   2 GB for each billion parameters).
3. Start the server with the model's full context and prefix caching (multi-turn evals send the
   same conversation again). Get the tool-call parser, and for a thinking model the reasoning
   parser, from the model card:

   ```sh
   vllm serve <hf id> --max-model-len <context> --enable-prefix-caching \
     --enable-auto-tool-choice --tool-call-parser <parser>
   ```

   Expose `8000/tcp` and use the pod's direct IP and port: the RunPod HTTP proxy closes requests
   after about 100 s. Set `--api-key`. Do not set `max_tokens` above the free context: vLLM
   returns 400, and does not cut it.

   Test one chat and one tool call through the pod's URL before you queue runs.
   **Check the chat template for tools.** Some templates drop the `tools` field and `tool`
   messages (Olmo 3.1 Think tells the model it has no functions). Read the template. If it has
   no tool parts, write a patched copy in `apps/runner/chat_templates/` (the same format, from a
   sibling model's template) and serve it with `--chat-template`. Then send a tool request a few
   times. If `tool_calls` stays empty, the model cannot call tools: ask the user whether to skip
   AgentHarm, Petri and Petri-Bloom (Olmo 3.1 Think skips AgentHarm).
4. Queue each eval with the runner. Use the evals that `queue-model-evals.ts` lists for a recent
   model, with the same `--limit` as its dry run (the runner does not apply the web's default
   limits). `--reasoning` is only `none` or `on` (the chat template's `enable_thinking`):

   ```sh
   cd apps/runner
   uv run openaudit-runner enqueue --model <model id> --eval <slug> --direct vllm/<hf id> --reasoning none
   ```

   First queue one eval with `--limit 5 --visibility private`, as a test.
5. Run them on this machine. The Cloudflare containers do not have the server's URL, and nothing
   sends these runs to them. Use `--run` for each run, so that the runner takes no other runs:

   ```sh
   VLLM_BASE_URL=http://<ip>:<port>/v1 VLLM_API_KEY=<key> INSPECT_HTTP_REQUEST_TIMEOUT=7200 \
     uv run openaudit-runner work --run <run id> --exit-when-idle
   ```

   One worker does one shard at a time, so start several for each run. Inspect's default
   600 s timeout cuts long thinking calls. All runs on the server count against the cap
   `direct:vllm` (`--cap-key` gives a run its own cap, one for each pod). With no `runner_cap`
   row, there is no cap. Add a row with what the server holds (a database write: ask the user).
   Give long-context evals (BrokenMath, Petri) their own pod and small shards (`--shard-size`).
6. Stop the pod when the last run is done, then do step 8.

## 4. Start the system card extraction

Do steps 2 and 3 of `IMPORT_SYSTEM_CARD.md` (saved copy, extraction agent). The extraction agent
takes a long time on a long card, so start it now and do steps 5 and 7 while it works.

## 5. Import the model, and save the card (ask the user first)

```sh
cd apps/web
pnpm seed:import --only documents,models            # dry run
pnpm seed:import --only documents,models --apply    # writes; only with the user's OK
pnpm docs:mirror --only <system card key>           # dry run
pnpm docs:mirror --only <system card key> --apply   # uploads to R2; only with the user's OK
```

The dry run must show only the new rows: the model (`+ api:<model id>`) and its documents. A second
dry run after `--apply` must show no changes. The model needs its row before step 7 can queue runs.

## 6. Review and import the card results

Do steps 4 to 7 of `IMPORT_SYSTEM_CARD.md`: review the extraction, add missing evals and directions,
then import the `cards` part (dry run, then `--apply` with the user's OK). The model page then shows
"N System Card Evals".

## 7. Queue the OpenAudit evals (ask the user first)

A new model gets the same evals as the other models on the site: each recommended eval (status
`active`) that the runner can run. Legacy and saturated evals are never queued; the site and the
runner both refuse them. Evals that need raw reasoning are skipped for API models.

```sh
cd apps/web
pnpm exec node scripts/with-env.mjs tsx scripts/queue-model-evals.ts <model id>           # dry run
pnpm exec node scripts/with-env.mjs tsx scripts/queue-model-evals.ts <model id> --apply   # queues
```

The script does what a moderator's "Queue Run" on the model page does, for every missing eval at
once: the model's default thinking effort, the same checks and the same quote. The runs have no
owner, so no emails go out. The dry run prints each eval, its samples, its estimated cost and time,
and the total. Show the total to the user before `--apply`.

The runs do not all start at once. A run uses 4 containers (fewer only for an eval with a small
sample limit), and the Cloudflare Worker starts at most 20 containers. A run that cannot start
tries again up to 100 times, with waits from 30 s up to 10 minutes, and then the Worker drops its
message. The run then stays `queued` with no shards, and nothing starts it. So `--apply` puts all runs in the database, but sends only
the runs that fit in 16 containers. Send the rest when running runs finish:

```sh
pnpm exec node scripts/with-env.mjs tsx scripts/queue-model-evals.ts <model id> --resend
```

`--resend` sends the queued runs that have no shards yet, up to 16 containers
(`--containers N` changes this). Other models' runs also use containers, so send fewer when they
run. A sent run has no shards until its container starts, so `--resend` can send it again. This
does no harm: the containers have names from the run id, so a run never gets more than 4.

- The cost is mostly the judge models, not the target. Petri and FACTS Grounding cost the most.
- A run that fails at once with `LookupError: openaudit_runner/<task> was not found in the
  registry` means the runner image is older than the task. The web app sends runs to the staging
  Worker (queue `openaudit-runs-staging`). Ask the user before a deploy of a new image. Deploy
  from a clean worktree of a commit, not the working tree. Queue runs only when the container
  rollout is `completed`. A deploy does not stop running containers: a started run stays on the
  old image.
- New runs use only the model's default thinking effort (`OTHER_EFFORTS` in
  `apps/web/lib/runs/effort.ts`). For a model that thinks by default, that is thinking on.
- With no route (step 3), the script stops. Run it again when OpenRouter lists the model, or use
  our own vLLM server (step 3).
- A second `--apply` skips evals that are queued, running or done, and queues failed ones again.
  Use it to retry a failed run. A retry costs money, so ask the user first.

Follow the runs at `http://localhost:3300/admin/runs`, or on the model page.

## 8. Build the OpenAudit Card (ask the user first)

When all runs are done, build the model's card with the local runner. Nothing builds it on its
own: the cards container cannot write cards (the runner role has no grants), and production has
none. `/admin/sync` copies the card to production.

```sh
cd apps/runner
uv run python -m openaudit_runner.cards build --model <model id> --dry-run   # reads only
OPENAUDIT_URL= uv run python -m openaudit_runner.cards build --model <model id>
```

The dry run lists the runs it uses and the attempts the flagger will check. Show the count to the
user; the flaggers cost about $0.006 to $0.008 for each attempt, so a card costs about $1 to $10. The build writes the snippets, a summary of each withheld reply
(`openaudit_runner.summaries`, which also sets who can read it) and a draft version. Without
`OPENAUDIT_URL=`, it emails the admins through `apps/runner/.env`; send that email only when the
user says so. The aggregator is never from the model's own lab. The flaggers can be: a flag only
finds a case.

The build also labels each reply that the site hides at first (the eval's hazard labels and the
flagged snippets). The `reply_summarizer` models write a short summary, and label how much real help
the reply gives, its domain and if it is fiction. From these labels, the reply opens, or stays
hidden with the summary in its place. Chemical, biological, radiological and nuclear help stays
hidden; fiction about violence opens. The log line `Summaries: {...}` gives the counts in
`byHazard`. A reply with no summary stays hidden. To try the failed ones again:

```sh
uv run python -m openaudit_runner.summaries --dry-run   # counts only
uv run python -m openaudit_runner.summaries             # about $0.0006 for each reply
```

The user reviews the draft at `http://localhost:3300/<model id>?v=<version>`, and publishes or
discards it at `http://localhost:3300/admin/cards`. The public sees no card until then.

## 9. Run the Deploymeter panel (ask the user first)

The Deploymeter is a panel of AI judges (the `deploy_judge` role) that rates how much to trust the
model for wide public deployment. It reads an anonymous packet of the model's OpenAudit Card (the
published version, else the newest draft), so do it after step 8. Judges from the model's own lab
review too, but their scores do not count. The packet tells the judges if each eval was public
before the model's release; they give less weight to good results on those evals. A judge can
abstain when it cannot give a fair score; an abstention does not count.

```sh
cd apps/runner
uv run python -m openaudit_runner.deploymeter run --model <model id> --dry-run   # no paid calls
uv run python -m openaudit_runner.deploymeter run --model <model id>
```

The dry run prints the card version, the runs, the cases and the packet size. Show it to the user;
a panel costs about $3 to $4.50. A run with the same packet, prompt and judges stops (`--force`
runs it again). `deploymeter packet --model <model id>` prints the packet: check that it does not
name the model or its developer. The panel is a draft. The user publishes it at
`http://localhost:3300/admin/deploymeter`; then the model page shows the meter.

## 10. Check the site

Open these pages on the dev server (port 3300):

- The model page: `http://localhost:3300/<model id>`. It lists the documents, the system card evals
  and the runs, and shows the Deploymeter meter after the panel is published.
- The card: `http://localhost:3300/<model id>/cards/<system card key>`.
- The home page: the model is in the models list.
- Search: `http://localhost:3300/api/search?q=<model name>`.

## 11. Final checks and commit

```sh
pnpm lint
pnpm test
```

Commit only when the user asks. Add only your files, by path: `data/seed/system_cards.json`,
`data/extracted/system-cards/<key>.json`, and any of `data/extracted/result-directions.jsonl`,
`data/extracted/eval-links.txt`, `data/seed/evals/<slug>.json` or
`apps/web/lib/runs/route-overrides.json` that you changed. Do not push.
