import Link from '@/components/link';
import { cn } from '@/lib/utils';

export type LinkChip = { key: string; label: string; href: string };

/** A row of page links that scrolls to the side, from edge to edge of the `Page` padding. */
export function LinkChips({ label, chips, className }: { label: string; chips: LinkChip[]; className?: string }) {
  return (
    <nav aria-label={label} className={cn('-mx-4 no-scrollbar overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6', className)}>
      <ul className="flex w-max gap-1.5">
        {chips.map((c) => (
          <li key={c.key}>
            <Link
              href={c.href}
              className="block rounded-full bg-slate-200/70 px-3 py-1 text-xs whitespace-nowrap text-slate-700 transition-colors hover:bg-slate-200 hover:text-sky-800"
            >
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
