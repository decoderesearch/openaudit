import { PdfViewerProvider } from '@/components/pdf-viewer';
import type { CardSummary } from '@/lib/openaudit-card';
import type { CardView } from '@/lib/server/catalog';
import type { OpenAuditCardView } from '@/lib/server/openaudit-cards';
import type { Topic } from '@openaudit/spec';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardVersionNotice, OpenAuditCardBody, systemTopics, titleLabel } from './openaudit-card';

vi.mock('@/lib/db', () => ({ prisma: { eval: { findMany: async () => [] } } }));
vi.mock('@/components/cards/review-card-buttons', () => ({ ReviewCardButtons: () => null }));
vi.mock('@/components/catalog/openaudit-card-client', () => ({
  VersionHistory: () => null,
  TopicSnippets: ({ snippets }: { snippets: unknown[] }) => <span>flagged: {snippets.length}</span>,
  TopicRuns: ({ runs, results }: { runs: { evalName: string }[]; results: { name: string }[] }) => (
    <>
      <span>runs: {runs.map((r) => r.evalName).join(', ')}</span>
      <span>system results: {results.map((r) => r.name).join(', ')}</span>
    </>
  ),
}));

function card(summary: CardSummary | null): OpenAuditCardView {
  return {
    versions: [],
    version: {
      id: 'v1',
      number: 1,
      status: 'published',
      createdAt: new Date('2026-10-01'),
      aggregator: 'm',
      promptVersion: 'card-4',
      costUsd: null,
      summary,
      findings: [{ text: 'Refuses most safe prompts.', tone: 'bad', runIds: [], snippetIds: [] }],
      verdicts: [],
      topics: [],
      gaps: [],
    },
    latest: 1,
    runs: [],
    snippets: [],
    cites: {},
  } as unknown as OpenAuditCardView;
}

const SUMMARY = {
  concerns: ['Refuses many safe prompts.'],
  strengths: ['Hidden.'],
  unknowns: ['No child safety eval.'],
};
const part = (key: string) => document.querySelector<HTMLElement>(`[data-summary-part="${key}"]`)!;

