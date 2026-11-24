import { ANCHOR, LAST_ANCHOR } from '@/components/anchor';
import { Markdown, MarkdownLink } from '@/components/markdown';
import { AnchorTitle, BackToTop, type NavPart } from '@/components/on-this-page';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

/** `id`: the anchor of the part. `text`: Markdown. A link: [text](/page) or [text](https://...). A
 * blank line starts a new paragraph, and backticks (`...`) hold more than one line; the indent of
 * the code does not count. `links`: a line of links under the text. `after`: shown under them.
 * `items`: a tree under the part. Items can have their own `items`, at any depth; their titles
 * are links to their `href`. */
export type Part = {
  id: string;
  title: string;
  text: string;
  links?: [label: string, href: string][];
  after?: ReactNode;
  href?: string;
  items?: Part[];
};
export type ListPart = Part;

/** A branch of the tree: each draws its part of the tree line, so the line stops at the last one. */
const BRANCH =
  "relative flex flex-col gap-y-0.5 pt-4 pb-[3px] before:absolute before:top-[28px] before:-left-6 before:h-px before:w-4 before:bg-slate-300 before:content-[''] after:absolute after:top-0 after:bottom-0 after:-left-6 after:w-px after:bg-slate-200 after:content-[''] last:after:bottom-auto last:after:h-[28px]";

/** The parts and their items, for a `NavPanel`. */
export function navParts(parts: ListPart[]): NavPart[] {
  return parts.map((p) => ({ id: p.id, title: p.title, items: p.items?.map(({ id, title }) => ({ id, title })) }));
}

/** `links`, with slate dots between them. */
function LinkLine({ links }: { links: [string, string][] }) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5">
      {links.map(([label, href], i) => (
        <Fragment key={href + label}>
          {i > 0 && (
            <span aria-hidden className="text-slate-400">
              ·
            </span>
          )}
          <MarkdownLink href={href}>{label}</MarkdownLink>
        </Fragment>
      ))}
    </p>
  );
}

/** The items of an item, as a tree with no anchor links on the titles. */
function SubItems({ items }: { items: Part[] }) {
  return (
    <ul className="flex flex-col pl-6">
      {items.map((sub) => (
        <li key={sub.id} id={sub.id} className={cn(ANCHOR, BRANCH)}>
          <p className="text-base/6 font-semibold text-slate-700">
            {sub.href ? <MarkdownLink href={sub.href}>{sub.title}</MarkdownLink> : sub.title}
          </p>
          {sub.text.trim() && <Markdown dedent mail text={sub.text} className="text-slate-600" />}
          {sub.links && <LinkLine links={sub.links} />}
          {sub.after && <div className="mt-1.5">{sub.after}</div>}
          {sub.items && <SubItems items={sub.items} />}
        </li>
      ))}
    </ul>
  );
}

/** A list of parts, each after a chevron, each with its items in a tree under it. `end`: under the
 * last text. It is in the last anchor, so the space that lets that anchor scroll to the top is
 * under `end`. `backToTop`: each part's title has a "Back to top" link at its right. */
export function PartsList({
  parts,
  end,
  backToTop,
  className,
}: {
  parts: ListPart[];
  end?: ReactNode;
  backToTop?: boolean;
  className?: string;
}) {
  return (
    <ul className={cn('flex max-w-3xl flex-col gap-y-4', className)}>
      {parts.map((p, pi) => (
        <li
          key={p.id}
          id={p.id}
          className={cn(ANCHOR, 'flex gap-x-2', pi === parts.length - 1 && !p.items?.length && LAST_ANCHOR)}
        >
          <ChevronRight className="mt-1.5 size-4 shrink-0 text-sky-800" strokeWidth={2.5} aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-y-2">
            <div className="flex items-baseline justify-between gap-x-4">
              <h2 className="text-lg font-semibold text-slate-800">
                <AnchorTitle id={p.id}>{p.title}</AnchorTitle>
              </h2>
              {backToTop && <BackToTop />}
            </div>
            {p.text.trim() && <Markdown dedent mail text={p.text} className="text-[13px]/relaxed text-slate-700" />}
            {p.links && (
              <div className="text-[13px]/relaxed">
                <LinkLine links={p.links} />
              </div>
            )}
            {p.after}
            {pi === parts.length - 1 && !p.items?.length && end}
            {p.items && (
              <ul className="flex flex-col pl-6">
                {p.items.map((item, ii, items) => (
                  <li
                    key={item.id}
                    id={item.id}
                    className={cn(
                      ANCHOR,
                      pi === parts.length - 1 && ii === items.length - 1 && LAST_ANCHOR,
                      BRANCH,
                      'text-[13px]/relaxed',
                    )}
                  >
                    <h3 className="text-base/6 font-semibold text-slate-700">
                      <AnchorTitle id={item.id}>{item.title}</AnchorTitle>
                    </h3>
                    {item.text.trim() && <Markdown dedent mail text={item.text} className="text-slate-600" />}
                    {item.links && <LinkLine links={item.links} />}
                    {item.after && <div className="mt-1.5">{item.after}</div>}
                    {item.items && <SubItems items={item.items} />}
                    {pi === parts.length - 1 && ii === items.length - 1 && end}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
