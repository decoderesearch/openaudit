import { LINK, RunHover, SnippetHover, type RunRef, type SnippetRef } from '@/components/evidence-hover';
import { PdfCite, type PdfTarget } from '@/components/pdf-viewer';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const EVIDENCE = /^(snippet|run|cite):(.+)$/;

/**
 * Markdown whose `[text](snippet:<id>)` and `[text](run:<id>)` links show the snippet or the run
 * on hover, and whose `[text](cite:<id>)` links open the system card page. A link to an id that
 * is not in `snippets`, `runs` or `cites` shows as plain text. `inline`: no paragraph around the
 * text, for a list item.
 */
export function EvidenceMarkdown({
  text,
  snippets,
  runs,
  cites,
  inline,
}: {
  text: string;
  snippets: Map<string, SnippetRef>;
  runs: Map<string, RunRef>;
  cites?: Map<string, PdfTarget>;
  inline?: boolean;
}) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      urlTransform={(url) => (EVIDENCE.test(url) ? url : defaultUrlTransform(url))}
      components={{
        ...(inline && { p: ({ children }) => <>{children}</> }),
        a: ({ href = '', children }) => {
          const m = EVIDENCE.exec(href);
          if (!m)
            return (
              <a href={href} target="_blank" rel="noreferrer nofollow" className="text-sky-800 hover:underline">
                {children}
              </a>
            );
          const snippet = m[1] === 'snippet' ? snippets.get(m[2]) : undefined;
          const run = m[1] === 'run' ? runs.get(m[2]) : undefined;
          const cite = m[1] === 'cite' ? cites?.get(m[2]) : undefined;
          if (snippet) return <SnippetHover snippet={snippet}>{children}</SnippetHover>;
          if (run) return <RunHover run={run}>{children}</RunHover>;
          if (cite)
            return (
              <PdfCite target={cite}>
                <span className={LINK}>{children}</span>
              </PdfCite>
            );
          return <>{children}</>;
        },
      }}
    >
      {text}
    </Markdown>
  );
}
