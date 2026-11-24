// Splits a document title into its type ("System Card") and its name ("Claude Opus 5.5"), for
// page headings. Titles come from many labs, so this only removes common patterns.

const KIND: Record<string, string> = {
  system_card: 'System Card',
  safety_report: 'Safety Report',
  technical_report: 'Technical Report',
  model_page: 'Model Page',
  blog: 'Blog Post',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

/** "Sept 2026" from "2026-09-22"; the year only when there is no month. */
export function monthYear(date?: string | null) {
  if (!date) return undefined;
  const [year, month] = date.split('-');
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
}

/** The title less file notes such as "(PDF)", "(PDF, Sept 2024)" and "(Mistral Docs)". */
export function plainTitle(title: string) {
  return title.replace(/\s*\((?:PDF|[^)]*\bDocs)\b[^)]*\)/gi, '');
}

export function cardHeading(d: { title: string; kind: string; publishedDate?: string | null }) {
  let eyebrow = KIND[d.kind] ?? 'Document';
  let title = plainTitle(d.title);
  let m: RegExpMatchArray | null;
  if ((m = title.match(/^(System|Model) Card Addendum:\s*(.+)$/i))) {
    eyebrow = `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} Card Addendum`;
    title = m[2];
  } else if ((m = title.match(/^(.+?)\s+(System|Model) Card Addendum(\s*\([^)]*\))?$/i))) {
    eyebrow = `${m[2][0].toUpperCase()}${m[2].slice(1).toLowerCase()} Card Addendum`;
    title = m[1] + (m[3] ?? '');
  } else if ((m = title.match(/^(Addendum|Update) to (.+?) system card:?\s*(.*)$/i))) {
    eyebrow = `${m[1]} to ${m[2]} System Card`;
    title = m[3] || m[2];
  } else {
    if (d.kind === 'system_card' && /\bmodel card\b/i.test(title)) eyebrow = 'Model Card';
    // Only remove the phrase where it labels the whole title, so "Model Card and Evaluations for
    // Claude Models" stays whole.
    title = title
      .replace(/^(?:system|model) card:\s*/i, '')
      .replace(/\s*\((?:system|model) card\)/i, '')
      .replace(/^(.+?)\s+(?:system|model) card([:,])\s*/i, '$1$2 ')
      .replace(/(?<!\band\s*)\s*(?:[-–:]\s*)?\b(?:system|model) card(?=\s*(?:\([^)]*\))?$)/i, '');
    if (d.kind === 'technical_report') title = title.replace(/\s+technical report$/i, '');
  }
  title = title.replace(/\s+/g, ' ').trim();
  return { eyebrow, title: title || d.title, date: monthYear(d.publishedDate) };
}

/** What this type of document is, for a help popover. */
export function aboutDocument(kind: string, eyebrow: string) {
  if (/addendum/i.test(eyebrow))
    return 'An addendum adds to an earlier system card, often for a new variant or use of the model.';
  if (eyebrow === 'Model Card')
    return 'A model card is a short report an organization publishes with a model: what the model is for, how it was trained and tested, and its limits.';
  return (
    {
      system_card:
        'A system card is a report an organization publishes with a model: what the model can do, how the organization tested it for safety, and which risks it found.',
      technical_report:
        'A technical report tells how a model was built and evaluated: its design, training and benchmark results. It often says less about safety than a system card.',
      safety_report:
        'A safety report describes safety tests of a model, sometimes by a group outside the organization that made the model.',
      model_page:
        'A model page is a short page about a model: its specs and uses. It is not a system card and reports no safety tests.',
      blog: 'A blog post that announces a model and its results.',
    }[kind] ?? 'A document about a model.'
  );
}
