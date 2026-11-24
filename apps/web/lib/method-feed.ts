import type { MenuEval } from '@/components/nav/menu-evals';

type Ranked = { label: string; href: string };

/** A method eval or a suite on the home page. `top`: for one eval, its best 3; for a suite, the 3
 * variants with the most first places. */
export type MethodFeedEntry = {
  label: string;
  href: string;
  creator: string | null;
  summary: string | null;
  top: Ranked[];
};

/** The best of `e`, in order. */
export const topOf = (e: MenuEval): Ranked[] => (e.top ?? e.best).map(({ label, href }) => ({ label, href }));

/** The 3 that are first on the most of `evals`. */
export function mostFirsts(evals: MenuEval[]): Ranked[] {
  const wins = new Map<string, { ranked: Ranked; n: number }>();
  for (const x of evals) {
    const first = topOf(x)[0];
    if (first) wins.set(first.href, { ranked: first, n: (wins.get(first.href)?.n ?? 0) + 1 });
  }
  return [...wins.values()]
    .sort((a, b) => b.n - a.n || a.ranked.label.localeCompare(b.ranked.label))
    .slice(0, 3)
    .map((w) => w.ranked);
}
