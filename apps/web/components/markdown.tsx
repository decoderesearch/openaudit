import { EvalLink } from '@/components/eval-link';
import Link from '@/components/link';
import { evalSlugOf } from '@/lib/eval-links';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Markdown from our data, for server pages. Raw HTML is not shown, and only http(s), relative
// and anchor links are kept. Outside links open in a new tab.

const LINK = 'text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:decoration-sky-800';

/** The URL when it is http(s), relative or an anchor; else nothing. */
export function safeUrl(url: string) {
  if (url.startsWith('/') || url.startsWith('#')) return url;
  return /^https?:\/\//i.test(url) ? defaultUrlTransform(url) : '';
}

const safeOrMailUrl = (url: string) => (/^mailto:/i.test(url) ? defaultUrlTransform(url) : safeUrl(url));

/** Text from a template string in code, without the indent of the code: removes the blank lines at
 * the ends, and the indent that all lines have. Else Markdown shows an indented line as code. */
export function dedent(text: string): string {
  const fromNewLine = /^[ \t]*\n/.test(text);
  const lines = text.replace(/^[ \t]*\n/, '').split('\n');
  const indentOf = (l: string) => /^[ \t]*/.exec(l)![0].length;
  const shared = (fromNewLine ? lines : lines.slice(1)).filter((l) => l.trim()).map(indentOf);
  const cut = shared.length ? Math.min(...shared) : 0;
  return lines
    .map((l, i) => (i === 0 && !fromNewLine ? l : l.slice(Math.min(cut, indentOf(l)))))
    .join('\n')
    .trim();
}

export function Markdown({
  text,
  className,
  inline,
  dedent: fromCode,
  mail,
}: {
  text: string;
  className?: string;
  /** No paragraph boxes, for a line of text. */
  inline?: boolean;
  /** The text is a template string in code: see `dedent`. */
  dedent?: boolean;
  /** Also keep mailto links. Only for our own text. */
  mail?: boolean;
}) {
  const body = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      urlTransform={mail ? safeOrMailUrl : safeUrl}
      disallowedElements={['img']}
      unwrapDisallowed
      components={{
        p: ({ children }) => (inline ? <>{children} </> : <p>{children}</p>),
        a: ({ children, href }) => <MarkdownLink href={href}>{children}</MarkdownLink>,
        ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
        strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-slate-200 pl-3 text-slate-600">{children}</blockquote>
        ),
        h1: ({ children }) => <p className="font-semibold">{children}</p>,
        h2: ({ children }) => <p className="font-semibold">{children}</p>,
        h3: ({ children }) => <p className="font-semibold">{children}</p>,
        code: ({ children }) => <code className="rounded bg-slate-100 px-1 font-mono text-[0.9em]">{children}</code>,
        table: ({ children }) => (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">{children}</table>
          </div>
        ),
        th: ({ children, style }) => (
          <th style={style} className="border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-700">
            {children}
          </th>
        ),
        td: ({ children, style }) => (
          <td style={style} className="border border-slate-200 px-2 py-1 align-top">
            {children}
          </td>
        ),
      }}
    >
      {fromCode ? dedent(text) : text}
    </ReactMarkdown>
  );
  return inline ? (
    <span className={className}>{body}</span>
  ) : (
    <div className={cn('flex flex-col gap-y-2 break-words', className)}>{body}</div>
  );
}

/** A link with the style of Markdown links. A page of this site opens in this tab; an outside page
 * opens in a new tab. */
export function MarkdownLink({ href, children }: { href?: string; children: ReactNode }) {
  if (!href) return <>{children}</>;
  if (href.startsWith('mailto:'))
    return (
      <a href={href} className={LINK}>
        {children}
      </a>
    );
  const slug = evalSlugOf(href);
  if (slug)
    return (
      <EvalLink slug={slug} href={href} className={LINK}>
        {children}
      </EvalLink>
    );
  if (href.startsWith('/') || href.startsWith('#'))
    return (
      <Link href={href} className={LINK}>
        {children}
      </Link>
    );
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={LINK}>
      {children}
    </a>
  );
}
