import { CommitmentCell } from '@/components/commitments/commitment-cell';
import { CommitmentFeed } from '@/components/commitments/commitment-feed';
import { LinkRow } from '@/components/commitments/link-row';
import { CriteriaLegend, CriterionMark } from '@/components/commitments/timeline';
import { InfoPopover } from '@/components/info-popover';
import Link from '@/components/link';
import { Markdown } from '@/components/markdown';
import { Eyebrow, Page, PageTitle } from '@/components/page';
import { CATEGORY_LABELS, commitmentPath, criteriaScore, orgCommitmentPath } from '@/lib/commitments';
import { shareMetadata } from '@/lib/og/meta';
import { plainText } from '@/lib/org-research';
import { getCommitment } from '@/lib/server/commitments';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// One commitment for all organizations: `/organizations/commitments/<slug>`. Each organization's
// score and criteria, highest score first, and the events of all organizations. From `lg` up, the
// table and the events are side by side, and each scrolls in itself.

type Props = { params: Promise<{ commitment: string }> };

const load = async (params: Props['params']) => getCommitment(decodeURIComponent((await params).commitment));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load(params);
  if (!found) return { title: 'Commitment' };
  const c = found.commitment;
  const [description, url] = [plainText(c.summary), commitmentPath(c.slug)];
  return {
    title: c.name,
    description,
    alternates: { canonical: url },
    ...shareMetadata(c.name, description, url, `${url}/opengraph-image`),
  };
}

const HEAD = 'sticky top-0 z-20 border-b border-slate-200 bg-white px-2 py-2 align-middle font-semibold';
const CELL = 'border-b border-slate-100 px-2 py-2 text-center group-hover:bg-sky-50/60';

export default async function CommitmentPage({ params }: Props) {
  const found = await load(params);
  if (!found) notFound();
  const { commitment: c, events } = found;
  const keys = c.criteria.map((x) => x.key);
  const points = (cell: (typeof found.orgs)[number]['cell']) => criteriaScore(cell.state, keys)?.points ?? 0;
  const orgs = [...found.orgs].sort((a, b) => points(b.cell) - points(a.cell));
  return (
    <Page fit="lg">
      <header className="flex flex-col gap-y-1">
        <Eyebrow after={CATEGORY_LABELS[c.category]}>Safety Commitment</Eyebrow>
        <div className="flex items-center gap-x-2">
          <PageTitle>{c.name}</PageTitle>
          <InfoPopover label={c.name} contentClassName="w-96">
            <Markdown text={c.description} className="text-xs/5 text-slate-700" />
          </InfoPopover>
        </div>
        <Markdown text={c.summary} className="max-w-3xl text-sm text-slate-600" />
      </header>

      {orgs.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">No Organizations Checked</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:grid-rows-[minmax(0,1fr)]">
          {/* `isolate`: the sticky heads stay under the navbar's menus. */}
          <section
            aria-label="Organizations"
            className="isolate flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white lg:min-h-0"
          >
            <CriteriaLegend className="shrink-0 justify-end border-b border-slate-200 px-3 py-2" />
            {/* `relative`: it clips the `sr-only` text in the cells. */}
            <div className="relative overflow-auto overscroll-contain lg:min-h-0">
              <table className="w-full border-separate border-spacing-0 text-xs">
                <thead>
                  <tr className="text-[11px] text-slate-500">
                    <th scope="col" className={cn(HEAD, 'left-0 z-30 pr-4 pl-3 text-left')}>
                      Organization
                    </th>
                    <th scope="col" className={HEAD}>
                      Score
                    </th>
                    {c.criteria.map((x) => (
                      <th key={x.key} scope="col" title={x.description} className={cn(HEAD, 'w-24 text-[11px]/[14px]')}>
                        {x.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orgs.map(({ org, cell }) => {
                    const href = orgCommitmentPath(org, c.slug);
                    return (
                      <LinkRow key={org.id} href={href} className="group cursor-pointer">
                        <th
                          scope="row"
                          className="sticky left-0 z-10 border-b border-slate-100 bg-white py-2 pr-4 pl-3 text-left whitespace-nowrap group-hover:bg-sky-50"
                        >
                          <Link
                            href={href}
                            className="text-[13px] font-semibold text-slate-800 group-hover:text-sky-800"
                          >
                            {org.displayName}
                          </Link>
                        </th>
                        <td className={CELL}>
                          <CommitmentCell
                            href={href}
                            facts={{
                              org: org.displayName,
                              commitment: c.name,
                              summary: cell.summary,
                              level: cell.state.level,
                              score: criteriaScore(cell.state, keys),
                              latest: cell.latest,
                            }}
                          />
                        </td>
                        {c.criteria.map((x) => (
                          <td key={x.key} className={CELL}>
                            {cell.state.level === 'none_found' ? (
                              <CriterionMark status="not_met" />
                            ) : (
                              <CriterionMark
                                status={cell.state.criteria[x.key]}
                                verified={cell.state.verified?.includes(x.key)}
                              />
                            )}
                          </td>
                        ))}
                      </LinkRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {events.entries.length > 0 && (
            <CommitmentFeed slug={c.slug} first={events} keys={keys} className="min-w-0 lg:max-h-full lg:self-start" />
          )}
        </div>
      )}
    </Page>
  );
}
