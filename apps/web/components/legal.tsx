import { Page, PageHeader } from '@/components/page';
import { LEGAL_ADDRESS, LEGAL_EMAIL, LEGAL_ENTITY } from '@/lib/legal';
import type { ReactNode } from 'react';

// Frame and parts for the terms and privacy pages.

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <Page>
      <PageHeader title={title} description={`Last updated ${updated}`} />
      <article className="flex flex-col gap-y-6 rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm/6 text-slate-700 sm:px-6 sm:py-5 [&_a]:text-sky-800 [&_a]:hover:underline [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-slate-800 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </article>
    </Page>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-16 flex-col gap-y-2">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

/** Text that must stand out (disclaimers, limits of liability). */
export function Conspicuous({ children }: { children: ReactNode }) {
  return <p className="font-medium text-slate-800 uppercase">{children}</p>;
}

/** A boxed rule that readers must not miss. */
export function Notice({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-slate-800">{children}</div>;
}

export function ContactBlock() {
  return (
    <address className="text-slate-700 not-italic">
      {LEGAL_ENTITY}
      {LEGAL_ADDRESS.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
      <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
    </address>
  );
}

export const Mail = () => <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>;
