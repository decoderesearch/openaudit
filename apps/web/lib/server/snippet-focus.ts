import { prisma } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { SEVERITIES, type SnippetExcerpt, type SnippetSeverity } from '@/lib/openaudit-card';
import { focusIndex } from '@/lib/snippet-focus';

const select = { excerpt: true, title: true, reason: true, category: true, severity: true } as const;

/** A snippet of an attempt: the message it flags (by its number in the target's thread), its
 * title, summary and category. No id: the attempt's most severe snippet in a published card
 * version. Undefined: no such snippet of this attempt. */
export async function snippetFocus(
  snippetId: string | undefined,
  attemptId: string,
): Promise<
  { focus?: number; title: string | null; reason: string; category: string; severity?: SnippetSeverity } | undefined
> {
  let row;
  if (snippetId) {
    if (!isUuid(snippetId)) return undefined;
    row = await prisma.openAuditSnippet.findFirst({ where: { id: snippetId, attemptId }, select });
  } else {
    const rows = await prisma.openAuditSnippet.findMany({
      where: { attemptId, versions: { some: { version: { status: 'published' } } } },
      orderBy: { id: 'desc' },
      select,
    });
    const rank = (s: string) => {
      const i = SEVERITIES.indexOf(s as SnippetSeverity);
      return i < 0 ? SEVERITIES.length : i;
    };
    row = rows.sort((a, b) => rank(a.severity) - rank(b.severity))[0];
  }
  return row
    ? {
        focus: focusIndex(row.excerpt as SnippetExcerpt),
        title: row.title,
        reason: row.reason,
        category: row.category,
        ...(SEVERITIES.includes(row.severity as SnippetSeverity) && { severity: row.severity as SnippetSeverity }),
      }
    : undefined;
}
