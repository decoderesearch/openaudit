import { CardText, type Run } from '@/components/catalog/card-text';
import { EvalRow } from '@/components/catalog/eval-row';
import { Cite, SHOW_REVIEW_STATUS, Section, TOPIC_LABELS, TopicLabel, settingsText } from '@/components/catalog/parts';
import { ScoreBar } from '@/components/catalog/score';
import { Fold } from '@/components/fold';
import { InfoPopover } from '@/components/info-popover';
import Link from '@/components/link';
import { Eyebrow, Page, PageTitle } from '@/components/page';
import type { PdfDocument } from '@/components/pdf-viewer';
import { PANEL } from '@/components/section';
import { TogglePanels, type Panel } from '@/components/toggle-panel';
import { Button } from '@/components/ui/button';
import { aboutDocument, cardHeading, monthYear, plainTitle } from '@/lib/card-heading';
import { FRAMEWORKS, frameworksUsed } from '@/lib/frameworks';
import { mergeCards, type MergedCard, type Sourced } from '@/lib/merge-cards';
import { organizationPath } from '@/lib/organizations';
import { runAnchor } from '@/lib/run-anchor';
import {
  cardPath,
  evalsByIds,
  modelPath,
  modelsByIds,
  organizationById,
  savedCopyUrl,
  savedPdf,
  type CardView,
} from '@/lib/server/catalog';
import { cn } from '@/lib/utils';
import type { Disclosures, EvalResult, Model, RiskDomain, RiskLevel, Topic } from '@openaudit/spec';
import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';

// Our summary of one document, or of all of a model's system cards as one (`sources`, newest
// first). Each item cites the PDF of its own source.

const SPECS: [keyof Disclosures, string][] = [
  ['releaseDate', 'Release date'],
  ['knowledgeCutoff', 'Knowledge cutoff'],
  ['contextWindow', 'Context window'],
  ['maxOutput', 'Max output'],
  ['modalities', 'Modalities'],
  ['reasoningModes', 'Reasoning modes'],
  ['languages', 'Languages'],
  ['license', 'License'],
  ['totalParams', 'Total parameters'],
  ['activeParams', 'Active parameters'],
  ['architecture', 'Architecture'],
  ['trainingData', 'Training data'],
  ['trainingCompute', 'Training compute'],
];

const RISK_AREAS: [RiskDomain, string][] = [
  ['bio_chem', 'Bio & Chem'],
  ['cyber', 'Cyber'],
  ['ai_rnd_autonomy', 'AI R&D & Autonomy'],
  ['misalignment', 'Misalignment'],
  ['manipulation', 'Manipulation'],
  ['other', 'Other'],
];

const LEVEL: Record<RiskLevel, [string, string]> = {
  below: ['bg-emerald-500', 'Below the threshold'],
  early_warning: ['bg-amber-400', 'Early warning'],
  reached: ['bg-orange-500', 'Threshold reached'],
  highest: ['bg-red-600', 'Highest level'],
};

const LEVEL_RANK: Record<RiskLevel, number> = { highest: 0, reached: 1, early_warning: 2, below: 3 };

export { PANEL };
const TITLE = 'text-lg text-slate-800';
const MUTED = 'text-slate-500 transition-colors group-hover/cite:text-sky-900';

const INFO = {
  risk: 'The lab\u2019s own verdicts under its safety policy, one for each danger area: for example "does not cross the CB-2 threshold". The dot shows our reading of the level: green is below the threshold, amber is an early warning, orange is reached, red is the highest level, grey names no threshold.',
  topics:
    'For each of 24 safety topics: does the card report a test, a result or a safety claim on it? If it does, the main result in the card\u2019s words. A mention of a use or a domain is not coverage.',
  source:
    'The file we extracted this page from. The original document is the publisher\u2019s link. The OpenAudit copy is our saved copy, for when the link changes or goes down.',
  sources:
    'The system cards this page combines, newest first. For each item, the newest card that states it wins. The date next to an item names its card.',
  testers: 'Organizations outside the lab that tested the model, as the card names them, and what they tested.',
  results:
    'The numbers the card reports for this model: one row for each eval, metric and setting. Safety & Alignment Evals have a direction that is better for safety; all other results are in Capabilities & Other Evals. The bar shows the part of the score that is good for safety (green) and bad for safety (red). Grey shows a score with no safety direction. An empty bar has no known safety direction. A score with no fixed range, such as an Elo rating, has no bar. For an eval in our registry, hover over or click its row to see what it tests and who can get its samples. Numbers for other models in the same card are on their pages.',
};

