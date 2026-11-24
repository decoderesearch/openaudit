'use client';

import { MethodSection } from '@/components/catalog/method-browser';
import { COLUMN_LIST, MenuEvals } from '@/components/nav/menu-evals';
import { MENU_MAX_HEIGHT, MenuPageLink, NavMenu } from '@/components/nav/nav-menu';
import type { NavMethods } from '@/lib/server/nav-methods';
import { cn } from '@/lib/utils';
import { HardHat } from 'lucide-react';

/** The width of the Methods column, in px. */
const METHODS_WIDTH = 304;
/** The width of the Method Evaluations column, in px. */
const EVALS_WIDTH = 360;

/** The navbar's Methods menu, as the Methods page: each method with its variants, and the method
 * evals with their best 3. `methods`: the data from the server; null if that read
 * failed. */
export function MethodsMenu({ active, methods }: { active: boolean; methods: NavMethods | null }) {
  return (
    <NavMenu<NavMethods>
      label="Safety Methods"
      icon={HardHat}
      href="/methods"
      active={active}
      api="/api/nav-methods"
      initial={methods}
      noun="methods"
      width={METHODS_WIDTH + EVALS_WIDTH}
      maxHeight={MENU_MAX_HEIGHT}
      inlineFilter
      body={MethodsBody}
    />
  );
}

function MethodsBody({ data, onPick }: { data: NavMethods; onPick: () => void }) {
  // The browser can keep a response from before a deploy, in an older form, for a short time.
  const methods = data.methods ?? [];
  const evals = (data.evals ?? []).filter((e) => Array.isArray(e.worst) && Array.isArray(e.best));
  return (
    <div
      className="grid divide-x-4 divide-slate-100"
      style={{ gridTemplateColumns: `${METHODS_WIDTH}px minmax(0, 1fr)` }}
    >
      {/* Its list is under the head (`h-11`) too. */}
      <section aria-label="Methods" className="relative flex min-w-0 flex-col [--menu-above:2.75rem]">
        {/* Solid, not blurred: the method heads stick under it. `pt-1` aligns it with `COLUMN_HEAD`. */}
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 px-4 pt-1">
          <MenuPageLink href="/methods" onPick={onPick} count={data.counts?.methods} className="pl-4">
            Safety Methods
          </MenuPageLink>
        </div>
        <ul className={cn(COLUMN_LIST, 'isolate pt-0')}>
          {methods.length === 0 && <li className="px-5 py-2 text-slate-500">No methods yet.</li>}
          {methods.map((m) => (
            <MethodSection
              key={m.href}
              method={{ ...m, variants: (m.variants ?? []).map((v) => ({ ...v, medals: v.medals ?? [] })) }}
              onPick={onPick}
              compact
            />
          ))}
        </ul>
      </section>
      <MenuEvals
        title="Method Evaluations"
        evals={evals}
        count={data.evalTotal || undefined}
        href="/methods"
        onPick={onPick}
        podium
      />
    </div>
  );
}
