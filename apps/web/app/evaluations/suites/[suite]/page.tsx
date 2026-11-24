import { EvalBrowser } from '@/components/catalog/eval-browser';
import Link from '@/components/link';
import { Markdown } from '@/components/markdown';
import { DetailsButton } from '@/components/methods/brief';
import { Byline, LinksMenu, NeuronpediaButton, PaperButton, splitLinks } from '@/components/methods/link-buttons';
import { SuiteResults, type Search } from '@/components/methods/suite-results';
import { NavSection } from '@/components/nav/nav-section';
import { Page, PageHeader, TitleTags } from '@/components/page';
import { SubmitVariantRow } from '@/components/submit-buttons';
import { monthYear } from '@/lib/card-heading';
import { evalListQuery, parseEvalListFilter } from '@/lib/eval-list-filter';
import { methodPath, suitePath } from '@/lib/methods';
import { shareMetadata } from '@/lib/og/meta';
import { methodEvalRows } from '@/lib/server/eval-list-rows';
import { getMethod, getSuite } from '@/lib/server/methods';
import { BookCheck, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ suite: string }>; searchParams: Promise<Search> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).suite;
  const found = await getSuite(slug);
  const title = found?.suite.displayName ?? 'Evaluation Suite';
  const description = found?.suite.summary ?? '';
  const url = suitePath(slug);
  return { title, description, ...shareMetadata(title, description, url, `${url}/opengraph-image`) };
}

/** A suite: what it is, its evals, and each method's results on them, with the choices in the URL. */
export default async function SuitePage({ params, searchParams }: Props) {
  const [{ suite: slug }, sp] = await Promise.all([params, searchParams]);
  const found = await getSuite(slug);
  if (!found) notFound();
  const { suite, evals, methods } = found;
  const [rows, datas] = await Promise.all([methodEvalRows(), Promise.all(methods.map((m) => getMethod(m)))]);
  const links = splitLinks(suite.links);
  const mine = new Set(evals.map((e) => e.slug));
  const creator = suite.maintainers.map((m) => m.name).join(', ');
  const date = monthYear(rows.find((r) => r.suite?.slug === suite.slug)?.suite?.date ?? null);
  const evalFilter = parseEvalListFilter(sp);
  const results = datas
    .filter((d) => d != null)
    .map((d) => ({ ...d, evals: d.evals.filter((e) => e.suite?.slug === suite.slug) }));

  const methodLinks = results.map((d) => ({ label: d.method.displayName, href: methodPath(d.method.slug) }));
  // With creators, the paper is a link on their names and in Links, not a button.
  const paperByCreator = !!links.paper && !!creator;
  const byline = [
    paperByCreator ? (
      <a
        href={links.paper!.url}
        target="_blank"
        rel="nofollow noopener noreferrer"
        title={links.paper!.title ?? undefined}
        className="inline-flex items-center gap-x-1 hover:text-slate-700 hover:underline"
      >
        {creator}
        <ExternalLink className="size-3" aria-hidden />
      </a>
    ) : (
      creator
    ),
    date,
  ].filter(Boolean);
  const more = paperByCreator ? [links.paper!, ...links.rest] : links.rest;

  return (
    <Page className="gap-y-4">
      <NavSection method={methods.length > 0} />
      <PageHeader
        eyebrow="Evaluation Suite"
        title={suite.displayName}
        aside={methodLinks.length > 0 && <TitleTags items={methodLinks} />}
        description={suite.summary}
        descriptionClassName="mt-1 text-sm/normal text-slate-600"
        actions={
          (byline.length > 0 || suite.links.length > 0 || suite.description) && (
            <div className="flex flex-col gap-y-2 sm:items-end">
              <Byline items={byline} />
              {(links.demo || suite.description || links.paper || more.length > 0) && (
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {links.demo && <NeuronpediaButton link={links.demo} />}
                  {links.paper && !paperByCreator && <PaperButton link={links.paper} />}
                  {suite.description && (
                    <DetailsButton label={suite.displayName}>
                      <Markdown text={suite.description} className="text-xs text-slate-700" />
                    </DetailsButton>
                  )}
                  {more.length > 0 && <LinksMenu links={more} />}
                </div>
              )}
            </div>
          )
        }
      />

      {results.map((d) => (
        <section key={d.method.slug} aria-label={d.method.displayName} className="flex flex-col gap-4">
          {results.length > 1 && (
            <h2 className="text-sm font-semibold text-slate-800">
              <Link href={methodPath(d.method.slug)} className="hover:text-sky-800 hover:underline">
                {d.method.displayName}
              </Link>
            </h2>
          )}
          <SuiteResults data={d} sp={sp} variantRows noBaselines noCharts footer={<SubmitVariantRow />} />
        </section>
      ))}

      <EvalBrowser
        key={evalListQuery(evalFilter)}
        rows={rows
          .filter((r) => mine.has(r.slug))
          .sort((a, b) => a.label.localeCompare(b.label))
          .map(({ suite: _, ...r }) => r)}
        kind="methods"
        filter={evalFilter}
        title="Evaluations"
        titleIcon={<BookCheck aria-hidden />}
        podium
        search={false}
        chain
        className="lg:max-h-[44rem]"
      />
    </Page>
  );
}