type EvalLink = { slug: string; displayName: string; description: string | null; topics: Topic[]; access: string };

/** What an item needs from its source: the PDF to cite, eval links, and labels when combined. */
type At = (from: number) => {
  pdf?: PdfDocument;
  run: Run;
  tag?: ReactNode;
  source: { title: string; date?: string; href: string };
};

/** `systemCard`: the page is the model's system card, with the title "[model] System Card".
 * `notice` goes above the heading, and `banner` below it. */
export async function SummaryPage({
  model,
  sources,
  notice,
  banner,
  systemCard,
}: {
  model: Model;
  sources: CardView[];
  notice?: ReactNode;
  banner?: ReactNode;
  systemCard?: boolean;
}) {
  const combined = sources.length > 1;
  const newest = sources[0];
  const merged = mergeCards(sources);
  const publisher = await organizationById(newest.document.publisherId as string);
  const evals = await evalsByIds([...new Set(merged.results.flatMap((r) => (r.evalId ? [r.evalId as string] : [])))]);
  const slugs = [...evals.values()].map((e) => e.slug);
  const labels = sourceLabels(sources);
  const at: At = (from) => {
    const doc = sources[from].document;
    return {
      pdf: savedPdf(doc),
      run: { anchor: runAnchor(model.name, doc.key), slugs },
      tag: combined && (
        <span title={doc.title} className="ml-1.5 text-[11px] whitespace-nowrap text-slate-400">
          {labels[from]}
        </span>
      ),
      source: {
        title: plainTitle(doc.title),
        date: monthYear(doc.publishedDate) ?? undefined,
        href: cardPath(model, doc.key, doc.kind),
      },
    };
  };

  const specs = SPECS.filter(([k]) => merged.disclosures[k]);
  const panels: Panel[] = [];
  panels.push(
    merged.testers.length
      ? {
          label: `${merged.testers.length} External Evaluator${merged.testers.length === 1 ? '' : 's'}`,
          content: (
            <div className={`${PANEL} @container`}>
              <p className="mb-3 text-xs text-slate-500">{INFO.testers}</p>
              <TesterTable testers={merged.testers} at={at} />
            </div>
          ),
        }
      : {
          label: 'No External Evaluators',
          warn: true,
          content: (
            <div className={PANEL}>
              <p className="text-sm text-slate-600">
                {combined ? 'The documents name' : 'The document names'} no organization outside the lab that tested the
                model.
              </p>
            </div>
          ),
        },
  );
  const meta = combined ? [] : documentMeta(newest, await modelsByIds(coverIds(newest)));
  if (specs.length || meta.length)
    panels.push({
      label: 'Specifications',
      content: (
        <div className={`${PANEL} @container`}>
          <SpecList disclosures={merged.disclosures} specs={specs} more={meta} at={at} />
        </div>
      ),
    });
  if (combined)
    panels.push({
      label: `${sources.length} Source Documents`,
      content: (
        <div className={PANEL}>
          <p className="mb-3 text-xs text-slate-500">{INFO.sources}</p>
          <SourceList model={model} sources={sources} labels={labels} />
        </div>
      ),
    });
  else
    panels.push({
      label: 'Source File',
      content: (
        <div className={PANEL}>
          <p className="mb-3 text-xs text-slate-500">{INFO.source}</p>
          <SourceButtons c={newest} />
        </div>
      ),
    });

  const heading = cardHeading(newest.document);
  const eyebrow = combined || systemCard ? 'System Card' : heading.eyebrow;
  const about = (
    <InfoPopover label={eyebrow} iconClassName={systemCard ? 'size-4' : 'size-3'}>
      {aboutDocument(newest.document.kind, eyebrow)}
      {combined
        ? ` This page combines the ${sources.length} system cards ${publisher?.displayName ?? 'the lab'} published for ${model.displayName}.`
        : publisher && ` ${publisher.displayName} published this one.`}
    </InfoPopover>
  );
  return (
    <Page>
      {notice}
      <TogglePanels
        top={
          systemCard ? (
            publisher && (
              <Eyebrow>
                Published by
                <Link href={organizationPath(publisher)} className="hover:text-sky-800 hover:underline">
                  {publisher.displayName}
                </Link>
              </Eyebrow>
            )
          ) : (
            <Eyebrow>
              {eyebrow}
              {about}
            </Eyebrow>
          )
        }
        lead={
          <>
            <PageTitle>
              {systemCard ? (
                <SystemCardTitle model={model}>{about}</SystemCardTitle>
              ) : combined ? (
                model.displayName
              ) : (
                heading.title
              )}
            </PageTitle>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
              {heading.date && (
                <>
                  <span>{combined ? `Updated ${heading.date}` : heading.date}</span>
                  <span aria-hidden>·</span>
                </>
              )}
              {publisher && (
                <>
                  <span>{publisher.displayName}</span>
                  <span aria-hidden>·</span>
                </>
              )}
              {combined ? (
                <span>Summary of {sources.length} documents</span>
              ) : (
                <>
                  <span>Summary</span>
                  <span aria-hidden>·</span>
                  <a
                    href={newest.document.url}
                    title={newest.document.title}
                    target="_blank"
                    rel="noreferrer nofollow"
                    className="text-sky-800 hover:underline"
                  >
                    Original Document
                  </a>
                </>
              )}
            </p>
          </>
        }
        panels={panels}
      />
      {banner}
      {SHOW_REVIEW_STATUS && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          An LLM extracted these values from the document. Values marked &quot;Not reviewed&quot; can be wrong; hover a
          page number to see the quote, and check the document.
        </p>
      )}
      <SummaryBody card={merged} evals={evals} at={at} combined={combined} />
    </Page>
  );
}

