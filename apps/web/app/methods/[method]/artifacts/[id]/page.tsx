import { Tag } from '@/components/catalog/parts';
import { EvalLink } from '@/components/eval-link';
import Link from '@/components/link';
import { LinkRow } from '@/components/link-row';
import { HEAD } from '@/components/methods/brief';
import { ROW, TABLE, TABLE_BOX, THEAD } from '@/components/methods/table';
import { PromptText } from '@/components/methods/variant-prompts';
import { Page, PageHeader } from '@/components/page';
import { download, formatValue, methodPath, paramText, suitePath, variantPath } from '@/lib/methods';
import { modelPath } from '@/lib/server/catalog';
import { getMethodArtifact } from '@/lib/server/methods';
import { cn } from '@/lib/utils';
import { Download } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

type Props = { params: Promise<{ method: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { method, id } = await params;
  const found = await getMethodArtifact(method, id);
  return { title: found?.artifact.displayName ?? 'Artifact' };
}

const sourceName = (url: string) => (url.includes('huggingface.co') ? 'Hugging Face' : new URL(url).hostname);

/** The owner of a Hugging Face repo URL, with a link to the owner's page. */
function hubOwner(url: string) {
  const u = new URL(url);
  if (!u.hostname.endsWith('huggingface.co')) return null;
  const parts = u.pathname.split('/').filter(Boolean);
  const name = ['datasets', 'spaces'].includes(parts[0]) ? parts[1] : parts[0];
  return name ? { name, href: `https://huggingface.co/${name}` } : null;
}

/** A result value: 3 decimals, or a whole number from 100. */
const valueText = (v: number) => (Math.abs(v) >= 100 ? formatValue(v) : v.toFixed(3));

export default async function ArtifactPage({ params }: Props) {
  const { method: methodSlug, id } = await params;
  const found = await getMethodArtifact(methodSlug, id);
  if (!found) notFound();
  const { artifact: a, method, variant, params: defs, model, results } = found;
  const facts: [string, ReactNode][] = [
    [
      'Variant',
      <Link key="v" href={variantPath(method.slug, variant.slug)} className="text-sky-800 hover:underline">
        {variant.displayName}
      </Link>,
    ],
    [
      'Model',
      model ? (
        <Link key="s" href={modelPath(model)} className="text-sky-800 hover:underline">
          {model.displayName}
        </Link>
      ) : (
        a.subject
      ),
    ],
    ['Revision', a.revision && <code className="text-xs">{a.revision}</code>],
    [
      'Sites',
      a.sites.length > 0 && (
        <ul key="sites" className="flex flex-col text-[11px]">
          {a.sites.map((s) => (
            <li key={`${s.role}/${s.source}`}>
              {s.address ? (
                <>
                  <code>{s.address}</code>
                  <span className="text-slate-500">
                    {' '}
                    · {s.role}, from <code className="break-all">{s.source}</code>
                  </span>
                </>
              ) : (
                <>
                  {s.source}
                  <span className="text-slate-500"> · {s.role}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      ),
    ],
    [
      'Key',
      <code key="k" className="text-[11px] break-all">
        {a.key}
      </code>,
    ],
  ];
  const by = a.sourceUrl ? hubOwner(a.sourceUrl) : null;
  const files = a.files ?? [];
  const source: [string, ReactNode][] = [
    [
      'Download',
      files.length > 0 && (
        <ul key="d" className="flex flex-col gap-y-1">
          {files.map((f) => {
            const d = download(a.id, f);
            return (
              d && (
                <li key={f.name}>
                  <a
                    href={d.href}
                    className="inline-flex items-center gap-x-1 font-medium text-sky-800 hover:underline"
                    rel="nofollow"
                  >
                    <Download className="size-3.5 shrink-0" aria-hidden />
                    <code className="text-[11px] break-all">{f.name}</code>
                  </a>
                  <span className="block text-slate-500">
                    {d.size} · {d.from}
                    {f.mirror && f.url && (
                      <>
                        {' '}
                        ·{' '}
                        <a href={f.url} className="text-sky-800 hover:underline" rel="nofollow">
                          {sourceName(f.url)}
                        </a>
                      </>
                    )}
                  </span>
                </li>
              )
            );
          })}
        </ul>
      ),
    ],
    [
      'Released by',
      by ? (
        <a key="b" href={by.href} className="text-sky-800 hover:underline" rel="nofollow">
          {by.name}
        </a>
      ) : (
        !a.sourceUrl && <span className="text-slate-400">Not recorded</span>
      ),
    ],
    [
      files.length > 0 ? 'Repository' : 'Files',
      a.sourceUrl && (
        <a key="w" href={a.sourceUrl} className="text-sky-800 hover:underline" rel="nofollow">
          {sourceName(a.sourceUrl)}
        </a>
      ),
    ],
    ['License', a.license],
  ];
  const defOf = new Map(defs.map((d) => [d.key, d]));
  const order = (k: string) => {
    const i = defs.findIndex((d) => d.key === k);
    return i < 0 ? Infinity : i;
  };
  const settings: [string, ReactNode][] = Object.entries(a.params)
    .sort(([x], [y]) => order(x) - order(y))
    .map(([k, v]) => [defOf.get(k)?.label ?? k, paramText(defOf.get(k), v)]);
  // Each eval's results, and each suite's evals, in the order of `results`.
  type Result = (typeof results)[number];
  const groups: { suite: Result['evalVersion']['eval']['suite']; evals: Result[][] }[] = [];
  for (const r of results) {
    const e = r.evalVersion.eval;
    let g = groups.at(-1);
    if (!g || g.suite?.slug !== e.suite?.slug) groups.push((g = { suite: e.suite, evals: [] }));
    const last = g.evals.at(-1);
    if (last?.[0]?.evalVersion.eval.slug === e.slug) last.push(r);
    else g.evals.push([r]);
  }
  const evalName = (e: Result['evalVersion']['eval']) =>
    e.suite && e.displayName.startsWith(`${e.suite.displayName} `)
      ? e.displayName.slice(e.suite.displayName.length + 1)
      : e.displayName;

  return (
    <Page>
      <PageHeader
        eyebrow="Method Artifact"
        title={
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            {a.displayName}
            <Link href={methodPath(method.slug)} className="font-sans text-sm font-medium text-sky-800 hover:underline">
              {method.displayName}
            </Link>
          </span>
        }
        description={variant.baseline && <Tag>baseline</Tag>}
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:items-start">
        <div
          className={cn(
            'flex min-w-0 flex-col gap-y-3 rounded-lg border border-slate-200 bg-white py-3',
            groups.length === 0 && 'lg:col-span-3',
          )}
        >
          <Facts title="Specifications" facts={facts} />
          {settings.length > 0 && <Facts title="Settings" facts={settings} />}
          <Facts title="Source" facts={source} />
          {groups.length > 0 && (
            <section aria-label="Evaluated In" className="flex min-w-0 flex-col gap-y-2 px-4">
              <h2 className={cn(HEAD, 'text-slate-400')}>Evaluated In</h2>
              <ul className="flex flex-col gap-y-1.5 text-xs">
                {groups.map((g) => (
                  <li key={g.suite?.slug ?? ''} className="flex flex-col gap-y-1">
                    {g.suite && (
                      <Link href={suitePath(g.suite.slug)} className="font-medium text-sky-800 hover:underline">
                        {g.suite.displayName}
                      </Link>
                    )}
                    <ul className={cn('flex flex-col gap-y-0.5', g.suite && 'ml-1 border-l border-slate-200 pl-3')}>
                      {g.evals.map((rs) => {
                        const e = rs[0].evalVersion.eval;
                        return (
                          <li key={e.slug}>
                            <EvalLink slug={e.slug} className="text-xs text-sky-800 hover:underline">
                              {evalName(e)}
                            </EvalLink>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        {groups.length > 0 && (
          <div className={cn(TABLE_BOX, 'rounded-lg lg:col-span-2')}>
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className="px-4 py-2 font-medium">Evaluation</th>
                  <th className="px-2 py-2 font-medium">Metric</th>
                  <th className="px-2 py-2 text-right font-medium">Value</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.suite?.slug ?? ''} className="divide-y divide-slate-100 border-b border-slate-200">
                  {g.suite && (
                    <tr>
                      <td colSpan={4} className="px-4 pt-2.5 pb-1">
                        <Link
                          href={suitePath(g.suite.slug)}
                          className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase hover:text-sky-800 hover:underline"
                        >
                          {g.suite.displayName}
                        </Link>
                      </td>
                    </tr>
                  )}
                  {g.evals.map((rs) =>
                    rs.map((r, i) => {
                      const e = r.evalVersion.eval;
                      return (
                        <LinkRow key={r.id} href={`/evaluations/${e.slug}`} className={cn(ROW, 'group/row')}>
                          {i === 0 && (
                            <td rowSpan={rs.length} className={cn('py-1.5 pr-4 align-top', g.suite ? 'pl-8' : 'pl-4')}>
                              <EvalLink
                                slug={e.slug}
                                className="text-xs font-medium text-sky-800 group-hover/row:underline"
                              >
                                {evalName(e)}
                              </EvalLink>
                            </td>
                          )}
                          <td
                            className={cn(
                              'px-2 py-1.5 text-xs text-slate-700',
                              i === 0 && 'font-medium text-slate-800',
                            )}
                          >
                            {r.metricName}
                          </td>
                          <td
                            className={cn(
                              'px-2 py-1.5 text-right text-slate-700 tabular-nums',
                              i === 0 && 'font-semibold text-slate-900',
                            )}
                          >
                            {valueText(r.value)}
                            {r.stderr != null && (
                              <span className="text-[11px] font-normal text-slate-400"> ± {formatValue(r.stderr)}</span>
                            )}
                          </td>
                          {i === 0 && (
                            <td rowSpan={rs.length} className="px-4 py-1.5 align-top text-[11px] text-slate-500">
                              <a href={r.sourceUrl} className="text-sky-800 hover:underline" rel="nofollow">
                                {r.sourceTable ? `Paper, ${r.sourceTable}` : 'Result file'}
                              </a>
                              {r.sourceCommit && <span className="font-mono"> @ {r.sourceCommit.slice(0, 8)}</span>}
                              {r.measuredAt && <span> · {r.measuredAt.toISOString().slice(0, 10)}</span>}
                              {r.n != null && <span> · {r.n.toLocaleString('en-US')} samples</span>}
                            </td>
                          )}
                        </LinkRow>
                      );
                    }),
                  )}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </div>
      {variant.prompts && (
        <section
          aria-label="Prompt"
          className="flex flex-col gap-y-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
        >
          <h2 className={cn(HEAD, 'text-slate-400')}>{variant.prompts.length > 1 ? 'Prompts' : 'Prompt'}</h2>
          {variant.prompts.map((p) => (
            <PromptText key={p.name} prompt={p} />
          ))}
        </section>
      )}
    </Page>
  );
}

/** One part of the left panel: a title, then a name and a value on each line. */
function Facts({ title, facts }: { title: string; facts: [string, ReactNode][] }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-y-2 px-4">
      <h2 className={cn(HEAD, 'text-slate-400')}>{title}</h2>
      <dl className="grid grid-cols-1 gap-1 text-xs">
        {facts
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex gap-x-3">
              <dt className="w-28 shrink-0 text-slate-500">{k}</dt>
              <dd className="min-w-0 break-words text-slate-800">{v}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}
