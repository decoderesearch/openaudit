/** The evals that a list shows: model evals or method evals. */
export type EvalKind = 'models' | 'methods';

/** The page of each kind's evals. */
export const KIND_PAGES = { models: '/models', methods: '/methods' } as const;

const EVAL_KIND_LABELS: Record<EvalKind, string> = {
  models: 'Model Evaluations',
  methods: 'Method Evaluations',
};
export const EVAL_KIND_INFO: Record<EvalKind, string> = {
  models: 'Evaluations of AI models: a fixed set of samples and a grader. Each run tests one model.',
  methods:
    'Evaluations of methods that inspect a model, such as sparse autoencoders, probes and LLM monitors. Each result scores one variant of a method.',
};
/** Model and Method Evaluations as breadcrumb menu links, each with what it is on hover. */
export const EVAL_KIND_LINKS = (['models', 'methods'] as const).map((k) => ({
  label: EVAL_KIND_LABELS[k],
  href: KIND_PAGES[k],
  info: EVAL_KIND_INFO[k],
}));

/** The filters of the Evaluations list. `show=all`: all evals, else only evals with results. `q`: the
 * search text. */
export type EvalListFilter = { show?: 'all'; q?: string };

/** The filter in the URL's params. */
export function parseEvalListFilter(params: Record<string, unknown>): EvalListFilter {
  const out: EvalListFilter = {};
  if (params.show === 'all') out.show = 'all';
  if (typeof params.q === 'string' && params.q) out.q = params.q;
  return out;
}

/** The URL query for `filter` ("" for the default), so that `parseEvalListFilter` gives it back. */
export function evalListQuery(filter: EvalListFilter): string {
  const q = new URLSearchParams();
  if (filter.show) q.set('show', filter.show);
  if (filter.q) q.set('q', filter.q);
  return q.size ? `?${q}` : '';
}

export const isDefaultFilter = (filter: EvalListFilter) => evalListQuery(filter) === '';
