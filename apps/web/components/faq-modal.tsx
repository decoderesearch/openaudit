import Link from '@/components/link';
import { Markdown } from '@/components/markdown';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Faq } from '@/lib/faqs';
import type { ReactNode } from 'react';

/** A button with `label` that opens the answer of `faq` in a modal, with a link to the FAQs page. */
export function FaqModal({ faq, label, className }: { faq: Faq; label: ReactNode; className?: string }) {
  return (
    <Dialog>
      <DialogTrigger className={className}>{label}</DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-y-4 bg-white sm:max-w-2xl">
        <DialogTitle className="pr-8 text-base">{faq.question}</DialogTitle>
        <DialogDescription className="sr-only">An answer from the FAQs.</DialogDescription>
        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-slate-100 px-6 pt-4">
          <Markdown dedent text={faq.answer} className="text-[13px]/relaxed text-slate-700" />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="px-6">
              Close
            </Button>
          </DialogClose>
          <Button asChild size="sm" className="bg-sky-700 px-6 text-white hover:bg-sky-800">
            <Link href={`/faqs#${faq.id}`} hover={false}>
              Go to FAQs
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
