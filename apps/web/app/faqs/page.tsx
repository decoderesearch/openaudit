import { ANCHOR, LAST_ANCHOR } from '@/components/anchor';
import { Markdown } from '@/components/markdown';
import { AnchorTitle, MobileOnThisPage, NavPanel, TopLink } from '@/components/on-this-page';
import { Page, PageTitle } from '@/components/page';
import { ReturnHome } from '@/components/return-home';
import { FAQ_SECTIONS as SECTIONS } from '@/lib/faqs';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Frequently Asked Questions' };

const NAV = SECTIONS.map((s) => ({
  id: s.id,
  title: s.title,
  items: s.faqs.map((f) => ({ id: f.id, title: f.question })),
}));

export default function FaqsPage() {
  return (
    <Page className="flex-1 gap-y-4 pb-4">
      <PageTitle className="text-center">
        <TopLink>Frequently Asked Questions</TopLink>
      </PageTitle>
      <NavPanel parts={NAV}>
        <div className="flex flex-col gap-y-6 px-5 pt-6 pb-10 sm:px-6 lg:pl-8">
          <MobileOnThisPage parts={NAV} />
          {SECTIONS.map((s, si) => (
            <section key={s.id} id={s.id} className={cn(ANCHOR, 'flex max-w-3xl flex-col gap-y-1')}>
              <h2 className="text-sm font-medium tracking-wide text-slate-400 uppercase">
                <AnchorTitle id={s.id}>{s.title}</AnchorTitle>
              </h2>
              <dl className="flex flex-col">
                {s.faqs.map((f, fi) => (
                  <div
                    key={f.id}
                    id={f.id}
                    className={cn(
                      ANCHOR,
                      'flex flex-col gap-y-2 py-4',
                      si === SECTIONS.length - 1 && fi === s.faqs.length - 1 && LAST_ANCHOR,
                    )}
                  >
                    <dt className="text-base font-semibold text-slate-800">
                      <AnchorTitle id={f.id}>{f.question}</AnchorTitle>
                    </dt>
                    {f.answer && (
                      <dd>
                        <Markdown dedent text={f.answer} className="text-[13px]/relaxed text-slate-700" />
                      </dd>
                    )}
                    {si === SECTIONS.length - 1 && fi === s.faqs.length - 1 && <ReturnHome className="mt-8" />}
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </NavPanel>
    </Page>
  );
}
