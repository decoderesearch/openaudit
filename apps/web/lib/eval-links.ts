/** The eval slug of a link to an eval page (`/evaluations/<slug>`, with a query or anchor), else
 * null. Text from documents uses `/evals/<slug>`. */
export function evalSlugOf(href: string): string | null {
  return href.match(/^\/(?:evals|evaluations)\/([^/#?]+)(?:[#?].*)?$/)?.[1] ?? null;
}