/** "[model] System Card", with `children` (the help icon) on the line of the last word. */
export function SystemCardTitle({ model, children }: { model: Model; children: ReactNode }) {
  return (
    <>
      {model.displayName} System{' '}
      <span className="whitespace-nowrap">
        Card
        <span className="ml-1.5 inline-flex align-[-1px]">{children}</span>
      </span>
    </>
  );
}

function coverIds(c: CardView) {
  return c.covers.flatMap((x) => (x.modelId ? [x.modelId as string] : []));
}

/** "Aug 2026" for each source; the title when two sources share a month. */
function sourceLabels(sources: CardView[]) {
  const months = sources.map((c) => monthYear(c.document.publishedDate) ?? cardHeading(c.document).title);
  return months.map((m, i) =>
    months.indexOf(m) === months.lastIndexOf(m) ? m : cardHeading(sources[i].document).title,
  );
}

/** Facts about one document, for its Specifications. */
function documentMeta(c: CardView, covered: Map<string, Model>): [string, ReactNode][] {
  return [
    ['Original title', c.document.title],
    ['Published', longDate(c.document.publishedDate)],
    ...(c.pageCount ? [['Pages', c.pageCount] as [string, ReactNode]] : []),
    ['Extracted by', c.extraction.by],
    [
      'Covers',
      c.covers.map((x, i) => {
        const m = x.modelId ? covered.get(x.modelId as string) : undefined;
        const name = m?.displayName ?? x.rawModelName ?? '?';
        return (
          <span key={i}>
            {i > 0 && ', '}
            {m ? (
              <Link href={modelPath(m)} className="text-sky-800 hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
            {x.section && <span className="text-slate-500"> ({x.section})</span>}
          </span>
        );
      }),
    ],
  ];
}

function SourceButtons({ c }: { c: CardView }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm">
        <a href={c.document.url} title={c.document.title} target="_blank" rel="noreferrer nofollow">
          Original Document <ExternalLink />
        </a>
      </Button>
      {c.document.fileKey && (
        <Button asChild variant="outline" size="sm">
          <a href={savedCopyUrl(c.document)} target="_blank" rel="noreferrer">
            OpenAudit Copy <ExternalLink />
          </a>
        </Button>
      )}
    </div>
  );
}

function SourceList({ model, sources, labels }: { model: Model; sources: CardView[]; labels: string[] }) {
  return (
    <ul className="flex flex-col divide-y divide-slate-100 text-sm">
      {sources.map((c, i) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
          <span className="min-w-0">
            <span className="mr-2 text-xs text-slate-400">{labels[i]}</span>
            <Link
              href={cardPath(model, c.document.key, c.document.kind)}
              className="font-medium text-sky-800 hover:underline"
            >
              {c.document.title}
            </Link>
          </span>
          <SourceButtons c={c} />
        </li>
      ))}
    </ul>
  );
}