describe('OpenAuditCardBody', () => {
  it('shows the executive summary first, with a toggle of Findings and Unknown, without the strengths or the audit', () => {
    render(<OpenAuditCardBody card={card(SUMMARY)} />);
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings.indexOf('Audit Summary')).toBeLessThan(headings.indexOf('Notable Findings'));
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Findings', 'Unknown']);
    expect(within(part('concerns')).getByText('Refuses many safe prompts.')).toBeTruthy();
    expect(part('concerns').hidden).toBe(false);
    expect(part('unknowns').hidden).toBe(true);
    fireEvent.click(screen.getByRole('tab', { name: 'Unknown' }));
    expect(part('concerns').hidden).toBe(true);
    expect(within(part('unknowns')).getByText('No child safety eval.')).toBeTruthy();
    expect(screen.queryByText('Hidden.')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Self Evaluation Audit' })).toBeNull();
  });

  it('shows the Deploymeter as the first column of the summary', () => {
    render(<OpenAuditCardBody card={card(SUMMARY)} deploymeter={<p>The meter.</p>} />);
    const meter = screen.getByText('The meter.');
    expect(meter.compareDocumentPosition(part('concerns')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(meter.parentElement!.contains(part('concerns'))).toBe(true);
  });

  it('shows the incidents row in the executive summary, below the parts', () => {
    render(<OpenAuditCardBody card={card(SUMMARY)} incidents={<p>An incident.</p>} />);
    const row = screen.getByText('An incident.');
    expect(part('unknowns').compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Audit Summary' }).closest('section')?.contains(row)).toBe(true);
  });

  it('marks the summary bar when the model came out after most of the evals', () => {
    render(<OpenAuditCardBody card={card(SUMMARY)} />);
    expect(screen.queryByText(/Outdated Evaluations/)).toBeNull();
    cleanup();
    render(<OpenAuditCardBody card={card(SUMMARY)} outdated={{ evals: 12, older: 9 }} />);
    const title = screen.getByRole('heading', { name: 'Audit Summary' }).parentElement!;
    expect(title.className).toContain('bg-slate-50');
    const note = title.nextElementSibling!;
    expect(note.className).toContain('bg-rose-50');
    expect(note.textContent).toBe(
      'Outdated Evaluations: 9 of 12 evaluations were older than this model, so positive results are not reliable.',
    );
  });

  it('gives the summary to the Evaluations section, with the notable findings after it', () => {
    render(
      <OpenAuditCardBody
        card={card(SUMMARY)}
        evaluations={(topics, summary) => (
          <div data-testid="evaluations">
            {summary}
            {topics}
          </div>
        )}
      />,
    );
    const section = screen.getByTestId('evaluations');
    expect(within(section).getByRole('heading', { name: 'Audit Summary' })).toBeTruthy();
    expect(within(section).getByText('Evaluation Topics')).toBeTruthy();
    const notable = screen.getByRole('heading', { name: 'Notable Findings' });
    expect(section.compareDocumentPosition(notable) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the category label of an item in bold', () => {
    render(<OpenAuditCardBody card={card({ ...SUMMARY, concerns: ['**Deception:** The model lied.'] })} />);
    const label = within(part('concerns')).getByText('Deception:');
    expect(label.tagName).toBe('STRONG');
    expect(label.parentElement?.textContent).toBe('Deception: The model lied.');
  });

  it.each([
    ['**Shutdown evasion:** x', '**Shutdown Evasion:** x'],
    ['**Bio and chem:** x', '**Bio and Chem:** x'],
    ['**Self-harm in agents:** x', '**Self-Harm in Agents:** x'],
    ['**CBRN uplift:** x', '**CBRN Uplift:** x'],
    ['No label, **bold** later.', 'No label, **bold** later.'],
  ])('title-cases the label of %s', (item, want) => {
    expect(titleLabel(item)).toBe(want);
  });

  it.each([
    ['an older published version', 'published', 3, true],
    ['the latest version', 'published', 1, false],
    ['a draft', 'draft', 1, false],
  ] as const)('warns on a version that is not the latest only for %s', async (_, status, latest, warns) => {
    const c = card(SUMMARY);
    c.version.status = status;
    c.latest = latest;
    render(<CardVersionNotice model={{ name: 'org/m', displayName: 'M' }} card={c} />);
    const link = screen.queryByRole('link', { name: /View Latest Version/ });
    expect(!!link).toBe(warns);
    if (link) expect(link.getAttribute('href')).toBe('/org/m');
  });

  it('shows a tone dot on each topic and no Notable Findings in a version without findings', () => {
    const c = card(SUMMARY);
    c.version.findings = [];
    c.version.topics = [
      { topic: 'honesty', coverage: 'some', summary: 'Rarely lies.', tone: 'good', runIds: [] },
      { topic: 'toxicity', coverage: 'none', summary: null, tone: null, runIds: [] },
    ];
    render(<OpenAuditCardBody card={c} />);
    expect(screen.queryByRole('heading', { name: /Notable Findings/ })).toBeNull();
    expect(screen.getByRole('img', { name: 'Good for safety' })).toBeTruthy();
    const dot = screen.getByRole('img', { name: 'Not covered' });
    expect(dot.className).toContain('bg-slate-300');
    expect(screen.queryByText('No evaluation runs performed.')).toBeNull();
    expect(screen.queryByText('System Card')).toBeNull();
  });

  it('counts the flagged chats of each topic: by category, and by the setting topics of the eval', () => {
    const c = card(SUMMARY);
    const topic = (t: string) => ({ topic: t, coverage: 'some', summary: `${t} summary`, tone: 'mixed', runIds: [] });
    c.version.topics = [topic('honesty'), topic('jailbreaks'), topic('harmful_requests'), topic('toxicity')] as never;
    const snippet = (category: string, topics: string[]) => ({
      id: category,
      runId: '01a0fbeb-508b-7948-9d44-aa1df1bf991d',
      ordinal: 1,
      category,
      severity: 'low',
      reason: 'x',
      eval: { displayName: 'E', topics },
    });
    c.snippets = [
      snippet('honesty', ['honesty']),
      snippet('honesty', ['honesty', 'jailbreaks']),
      snippet('bio_chem', ['harmful_requests', 'jailbreaks', 'bio_chem']),
    ] as unknown as OpenAuditCardView['snippets'];
    c.version.topics[0]!.runIds = ['01a0fbeb-508b-7948-9d44-aa1df1bf991d', 'gone'];
    c.runs = [
      {
        run: {
          id: '01a0fbeb-508b-7948-9d44-aa1df1bf991d',
          createdAt: '2026-10-01T00:00:00Z',
          attemptCount: 5,
          settings: {},
          route: {},
        },
        eval: { displayName: 'MASK', status: 'active' },
        limited: false,
        result: null,
      },
    ] as unknown as OpenAuditCardView['runs'];
    render(<OpenAuditCardBody card={c} />);
    const item = (t: string) => screen.getByText(`${t} summary`).closest('li')!;
    expect(within(item('honesty')).getByText('flagged: 2')).toBeTruthy();
    expect(within(item('honesty')).getByText('runs: MASK')).toBeTruthy();
    expect(within(item('jailbreaks')).getByText('flagged: 2')).toBeTruthy();
    expect(within(item('jailbreaks')).getByText('runs:')).toBeTruthy();
    expect(within(item('harmful_requests')).getByText('flagged: 0')).toBeTruthy();
    expect(within(item('toxicity')).getByText('flagged: 0')).toBeTruthy();
  });

  it('does not show the bias topic', () => {
    const c = card(SUMMARY);
    c.version.topics = [
      { topic: 'honesty', coverage: 'some', summary: 'Rarely lies.', tone: 'good', runIds: [] },
      { topic: 'bias', coverage: 'some', summary: 'Some bias.', tone: 'mixed', runIds: [] },
    ];
    render(<OpenAuditCardBody card={c} />);
    expect(screen.getByText('Rarely lies.')).toBeTruthy();
    expect(screen.queryByText('Some bias.')).toBeNull();
  });

  it('takes each topic from the newest system card that covers it', () => {
    const source = (key: string, date: string, topics: CardView['topics']) =>
      ({
        document: { key, kind: 'system_card', publishedDate: date, fileType: 'html' },
        topics,
        findings: [],
        riskDecisions: [],
        testers: [],
        disclosures: {},
        results: [],
      }) as unknown as CardView;
    const topics = systemTopics({ name: 'org/m' }, [
      source('new', '2026-09', [{ topic: 'honesty', covered: false }]),
      source('old', '2026-03', [{ topic: 'honesty', covered: true, headline: 'Old claim' }]),
    ]);
    expect(topics.honesty).toMatchObject({ covered: true, headline: 'Old claim', tag: 'Mar 2026' });
    expect(topics.honesty?.run.anchor).toBe('org/m@old');
  });

  it('gives each topic the system card results of the evals that test it', () => {
    const result = (id: string, evalId: string | undefined, rawEvalName: string, page: string) => ({
      id,
      evalId,
      rawEvalName,
      metric: 'safe',
      value: 0.9,
      unit: 'fraction',
      safetyDirection: 'higher',
      settings: { reasoningEffort: 'high' },
      source: { page, quote: 'q' },
    });
    const source = {
      document: { key: 'sc', kind: 'system_card', publishedDate: '2026-09', fileType: 'pdf' },
      topics: [{ topic: 'honesty', covered: true, headline: 'Few lies' }],
      findings: [],
      riskDecisions: [],
      testers: [],
      disclosures: {},
      results: [
        result('r1', 'e1', 'MASK (n=1000)', '12'),
        result('r2', 'e2', 'StrongREJECT', '14'),
        result('r3', undefined, 'Own test', '15'),
      ],
    } as unknown as CardView;
    const evals = new Map([
      ['e1', { displayName: 'MASK', topics: ['honesty', 'sycophancy'] as Topic[] }],
      ['e2', { displayName: 'StrongREJECT', topics: ['jailbreaks'] as Topic[] }],
    ]);
    const topics = systemTopics({ name: 'org/m' }, [source], evals);
    expect(topics.honesty?.results.map((r) => r.name)).toEqual(['MASK (n=1000)']);
    expect(topics.honesty?.results[0]).toMatchObject({
      details: expect.stringContaining('high'),
      source: { page: '12' },
    });
    expect(topics.sycophancy).toMatchObject({ covered: false, results: [{ name: 'MASK (n=1000)' }] });
    expect(topics.jailbreaks?.results.map((r) => r.name)).toEqual(['StrongREJECT']);
  });

  it('shows the pills below the title, then our summary, then what the system card states', () => {
    const c = card(SUMMARY);
    c.version.topics = [
      { topic: 'honesty', coverage: 'some', summary: 'Rarely lies.', tone: 'good', runIds: [] },
      { topic: 'toxicity', coverage: 'some', summary: 'Some toxicity.', tone: 'mixed', runIds: [] },
    ];
    const run = { anchor: 'org/m@sc', slugs: [] };
    render(
      <PdfViewerProvider>
        <OpenAuditCardBody
          card={c}
          system={{
            honesty: {
              covered: true,
              headline: '2% lies on MASK',
              source: { page: '12', quote: '2% of answers' },
              run,
              results: [{ name: 'MASK', result: { metric: 'honest', value: 0.98 } }],
            },
            toxicity: { covered: false, run, results: [] },
          }}
        />
      </PdfViewerProvider>,
    );
    const honesty = screen.getByText('Rarely lies.').closest('li')!;
    expect(within(honesty).queryByText(/^(OpenAudit|System Card)$/)).toBeNull();
    const order = within(honesty).getAllByText(/flagged:|^runs:|system results:|Rarely lies|2% lies/);
    expect(order.map((p) => p.textContent!.trim())).toEqual([
      'flagged: 0',
      'runs:',
      'system results: MASK',
      'Rarely lies.',
      '2% lies on MASK',
    ]);
    const toxicity = screen.getByText('Some toxicity.').closest('li')!;
    expect(within(toxicity).queryByText(/does not cover/)).toBeNull();
    expect(within(toxicity).getByText('system results:')).toBeTruthy();
  });

  it('shows only the summary from card-18, which also tells what the system card reports', () => {
    const c = card(SUMMARY);
    c.version.promptVersion = 'card-18';
    c.version.topics = [{ topic: 'honesty', coverage: 'some', summary: 'Rarely lies.', tone: 'good', runIds: [] }];
    const run = { anchor: 'org/m@sc', slugs: [] };
    render(
      <PdfViewerProvider>
        <OpenAuditCardBody
          card={c}
          system={{
            honesty: {
              covered: true,
              headline: '2% lies on MASK',
              run,
              results: [{ name: 'MASK', result: { metric: 'honest', value: 0.98 } }],
            },
          }}
        />
      </PdfViewerProvider>,
    );
    const honesty = screen.getByText('Rarely lies.').closest('li')!;
    expect(within(honesty).queryByText('2% lies on MASK')).toBeNull();
    expect(within(honesty).getByText('system results: MASK')).toBeTruthy();
  });

  it('links summary items to their snippets and runs', () => {
    const c = card({
      concerns: [
        'It [blackmailed](snippet:01a0fdbf-ec73-7ef0-a110-a60a4953e75f) and [lied](run:01a0fbeb-508b-7948-9d44-aa1df1bf991d), [here](run:nope).',
      ],
      strengths: [],
      unknowns: ['x'],
    });
    c.snippets = [
      {
        id: '01a0fdbf-ec73-7ef0-a110-a60a4953e75f',
        runId: '01a0fbeb-508b-7948-9d44-aa1df1bf991d',
        ordinal: 3,
        category: 'deception',
        severity: 'high',
        reason: 'Lies.',
        eval: { displayName: 'E' },
      },
    ] as unknown as OpenAuditCardView['snippets'];
    c.runs = [
      {
        run: {
          id: '01a0fbeb-508b-7948-9d44-aa1df1bf991d',
          createdAt: '2026-10-01T00:00:00Z',
          attemptCount: 50,
          settings: {},
          route: {},
        },
        eval: { displayName: 'E', status: 'active' },
        limited: false,
        result: null,
      },
    ] as unknown as OpenAuditCardView['runs'];
    render(<OpenAuditCardBody card={c} />);
    expect(screen.getByRole('link', { name: 'blackmailed' }).getAttribute('href')).toMatch(
      /\/attempts\/3\?snippet=[\w-]+$/,
    );
    expect(screen.getByRole('link', { name: 'lied' }).getAttribute('href')).toMatch(/^\/runs\//);
    expect(screen.queryByRole('link', { name: 'here' })).toBeNull();
    expect(screen.getByRole('link', { name: 'lied' }).closest('li')!.textContent).toContain(', here.');
  });

  it('shows an older Markdown summary as Markdown', () => {
    render(<OpenAuditCardBody card={card('- **Missing:** No child safety eval.')} />);
    expect(screen.getByText('Missing:').tagName).toBe('STRONG');
    expect(screen.queryByRole('tab', { name: 'Findings' })).toBeNull();
  });

  it('does not show the Safety Frameworks for now', () => {
    render(<OpenAuditCardBody card={card(null)} />);
    expect(screen.queryByRole('heading', { name: 'Audit Summary' })).toBeNull();
    expect(screen.queryByText(/Safety Framework/)).toBeNull();
    cleanup();
    render(<OpenAuditCardBody card={card(SUMMARY)} />);
    expect(screen.queryByRole('button', { name: 'Safety Frameworks' })).toBeNull();
  });
});
