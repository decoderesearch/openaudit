import { valueKey, type BoardVariant } from '@/lib/methods';
import { getEvalBoard } from '@/lib/server/methods';
import type { MetricDef } from '@openaudit/spec';

/** The metric key prefix of each swap kind at one scale: `<prefix>_scale_<0_5|1|2|4>`. */
const KINDS = { main: 'swap_top1', answer: 'answer_swap_top1', random: 'random_swap_top1' } as const;
export type SwapKind = keyof typeof KINDS;

/** One variant's swap top-1 rate at each of `scales`, for each swap kind. Null when it has no value. */
export type SwapCurve = { variant: BoardVariant } & Record<SwapKind, (number | null)[]>;
export type SwapCurves = { scales: number[]; curves: SwapCurve[] };

const scaleOf = (key: string) => key.match(/^swap_top1_scale_(\d+(?:_\d+)?)$/)?.[1];

/** Each variant's swap rate against the scale on one subject model, best headline first. Null
 * when the version has fewer than two `swap_top1_scale_*` metrics or no results for the model. */
export async function swapCurves(
  version: { id: string; metrics: MetricDef[] },
  evalSlug: string,
  subject: string,
): Promise<SwapCurves | null> {
  const suffixes = version.metrics.flatMap((m) => scaleOf(m.key) ?? []);
  if (suffixes.length < 2) return null;
  const at = suffixes.map((s) => ({ s, scale: Number(s.replace('_', '.')) })).sort((a, b) => a.scale - b.scale);
  const board = await getEvalBoard(version.id);
  const curves = board.artifacts
    .filter((a) => a.subject === subject)
    .flatMap((a) => {
      const variant = board.variants.find((v) => v.id === a.variantId);
      if (!variant) return [];
      const line = (kind: SwapKind) =>
        at.map(({ s }) => a.values[valueKey(evalSlug, `${KINDS[kind]}_scale_${s}`)] ?? null);
      return [{ variant, main: line('main'), answer: line('answer'), random: line('random') }];
    })
    .filter((c) => c.main.some((v) => v != null));
  if (!curves.length) return null;
  const best = (c: SwapCurve) => Math.max(...c.main.map((v) => v ?? -1));
  return { scales: at.map((x) => x.scale), curves: curves.sort((a, b) => best(b) - best(a)) };
}
