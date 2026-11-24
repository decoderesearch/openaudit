'use client';

import { EvalLink } from '@/components/eval-link';
import Link from '@/components/link';
import { evalSlugOf } from '@/lib/eval-links';
import type { ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// One answer, as markdown, sized for a narrow panel. Links to our pages stay in the tab.

const TEXT = 'text-[13px] leading-relaxed text-slate-700';

export function MessageBody({ text }: { text: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className={`my-1.5 ${TEXT}`}>{children}</p>,
        ul: ({ children }) => <ul className={`my-1.5 list-disc space-y-0.5 pl-4 ${TEXT}`}>{children}</ul>,
        ol: ({ children }) => <ol className={`my-1.5 list-decimal space-y-0.5 pl-4 ${TEXT}`}>{children}</ol>,
        h1: ({ children }) => <Heading>{children}</Heading>,
        h2: ({ children }) => <Heading>{children}</Heading>,
        h3: ({ children }) => <Heading>{children}</Heading>,
        h4: ({ children }) => <Heading>{children}</Heading>,
        strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
        code: ({ children }) => (
          <code className="rounded-sm bg-slate-100 px-1 py-px font-mono text-[12px] text-slate-700">{children}</code>
        ),
        pre: ({ children }) => (
          <pre className="my-2 overflow-x-auto rounded-md bg-slate-50 p-2 text-[12px] [&_code]:bg-transparent [&_code]:p-0">
            {children}
          </pre>
        ),
        a: ({ children, href = '' }) =>
          evalSlugOf(href) ? (
            <EvalLink
              slug={evalSlugOf(href)!}
              href={href}
              className="text-sky-800 underline underline-offset-2 hover:text-sky-900"
            >
              {children}
            </EvalLink>
          ) : href.startsWith('/') ? (
            <Link href={href} className="text-sky-800 underline underline-offset-2 hover:text-sky-900">
              {children}
            </Link>
          ) : (
            <a
              href={href}
              target="_blank"
              rel="noreferrer nofollow"
              className="text-sky-800 underline underline-offset-2 hover:text-sky-900"
            >
              {children}
            </a>
          ),
        blockquote: ({ children }) => (
          <blockquote className="my-1.5 border-l-2 border-slate-200 pl-2 text-slate-500">{children}</blockquote>
        ),
        hr: () => <hr className="my-2 border-slate-200" />,
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b border-slate-200 px-1.5 py-1 text-left font-medium text-slate-500">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border-b border-slate-100 px-1.5 py-1 align-top text-slate-700">{children}</td>
        ),
      }}
    >
      {text}
    </Markdown>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <div className="mt-2.5 mb-1 text-[13px] font-semibold text-slate-800">{children}</div>;
}
