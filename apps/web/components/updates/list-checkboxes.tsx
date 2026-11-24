'use client';

import { UPDATE_LISTS, type UpdateList } from '@/lib/updates';

/** A checkbox for each email update list, with its description. */
export function ListCheckboxes({
  value,
  onChange,
  idPrefix,
}: {
  value: UpdateList[];
  onChange: (lists: UpdateList[]) => void;
  idPrefix: string;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Lists</legend>
      {UPDATE_LISTS.map((l) => {
        const id = `${idPrefix}-${l.id}`;
        return (
          <label key={l.id} htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              id={id}
              type="checkbox"
              className="mt-0.5 size-4 accent-sky-700"
              checked={value.includes(l.id)}
              onChange={(e) =>
                onChange(
                  UPDATE_LISTS.map((x) => x.id).filter((x) => (x === l.id ? e.target.checked : value.includes(x))),
                )
              }
            />
            <span>
              <span className="font-medium text-slate-900">{l.label}</span>
              <span className="block text-xs text-slate-500">{l.description}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
