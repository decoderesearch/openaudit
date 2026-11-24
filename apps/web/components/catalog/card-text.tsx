'use client';

import { EvalLink } from '@/components/eval-link';
import Link from '@/components/link';
import { evalSlugOf } from '@/lib/eval-links';
import type { MouseEvent } from 'react';

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const LINK_CLASS = 'relative z-10 text-sky-800 underline underline-offset-2 hover:text-sky-900';

/** A link click must not also open the source (the text around it opens the PDF viewer). */
const stop = (e: MouseEvent) => e.stopPropagation();

export type Run = { anchor: string; slugs: string[] };

/** Splits card text into plain parts and `[label](url)` links, the only Markdown we use. */
export function parseLinks(text: string): (string | { label: string; url: string })[] {
  const parts: (string | { label: string; url: string })[] = [];
  let at = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index > at) parts.push(text.slice(at, m.index));
    parts.push({ label: m[1]!, url: m[2]! });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}

/**
 * A finding, verdict or topic headline. A link to an eval that has results for this card's model
 * points at those results (`run`); other links stay as they are.
 */
export function CardText({ text, run }: { text: string; run?: Run }) {
  return parseLinks(text).map((p, i) => {
    if (typeof p === 'string') return p;
    if (p.url.startsWith('/')) {
      // The extracted text links evals as `/evals/<slug>`.
      const url = p.url.replace(/^\/evals(?=[/?#]|$)/, '/evaluations');
      const slug = url.match(/^\/evaluations\/([^/#?]+)$/)?.[1];
      const href = slug && run?.slugs.includes(slug) ? `${url}#${run.anchor}` : url;
      const hover = evalSlugOf(url);
      if (hover)
        return (
          <EvalLink key={i} slug={hover} href={href} onClick={stop} className={LINK_CLASS}>
            {p.label}
          </EvalLink>
        );
      return (
        <Link key={i} href={href} onClick={stop} className={LINK_CLASS}>
          {p.label}
        </Link>
      );
    }
    return (
      <a key={i} href={p.url} target="_blank" rel="noreferrer nofollow" onClick={stop} className={LINK_CLASS}>
        {p.label}
      </a>
    );
  });
}
