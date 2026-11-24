import { BoxTitle } from '@/components/catalog/title-search';
import { ExpertJudges } from '@/components/methods/brief';
import type { MethodExpertView } from '@openaudit/spec';
import { GraduationCap } from 'lucide-react';

/**
 * The Expert Views box of a method: the views by stance. With no views, nothing.
 */
export function MethodExpertViews({ views }: { views: MethodExpertView[] }) {
  if (!views.length) return null;
  return (
    <section
      aria-label="Expert Views"
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
    >
      <div className="flex h-10 shrink-0 items-center bg-slate-50 pr-4 pl-2 sm:pr-5 sm:pl-3">
        <BoxTitle title="Expert Views" icon={<GraduationCap aria-hidden />} />
      </div>
      <div className="flex flex-col gap-3 py-3.5 pr-4 pl-5 sm:pr-5 sm:pl-6">
        <ExpertJudges views={views} />
      </div>
    </section>
  );
}
