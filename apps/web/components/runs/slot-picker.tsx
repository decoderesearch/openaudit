'use client';

import { SelectNative } from '@/components/ui/select-native';
import { slotLabel, slotModelFor } from '@/lib/runs/routes';
import type { ModelSlot } from '@openaudit/spec';

/** A model picker for each slot. The first choice is `base` (the run's model), else the slot's
 *  tier model for `target`, else the task's default. */
export function SlotPicker({
  slots,
  judges,
  value,
  onChange,
  base,
  target,
}: {
  slots: ModelSlot[];
  judges: string[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  base?: Record<string, string>;
  target?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      {slots.map((s) => {
        const first = base?.[s.id] ?? (target ? slotModelFor(s, target) : s.default);
        return (
          <label key={s.id} className="flex min-w-48 flex-col gap-1 text-xs text-slate-500">
            {slotLabel(s)}
            <SelectNative
              value={value[s.id] ?? first}
              onChange={(e) => {
                const { [s.id]: _, ...rest } = value;
                onChange(e.target.value === first ? rest : { ...rest, [s.id]: e.target.value });
              }}
            >
              <option value={first}>
                {first} ({base ? 'this run' : s.tier && target ? `${s.tier} tier` : 'task default'})
              </option>
              {judges
                .filter((j) => j !== first)
                .map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
            </SelectNative>
          </label>
        );
      })}
    </div>
  );
}
