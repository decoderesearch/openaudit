import { EvalCountsRow, parseModelSort, sortModels } from '@/components/catalog/model-list';
import { VERDICTS, type MeterJudge } from '@/lib/deploymeter';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const row = (id: string, openAudit: number, flagged: number, released?: string) => ({
  id,
  released,
  evals: { openAudit, systemCard: 0, flagged },
});

const rows = [
  row('old', 3, 5, '2025-01-01'),
  row('none', 0, 9),
  row('new', 2, 5, '2026-01-01'),
  row('quiet', 1, 0, '2026-06-01'),
];
const ids = (r: { id: string }[]) => r.map((x) => x.id);

describe('sortModels', () => {
  it('puts models with OpenAudit evals first, then the newest', () => {
    expect(ids(sortModels(rows, 'openaudit'))).toEqual(['quiet', 'new', 'old', 'none']);
  });

  it('puts the most flagged chats first; a tie keeps the OpenAudit order', () => {
    expect(ids(sortModels(rows, 'flagged'))).toEqual(['none', 'new', 'old', 'quiet']);
  });
});

describe('parseModelSort', () => {
  it('reads a known sort and falls back to openaudit', () => {
    expect(parseModelSort('flagged')).toBe('flagged');
    expect(parseModelSort('incidents')).toBe('openaudit');
    expect(parseModelSort(undefined)).toBe('openaudit');
  });
});

describe('EvalCountsRow', () => {
  const counts = { openAudit: 2, systemCard: 1, flagged: 3 };
  const meter = (deploymeter: number | null, hideNone = false, judges?: MeterJudge[]) =>
    render(<EvalCountsRow evals={{ ...counts, deploymeter, judges }} hideNone={hideNone} />).container
      .firstElementChild!.firstElementChild;
  const judges = [
    { name: 'Approver', score: 80 },
    { name: 'Rejecter A', score: 30 },
    { name: 'Rejecter B', score: 10 },
  ];

  it('puts the score first, in its verdict color, and no links', () => {
    const pill = meter(60)!;
    expect(pill.parentElement!.querySelector('a')).toBeNull();
    expect(pill.parentElement!.textContent).not.toContain('Self');
    expect(pill.textContent).toBe('60%Deploymeter: 60 of 100, Limited Deployment');
    expect(pill.getAttribute('title')).toMatch(/^Deploymeter: 60 of 100, Limited Deployment\nHow much AI judges trust/);
    expect(pill.getElementsByClassName(VERDICTS.limits.score)[0].textContent).toBe('60%');
    expect(meter(85)!.getElementsByClassName(VERDICTS.approve.score)[0].textContent).toBe('85%');
    expect(meter(20)!.getElementsByClassName(VERDICTS.reject.score)[0].textContent).toBe('20%');
    const stack = [...pill.nextElementSibling!.children].map((c) => c.getAttribute('title')!.split('\n'));
    expect(stack.map((t) => t[0])).toEqual(['3 Flagged Chats', '2 OpenAudits']);
    expect(stack.every((t) => t[1].length > 0)).toBe(true);
  });

  it('shows the votes as a bar, red then amber then emerald, with no part for no votes', () => {
    const bar = meter(40, false, judges)!.querySelector('.rounded-full')!;
    expect([...bar.children].map((c) => [c.className, (c as HTMLElement).style.flexGrow])).toEqual([
      [VERDICTS.reject.bar, '2'],
      [VERDICTS.approve.bar, '1'],
    ]);
    expect(meter(null)!.querySelector('.rounded-full')!.children).toHaveLength(0);
  });

  it('shows the judges of each verdict on hover, with their scores', async () => {
    const pill = meter(40, false, judges)!;
    expect(pill.getAttribute('title')).toBeNull();
    fireEvent.pointerEnter(pill.firstElementChild!, { pointerType: 'mouse' });
    fireEvent.focus(pill.firstElementChild!);
    const card = (await screen.findByText('Deploymeter ratings')).parentElement!;
    const columns = [...card.querySelectorAll('.grid > div')].map((c) => c.textContent);
    expect(columns).toEqual([
      'Disapprove – 2 JudgesRejecter A30%Rejecter B10%',
      'Limited – 0 JudgesNone',
      'Approve – 1 JudgeApprover80%',
    ]);
  });

  it('shows a grey dash with no published panel, and an empty space with hideNone', () => {
    expect(meter(null)!.getAttribute('title')).toMatch(/^No Deploymeter score\n/);
    expect(meter(null)!.textContent).toContain('–No Deploymeter score');
    expect(meter(null, true)!.textContent).toBe('');
    expect(meter(null, true)!.nextElementSibling!.firstElementChild!.getAttribute('title')).toMatch(
      /^3 Flagged Chats\n/,
    );
  });
});
