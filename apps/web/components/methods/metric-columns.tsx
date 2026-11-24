'use client';

import { InfoPopover } from '@/components/info-popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { coreRows, median, rankAll, type BoardRow, type BoardVariant } from '@/lib/methods';
import { replaceUrlParam } from '@/lib/url-param';
import type { Direction } from '@openaudit/spec';
import { ChevronDown } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { useMetricChoice } from './metric-choice';
import { useModelFilter } from './model-filter';
import { SubjectColumns } from './subject-columns';

/** The board of one metric. `about`: what the metric is. `count`: its number of samples. */
export type MetricBoard = {
  key: string;
  name: string;
  about?: string;
  direction: Direction;
  rows: BoardRow[];
  count?: number;
};

/** A metric's name, with its number of samples after it in light mono. */
const Named = ({ b }: { b: MetricBoard }) => (
  <>
    <span className="truncate">{b.name}</span>
    {b.count != null && <span className="font-mono text-[10px] text-slate-400">{b.count}</span>}
  </>
);

/** The board's view (`?board=`): a column for each metric after the first (default), or each model. */
type View = 'models' | 'parts';

/** A slate tooltip at the right with what the metric is. No tooltip with no `about`. */
function About({ about, children }: { about?: string; children: ReactElement }) {
  if (!about) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="max-w-64">
        {about}
      </TooltipContent>
    </Tooltip>
  );
}

/** One row for the board `b`: each variant's value on the model `model`, else its median over the
 * models (with `core`: the core models, and only for a variant with a value on each), ranked. */
export function partRow(b: MetricBoard, variants: BoardVariant[], model: string | null, core?: string[]): BoardRow {
  const rows = model ? b.rows.filter((r) => r.subject === model) : coreRows(b.rows, core);
  const full = (xs: number[]) => model || !core?.length || xs.length === core.length;
  const valueOf = (id: string) => {
    const xs = rows.flatMap((r) => r.cells.get(id)?.value ?? r.baselineValues.get(id) ?? []);
    return full(xs) ? median(xs) : null;
  };
  const ranked = rankAll(
    variants.filter((v) => !v.baseline).map((v) => ({ id: v.id, value: valueOf(v.id) })),
    b.direction,
  );
  const cells: BoardRow['cells'] = new Map();
  for (const [id, c] of ranked) if (c) cells.set(id, { ...c, artifactId: '' });
  const baselineValues = new Map(
    variants
      .filter((v) => v.baseline)
      .flatMap((v) => {
        const x = valueOf(v.id);
        return x == null ? [] : [[v.id, x] as const];
      }),
  );
  return { subject: b.key, order: null, cells, baselineValues };
}

/**
 * `SubjectColumns` with a bar above it: a menu of metrics, and with more than two metrics, a
 * switch from a column for each metric after the first (`part`: what one is, as "Sample Set") to
 * a column for each model. The menu sets `?metric=`, which the sample list also uses; in the
 * first view, a click on a column sets it too. `info`: with one metric, how to read the board.
 */
export function MetricColumns({
  boards,
  info,
  part = 'Metric',
  ...props
}: Omit<ComponentProps<typeof SubjectColumns>, 'rows' | 'direction' | 'label' | 'header' | 'summary'> & {
  boards: MetricBoard[];
  info: ReactNode;
  part?: string;
}) {
  const [key, setKey] = useMetricChoice();
  const [model] = useModelFilter();
  const view: View = useSearchParams()?.get('board') === 'models' ? 'models' : 'parts';
  const board = boards.find((b) => b.key === key) ?? boards[0];
  if (!board) return null;
  if (boards.length === 1)
    return (
      <SubjectColumns
        {...props}
        rows={board.rows}
        direction={board.direction}
        label={
          <span className="inline-flex items-center gap-x-1">
            {board.name}
            <InfoPopover label={board.name} iconClassName="size-3">
              {board.name} of each variant, one column for each model that it inspects. {info}
            </InfoPopover>
          </span>
        }
      />
    );
  const [head, ...parts] = boards;
  const byParts = view === 'parts' && parts.length > 1;
  const pick = (k: string) => setKey(k === boards[0]!.key ? null : k);
  const header = (
    <>
      <span className="flex min-w-0 items-center gap-x-1">
        <DropdownMenu>
          <About about={board.about}>
            <DropdownMenuTrigger
              aria-label="Metric"
              className="flex h-6 max-w-56 min-w-0 cursor-pointer items-center gap-x-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 hover:border-slate-300"
            >
              <Named b={board} />
              <ChevronDown className="size-3.5 shrink-0 text-slate-400" aria-hidden />
            </DropdownMenuTrigger>
          </About>
          <DropdownMenuContent align="start" className="max-h-80 w-max max-w-96 min-w-64">
            <DropdownMenuRadioGroup value={board.key} onValueChange={pick}>
              {boards.map((b) => (
                <About key={b.key} about={b.about}>
                  <DropdownMenuRadioItem value={b.key} className="cursor-pointer gap-x-1.5 text-xs">
                    <Named b={b} />
                  </DropdownMenuRadioItem>
                </About>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
      {parts.length > 1 && (
        <SegmentedControl
          label="Columns"
          small
          light
          className="h-6"
          itemClassName="font-medium"
          value={view}
          options={[
            { value: 'parts', label: `By ${part}` },
            { value: 'models', label: 'By Model' },
          ]}
          onValueChange={(v) => replaceUrlParam('board', v === 'models' ? v : undefined)}
        />
      )}
    </>
  );
  if (byParts)
    return (
      <SubjectColumns
        {...props}
        filter={false}
        header={header}
        label="Variant"
        rows={parts.map((b) => partRow(b, props.variants, model, props.core))}
        subjects={Object.fromEntries(parts.map((b) => [b.key, { label: b.name }]))}
        direction={head!.direction}
        summary={{ label: head!.name, row: partRow(head!, props.variants, model, props.core) }}
        onPick={(k) => pick(k === key ? boards[0]!.key : k)}
        selected={key}
      />
    );
  return <SubjectColumns {...props} header={header} label="Variant" rows={board.rows} direction={board.direction} />;
}
