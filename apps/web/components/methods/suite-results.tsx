import { SuiteResultsView } from '@/components/methods/suite-results-view';
import { subjectLinks, type MethodData } from '@/lib/server/methods';
import type { ReactNode } from 'react';

export type Search = Record<string, string | undefined>;

/** The results of one method on a set of evals. `sp`: the first choices. `evalPage`: on the page of
 * its one eval. `brief`, `current`, `title`, `eyebrow`, `sub`, `variantRows`, `noBaselines`,
 * `noCharts` and `footer`: as in `SuiteResultsView`. */
export function SuiteResults({
  data,
  sp,
  evalPage,
  brief,
  current,
  title,
  eyebrow,
  sub,
  variantRows,
  noBaselines,
  noCharts,
  footer,
}: {
  data: MethodData;
  sp: Search;
  evalPage?: boolean;
  brief?: boolean;
  current?: { id: string; name: string };
  title?: ReactNode;
  eyebrow?: ReactNode;
  sub?: ReactNode;
  variantRows?: boolean;
  noBaselines?: boolean;
  noCharts?: boolean;
  footer?: ReactNode;
}) {
  const { method, variants, params, evals, artifacts, subjects } = data;
  const links = subjectLinks(subjects, [...new Set(artifacts.map((a) => a.subject))]);
  return (
    <SuiteResultsView
      input={{ method: { slug: method.slug, compare: method.compare }, variants, params, evals, artifacts }}
      names={Object.fromEntries(Object.entries(links).map(([s, l]) => [s, l.label]))}
      initial={sp}
      evalPage={evalPage}
      brief={brief}
      current={current}
      title={title}
      eyebrow={eyebrow}
      sub={sub}
      variantRows={variantRows}
      noBaselines={noBaselines}
      noCharts={noCharts}
      footer={footer}
    />
  );
}
