import { ACTION } from '@/components/catalog/model-actions';
import Link from '@/components/link';
import { Markdown } from '@/components/markdown';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TOPIC_LABELS, topicPath } from '@/lib/topics';
import { cn } from '@/lib/utils';
import type { Direction, Eval, EvalVersion, MetricDef } from '@openaudit/spec';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ClipboardList, type LucideIcon } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

// The Specifications menu at the top right of an eval page.

const label = (v: string) => v.replaceAll('_', ' ');
const HEAD = 'text-[10px] font-semibold tracking-wide text-slate-500 uppercase';

function Menu({
  name,
  icon: Icon,
  className,
  children,
}: {
  name: string;
  icon: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger className={ACTION}>
        <Icon aria-hidden />
        {name}
        <ChevronDown aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={8}
        className={cn(
          'flex max-h-[min(36rem,var(--radix-popover-content-available-height))] flex-col gap-y-3 overflow-y-auto overscroll-contain',
          className,
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

const DIRECTIONS: Partial<Record<Direction, [string, typeof ArrowUp]>> = {
  higher_is_better: ['Higher is better', ArrowUp],
  lower_is_better: ['Lower is better', ArrowDown],
  nearer_zero_is_better: ['Nearer 0 is better', ArrowUpDown],
};

function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-x-0.5 rounded-full border border-slate-200 bg-slate-50 px-1.5 text-[10px]/4 whitespace-nowrap text-slate-600 [&>svg]:size-2.5',
        className,
      )}
    >
      {children}
    </span>
  );
}

function DirectionChip({ direction }: { direction: Direction }) {
  const found = DIRECTIONS[direction];
  if (!found) return null;
  const [text, Icon] = found;
  return (
    <Chip>
      <Icon aria-hidden />
      {text}
    </Chip>
  );
}

/** A titled group of metrics: a gray bar, then rows with lines between them. */
function Group({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="sticky top-0 z-10 flex items-baseline justify-between border-y border-slate-200 bg-slate-50 px-3 py-1.5 first:border-t-0">
        <span className={HEAD}>{title}</span>
        <span className="text-[10px] text-slate-400">{note}</span>
      </h3>
      <ul className="isolate divide-y divide-slate-100">{children}</ul>
    </section>
  );
}

function Row({ name, chips, description }: { name: ReactNode; chips: ReactNode; description?: string }) {
  return (
    <li className="px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="font-medium text-slate-800">{name}</span>
        <span className="flex flex-wrap items-center gap-1">{chips}</span>
      </div>
      {description && <p className="mt-0.5 text-[11px]/4 text-slate-500">{description}</p>}
    </li>
  );
}

