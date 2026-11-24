import { ANCHOR } from '@/components/anchor';
import { FeatureHead } from '@/components/feature-head';
import { Markdown } from '@/components/markdown';
import { Page } from '@/components/page';
import { ReturnHome } from '@/components/return-home';
import { GuidedTourButton, PICKER_TITLE, TourConsentHost, TutorialPicker } from '@/components/why-tour';
import { cn } from '@/lib/utils';
import { WHY_REASONS as REASONS, type Reason } from '@/lib/why';
import { WHY_TOURS } from '@/lib/why-tour';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Features' };

const TEXT = 'text-[13px]/relaxed text-slate-700';
/** The label of a part, in a column at the left. The top padding puts it on the text's first line. */
const LABEL = 'pt-[3px] text-[11px] leading-4 font-bold tracking-wide text-slate-400 uppercase';
/** Lists with no marker and no indent. */
const PLAIN = '[&_ul]:list-none [&_ul]:pl-0';

/** A feature's panel: its name and Tutorial button across the top, with a button that shows its
 * caveats. Under them, the problem, the solution and the examples, each with its label at the left. */
function FeatureRow({ r }: { r: Reason }) {
  const notes = r.caveats?.trim()
    ? [{ label: 'Caveats', body: <Markdown dedent text={r.caveats} className={TEXT} /> }]
    : [];
  const parts = [
    { label: 'Problem', text: r.problem },
    { label: 'Solution', text: r.solution },
    { label: 'Examples', text: r.examples, className: PLAIN },
  ].filter((p) => p.text.trim());
  return (
    <li id={r.id} className={cn(ANCHOR, 'flex flex-col gap-y-4 rounded-lg border border-slate-200 bg-white px-5 py-4')}>
      <FeatureHead
        notes={notes}
        head={
          <>
            <h2 className="font-display text-lg font-semibold text-slate-800">{r.head}</h2>
            {WHY_TOURS[r.id] && <GuidedTourButton ids={[r.id]} look="small" />}
          </>
        }
      />
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3">
        {parts.map((p) => (
          <section key={p.label} aria-label={p.label} className="col-span-2 grid grid-cols-subgrid">
            <h3 className={LABEL}>{p.label}</h3>
            <Markdown dedent text={p.text} className={cn(TEXT, p.className)} />
          </section>
        ))}
      </div>
      {r.title && <h3 className="text-base font-semibold text-slate-800">{r.title}</h3>}
      {r.text?.trim() && <Markdown dedent text={r.text} className={TEXT} />}
    </li>
  );
}

export default function FeaturesPage() {
  return (
    <Page className="flex-1 gap-y-6 pb-10">
      <TourConsentHost />
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <li className="flex flex-col justify-center rounded-lg bg-slate-100 px-5 py-8">
          <TutorialPicker title={<h1 className={PICKER_TITLE}>Guided Walkthrough</h1>} />
        </li>
        {REASONS.map((r) => (
          <FeatureRow key={r.id} r={r} />
        ))}
      </ul>
      <ReturnHome />
    </Page>
  );
}