function SummaryBody({
  card: c,
  evals,
  at,
  combined,
}: {
  card: MergedCard;
  evals: Map<string, EvalLink>;
  at: At;
  combined: boolean;
}) {
  const frameworks = frameworksUsed(c.riskDecisions);
  const verdicts = (
    <div className="flex flex-col">
      <Section title="Safety Framework Verdicts" info={INFO.risk} className={PANEL} titleClassName={TITLE}>
        {c.riskDecisions.length ? (
          <>
            {frameworks.length > 0 && (
              <div className="-mb-0.5 flex flex-col gap-y-1 rounded-md bg-slate-50 px-3 py-2 text-xs">
                <span className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                  Frameworks Used
                </span>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {frameworks.map((id) => (
                    <a
                      key={id}
                      href={FRAMEWORKS[id].url}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="inline-flex items-center gap-x-1 font-medium text-sky-800 hover:underline"
                    >
                      {FRAMEWORKS[id].name}
                      <ExternalLink className="size-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            <ul className="grid grid-cols-1 text-[13px]/[18px] @5xl:grid-cols-2 @5xl:gap-x-4">
              {[...RISK_AREAS]
                .sort(([, a], [, b]) => a.localeCompare(b))
                .flatMap(([area, label]) =>
                  c.riskDecisions
                    .filter((r) => r.domain === area)
                    .sort((a, b) => (a.level ? LEVEL_RANK[a.level] : 4) - (b.level ? LEVEL_RANK[b.level] : 4))
                    .map((r, i) => {
                      const [dot, level] = r.level ? LEVEL[r.level] : ['bg-slate-300', 'No threshold named'];
                      const { pdf, run, tag } = at(r.from);
                      return (
                        <li
                          key={`${area}-${i}`}
                          className="relative flex gap-x-2 rounded-md px-2 py-1.5 transition-colors hover:bg-sky-50"
                        >
                          <span
                            role="img"
                            aria-label={level}
                            className={`mt-[5px] size-2 shrink-0 rounded-full ${dot}`}
                          />
                          <div className="flex min-w-0 flex-col gap-y-0.5">
                            <p>
                              <span className="font-medium text-slate-800">{label}</span>
                              <span className="text-slate-400"> – </span>
                              <Cite pdf={pdf} {...r.source} className="text-slate-700" stretch>
                                <CardText text={r.labLabel} run={run} />
                              </Cite>
                              {tag}
                            </p>
                          </div>
                        </li>
                      );
                    }),
                )}
            </ul>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            {combined ? 'The cards state' : 'The card states'} no safety framework verdicts for this model.
          </p>
        )}
      </Section>
    </div>
  );
  return (
    <div className="@container flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 @5xl:grid-cols-2">
        <Section title="Evaluation Categories" info={INFO.topics} className={PANEL} titleClassName={TITLE}>
          <div className="grid grid-cols-1 gap-x-4 text-sm @2xl:grid-cols-2">
            {[...c.topics]
              .sort((a, b) => TOPIC_LABELS[a.topic].localeCompare(TOPIC_LABELS[b.topic]))
              .map((t) => {
                const { pdf, run, tag } = at(t.from);
                return (
                  <div
                    key={t.topic}
                    className={cn(
                      'relative flex flex-col gap-y-0.5 rounded-md px-3 py-2 transition-colors',
                      t.covered && 'hover:bg-sky-50',
                    )}
                  >
                    <TopicLabel topic={t.topic} />
                    {t.covered ? (
                      <span className="min-w-0 pl-3 text-xs">
                        <Cite
                          pdf={pdf}
                          page={t.source?.page}
                          pdfPage={t.source?.pdfPage}
                          quote={t.source?.quote}
                          className="text-slate-700"
                          stretch
                        >
                          {t.headline ? (
                            <CardText text={t.headline} run={run} />
                          ) : (
                            <span className={`${MUTED} italic`}>{t.source?.quote ?? 'Covered'}</span>
                          )}
                        </Cite>
                        {tag}
                      </span>
                    ) : (
                      <span className="pl-3 text-xs font-medium text-rose-600">No Coverage Found</span>
                    )}
                  </div>
                );
              })}
          </div>
        </Section>
        <Section className={PANEL} titleClassName={TITLE} info={INFO.results} title="Evaluation Results">
          <ResultTable results={c.results} evals={evals} at={at} />
        </Section>
      </div>
      {verdicts}
    </div>
  );
}

/** "September 22, 2026" from "2026-09-22"; a partial date as it is. */
function longDate(date?: string | null) {
  if (!date) return 'Not stated';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'UTC' });
}

function TesterTable({ testers, at }: { testers: MergedCard['testers']; at: At }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 @4xl:grid-cols-2">
      {halves(testers).map((part, n) => (
        <table key={n} className="w-full text-left text-sm">
          <thead className={n ? 'hidden @4xl:table-header-group' : ''}>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="w-2/5 py-1.5 pr-3 font-medium">Tester</th>
              <th className="py-1.5 font-medium">What they tested</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {part.map((t, i) => {
              const { pdf, tag } = at(t.from);
              return (
                <tr key={i} className="align-top">
                  <td className="py-1.5 pr-3 font-medium text-slate-800">{t.name}</td>
                  <td className="py-1.5">
                    <Cite pdf={pdf} {...t.source} className="text-slate-600">
                      {t.scope ?? 'Not stated'}
                    </Cite>
                    {tag}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ))}
    </div>
  );
}

/** The model's specs from the card, then `more` (facts about the document). */
function SpecList({
  disclosures,
  specs,
  more,
  at,
}: {
  disclosures: MergedCard['disclosures'];
  specs: typeof SPECS;
  more: [string, ReactNode][];
  at: At;
}) {
  const row = 'flex items-baseline justify-between gap-x-3 border-b border-slate-100 pb-1';
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs @xl:grid-cols-2 @5xl:grid-cols-3">
      {specs.map(([key, label]) => {
        const d = disclosures[key]!;
        const { pdf, tag } = at(d.from);
        return (
          <div key={key} className={row}>
            <dt className="shrink-0 text-slate-500">{label}</dt>
            <dd className="min-w-0 text-right">
              <Cite pdf={pdf} {...d.source} className="text-slate-800">
                {d.value}
              </Cite>
              {tag}
            </dd>
          </div>
        );
      })}
      {more.map(([label, value]) => (
        <div key={label} className={row}>
          <dt className="shrink-0 text-slate-500">{label}</dt>
          <dd className="min-w-0 text-right text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Splits a list in two for side-by-side columns; the first half takes the odd one. */
function halves<T>(list: T[]): T[][] {
  const n = Math.ceil(list.length / 2);
  return list.length > 1 ? [list.slice(0, n), list.slice(n)] : [list];
}

/** Results with a direction that is better for safety come first, by eval name; then all others. */
function ResultTable({ results, evals, at }: { results: Sourced<EvalResult>[]; evals: Map<string, EvalLink>; at: At }) {
  if (!results.length) return <p className="text-sm text-slate-500">No results for this model.</p>;
  const linkOf = (r: EvalResult) => (r.evalId ? evals.get(r.evalId as string) : undefined);
  const hasSafety = (r: EvalResult) => !!r.safetyDirection && r.safetyDirection !== 'neither';
  const safety = results
    .filter(hasSafety)
    .sort((a, b) =>
      (a.rawEvalName ?? '').localeCompare(b.rawEvalName ?? '', undefined, { sensitivity: 'base', numeric: true }),
    );
  const groups: [string, Sourced<EvalResult>[]][] = [
    ['Safety & Alignment Evals', safety],
    ['Capabilities & Other Evals', results.filter((r) => !hasSafety(r))],
  ];
  // Side by side with the topics, the table fills the height of the row and scrolls inside it.
  // Rows hold positioned items (the value under the bar), so the sticky header needs a z-index.
  // `isolate` keeps these z-indexes inside the table, below the page's sticky bars.
  return (
    <div className="relative @5xl:min-h-80 @5xl:flex-1">
      <Fold more="Show more rows">
        <div className="isolate overflow-auto rounded-md border border-slate-200 bg-white lg:max-h-[32rem] @5xl:absolute @5xl:inset-0 @5xl:max-h-none">
          <table className="w-full text-left text-xs">
            {groups.map(([title, rows], i) =>
              rows.length ? (
                <tbody key={i} className="divide-y divide-slate-100">
                  <tr>
                    <th
                      colSpan={2}
                      className="sticky top-0 z-20 bg-slate-100 px-3 py-2 text-left font-medium text-slate-600"
                    >
                      {title}
                    </th>
                  </tr>
                  {rows.map((r) => (
                    <ResultRow key={r.id} result={r} link={linkOf(r)} at={at} />
                  ))}
                </tbody>
              ) : null,
            )}
          </table>
        </div>
      </Fold>
    </div>
  );
}

function ResultRow({ result: r, link, at }: { result: Sourced<EvalResult>; link?: EvalLink; at: At }) {
  const { pdf } = at(r.from);
  const details = settingsText(r);
  const cited = r.source?.page || r.source?.table || r.source?.quote;
  const cells = (
    <>
      <td className="py-2.5 pr-2 pl-3">
        <div className="text-slate-800">
          {link ? (
            <Link href={`/evaluations/${link.slug}`} className="text-sky-800 hover:underline">
              {r.rawEvalName}
            </Link>
          ) : (
            r.rawEvalName
          )}
        </div>
        {details && <div className="mt-0.5 text-[10px]/[13px] text-slate-400">{details}</div>}
        {link && link.topics.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {link.topics.map((t) => (
              <span
                key={t}
                className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px]/[11px] whitespace-nowrap text-slate-700"
              >
                {TOPIC_LABELS[t]}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="w-1/2 py-2.5 pr-3 pl-2 align-middle">
        {/* The bar is at the middle of the row; the metric and value hang below it, or take its place. */}
        <div className="flex items-center gap-x-6">
          <ScoreBar result={r} />
          {cited ? (
            <Cite
              pdf={pdf}
              page={r.source?.page ?? r.source?.table}
              pdfPage={r.source?.pdfPage}
              quote={r.source?.quote}
              label="Source"
              className="py-1.5"
            />
          ) : (
            <span className="w-20 shrink-0" />
          )}
        </div>
      </td>
    </>
  );
  const row = 'align-top transition-colors hover:bg-slate-50';
  return link ? (
    <EvalRow eval={link} className={row}>
      {cells}
    </EvalRow>
  ) : (
    <tr className={row}>{cells}</tr>
  );
}