/** Metrics as "Risk score: CBRNE" go in one group when 3 or more have the same part before the colon. */
function groupMetrics(metrics: MetricDef[]) {
  const prefix = (m: MetricDef) => m.displayName.match(/^([^:]+):\s*(.+)$/);
  const counts = new Map<string, number>();
  for (const m of metrics) {
    const p = prefix(m)?.[1];
    if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const single: MetricDef[] = [];
  const groups = new Map<string, { name: string; metric: MetricDef }[]>();
  for (const m of metrics) {
    const p = prefix(m);
    if (p && (counts.get(p[1]!) ?? 0) >= 3)
      groups.set(p[1]!, [...(groups.get(p[1]!) ?? []), { name: p[2]!, metric: m }]);
    else single.push(m);
  }
  single.sort((a, b) => Number(!!b.headline) - Number(!!a.headline));
  return { single, groups: [...groups] };
}

/** The version's scores (one for each sample) and metrics (one for each run). */
function MetricGroups({ version }: { version: EvalVersion }) {
  const scoreName = new Map(version.scores.map((s) => [s.key, s.displayName]));
  const { single, groups } = groupMetrics(version.metrics);
  const source = (m: MetricDef) => {
    const from = m.score && scoreName.get(m.score);
    if (m.aggregation === 'mean') return from ? `Mean of ${from.toLowerCase()}` : 'Mean';
    if (m.aggregation === 'rate') return from ? `Rate of ${from.toLowerCase()}` : 'Rate';
    if (m.aggregation === 'pass_at_k') return `Pass@${m.k ?? 'k'}`;
    return 'Custom';
  };
  return (
    <>
      <Group title="Scores" note="One for each sample">
        {version.scores.map((s) => (
          <Row
            key={s.key}
            name={s.displayName}
            description={s.description}
            chips={
              <>
                <Chip>{s.type}</Chip>
                <DirectionChip direction={s.direction} />
              </>
            }
          />
        ))}
      </Group>
      <Group title="Metrics" note="One for each run">
        {single.map((m) => (
          <Row
            key={m.key}
            name={m.displayName}
            description={m.description}
            chips={
              <>
                {m.headline && <Chip className="border-sky-200 bg-sky-50 text-sky-800">Headline</Chip>}
                <Chip>{source(m)}</Chip>
                <DirectionChip direction={m.direction} />
              </>
            }
          />
        ))}
        {groups.map(([name, parts]) => (
          <li key={name} className="px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-medium text-slate-800">
                {name} <span className="font-normal text-slate-400">by category</span>
              </span>
              <span className="flex flex-wrap items-center gap-1">
                <Chip>{source(parts[0]!.metric)}</Chip>
                <DirectionChip direction={parts[0]!.metric.direction} />
              </span>
            </div>
            <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
              {parts.map((p) => (
                <li key={p.metric.key} title={p.metric.description} className="truncate">
                  {p.name}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </Group>
    </>
  );
}

/** "Specifications": the eval's long description, its version, facets and maintainers, the
 * version's dataset and runner, then its scores and metrics. */
export function EvalSpecsMenu({ eval: e, version }: { eval: Eval; version?: EvalVersion }) {
  const f = e.facets;
  const topics = f.topics.map((t, i) => (
    <Fragment key={t}>
      {i > 0 && ', '}
      <Link href={topicPath(t)} className="text-sky-800 hover:underline">
        {TOPIC_LABELS[t] ?? t}
      </Link>
    </Fragment>
  ));
  const released = version?.releasedDate;
  const rows: [string, ReactNode][] = [
    [
      'Version',
      version
        ? `${version.version}${released && released !== version.version ? ` (${released})` : ''}`
        : 'No versions yet',
    ],
    ['Topics', topics.length > 0 && topics],
    ['Tests', f.subjects.map(label).join(', ')],
    ['Measures', f.measures.map(label).join(', ')],
    ['Format', f.formats.map(label).join(', ')],
    ['Cases', f.cases.map(label).join(', ')],
    ['Grading', f.grading.map(label).join(', ')],
    [
      'Other',
      [f.adversarial && 'adversarial', f.humanParticipants && 'human participants'].filter(Boolean).join(', ') || '—',
    ],
    ['Maintainers', e.maintainers.map((m) => m.name).join(', ')],
  ];
  const dataset = version?.dataset;
  return (
    <Menu name="Specifications" icon={ClipboardList} className="w-[28rem] gap-y-0 p-0">
      <div className="flex flex-col gap-y-3 p-3 text-[11px]">
        {e.description && (
          <div>
            <h3 className={HEAD}>About</h3>
            <Markdown text={e.description} className="mt-1 text-slate-700" />
          </div>
        )}
        <div>
          <h3 className={HEAD}>Facets</h3>
          <dl className="mt-1 flex flex-col gap-0.5">
            {rows
              .filter(([, v]) => v)
              .map(([name, value]) => (
                <div key={name} className="flex gap-x-3">
                  <dt className="w-20 shrink-0 text-slate-500">{name}</dt>
                  <dd className="text-slate-800">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
        {version && dataset && (
          <div className="flex flex-col gap-1">
            <h3 className={HEAD}>Dataset</h3>
            <p className="text-slate-500">
              {dataset.hfRepo && (
                <a
                  href={`https://huggingface.co/datasets/${dataset.hfRepo}`}
                  className="text-sky-800 hover:underline"
                  rel="nofollow"
                >
                  {dataset.hfRepo}
                </a>
              )}
              {dataset.revision && <span className="font-mono"> @ {dataset.revision.slice(0, 10)}</span>}
              {dataset.license && <span> · license {dataset.license}</span>}
            </p>
            <table className="w-full overflow-hidden rounded-md border border-slate-200 text-left">
              <thead className="bg-slate-50 text-[10px] text-slate-500">
                <tr>
                  <th className="px-2 py-1 font-medium">Split</th>
                  <th className="px-2 py-1 text-right font-medium">Samples</th>
                  <th className="px-2 py-1 font-medium">Stored</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataset.splits.map((s) => (
                  <tr key={s.name}>
                    <td className="px-2 py-1">
                      {s.storage === 'stored' && s.sampleCount > 0 ? (
                        <Link
                          href={`/evaluations/${e.slug}/samples?version=${encodeURIComponent(version.version)}&split=${encodeURIComponent(s.name)}`}
                          className="text-sky-800 hover:underline"
                        >
                          {label(s.name)}
                        </Link>
                      ) : (
                        label(s.name)
                      )}
                    </td>
                    <td className="px-2 py-1 text-right text-slate-700 tabular-nums">{s.sampleCount}</td>
                    <td className="px-2 py-1 text-slate-500">{label(s.storage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {version?.changes && (
          <div>
            <h3 className={HEAD}>Changes</h3>
            <Markdown text={version.changes} className="mt-1 text-slate-600" />
          </div>
        )}
        {version?.runner && (
          <p className="text-slate-500">
            Runner: {version.runner.kind}
            {version.runner.roles?.length ? ` · roles ${version.runner.roles.join(', ')}` : ''}
            {version.runner.gpu ? ' · needs a GPU' : ''}
          </p>
        )}
      </div>
      {version && <MetricGroups version={version} />}
    </Menu>
  );
}
