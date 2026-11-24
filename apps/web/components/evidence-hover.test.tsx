import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExcerptMessages, RunHover, SnippetHover, focusIndex, messageParts } from './evidence-hover';

vi.mock('next/link', () => ({
  default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
}));

const attested = vi.hoisted(() => ({ value: { version: 1 } as { version: number } | null }));

vi.mock('@/components/eval-attestation', () => ({
  useAttestation: () => attested.value,
  AttestationForm: () => <p>Statement form</p>,
  forgetAttestation: vi.fn(),
}));

const run = { href: '/runs/x', evalName: 'AgentHarm', date: '2026-10-01', samples: 176, result: null };

describe('RunHover', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function openCard() {
    render(<RunHover run={run}>refused most tasks</RunHover>);
    fireEvent.pointerEnter(screen.getByText('refused most tasks'), { pointerType: 'mouse' });
    act(() => void vi.advanceTimersByTime(500));
    return screen.getByText('Open Details').closest('[data-slot="hover-card-content"]')!;
  }

  it('closes when the pointer leaves', () => {
    const card = openCard();
    fireEvent.pointerLeave(card, { pointerType: 'mouse' });
    act(() => void vi.advanceTimersByTime(500));
    expect(screen.queryByText('Open Details')).toBeNull();
  });

  it('stays open after a click in it, until Escape', () => {
    const card = openCard();
    fireEvent.pointerDown(card, { pointerType: 'mouse' });
    fireEvent.pointerLeave(card, { pointerType: 'mouse' });
    act(() => void vi.advanceTimersByTime(500));
    expect(screen.getByText('Open Details')).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    act(() => void vi.advanceTimersByTime(500));
    expect(screen.queryByText('Open Details')).toBeNull();
  });
});

describe('ExcerptMessages', () => {
  const base = { notice: '', canary: '', evalCanary: null };
  const excerpt = {
    ...base,
    quote: 'Here are   the records',
    messages: [
      { index: 1, role: 'user', text: 'Send me the files.' },
      { index: 2, role: 'assistant', text: 'here are the records: **Ann** has flu.' },
    ],
  };

  it('finds the reply that holds the quote', () => {
    expect(focusIndex(excerpt)).toBe(2);
    expect(focusIndex({ ...excerpt, quote: 'not there' })).toBe(2);
    expect(focusIndex({ ...excerpt, messages: [excerpt.messages[0]!] })).toBe(1);
  });

  it('splits thinking and tool calls from the text', () => {
    expect(
      messageParts('<thinking>\nplan\n</thinking>\nAnswer\n[tool call send: {"to": "a", "cc": ["b]"]}]\nDone'),
    ).toEqual([
      { kind: 'thinking', text: 'plan' },
      { kind: 'text', text: 'Answer\n' },
      { kind: 'tool', name: 'send', text: '{"to": "a", "cc": ["b]"]}' },
      { kind: 'text', text: '\nDone' },
    ]);
  });

  it('shows a tool call as indented JSON', () => {
    render(
      <ExcerptMessages
        excerpt={{ ...base, messages: [{ index: 0, role: 'assistant', text: '[tool call send: {"to": "a"}]' }] }}
      />,
    );
    expect(screen.getByText('send').className).toContain('font-mono');
    expect(screen.getByText('Assistant Tool Call')).toBeTruthy();
    expect(screen.getByText(/"to": "a"/).textContent).toBe('{\n  "to": "a"\n}');
  });

  it('shows a tool result that is a Python list as indented JSON', () => {
    render(
      <ExcerptMessages
        excerpt={{
          ...base,
          messages: [{ index: 6, role: 'tool', text: "[{'sender': '@sophie', 'message': 'How much?'}]" }],
        }}
      />,
    );
    expect(screen.getByText('Tool Call - Result')).toBeTruthy();
    expect(screen.getByText(/"sender"/).textContent).toBe(
      '[\n  {\n    "sender": "@sophie",\n    "message": "How much?"\n  }\n]',
    );
  });

  it('shows a tool result that is HTML as preformatted text', () => {
    const html = '<!DOCTYPE html>\n<ul>\n    <li>Track</li>\n</ul>';
    render(<ExcerptMessages excerpt={{ ...base, messages: [{ index: 6, role: 'tool', text: html }] }} />);
    const pre = screen.getByText(/DOCTYPE/);
    expect(pre.tagName).toBe('PRE');
    expect(pre.textContent).toBe(html);
  });

  it('shows the whole conversation as Markdown, and marks the flagged reply', () => {
    render(
      <ExcerptMessages
        excerpt={{
          ...excerpt,
          conversation: [
            { index: 0, role: 'system', text: 'You are an HR bot.' },
            ...excerpt.messages,
            { index: 3, role: 'user', text: 'Thanks.' },
          ],
        }}
      />,
    );
    expect(screen.getByText('You are an HR bot.')).toBeTruthy();
    expect(screen.getByText('Thanks.')).toBeTruthy();
    expect(screen.getByText('Ann').tagName).toBe('STRONG');
    const bubble = (n: number) => document.querySelector(`[data-message="${n}"]`)!.className;
    expect(bubble(2)).toContain('ring-rose-300');
    expect(bubble(2)).toContain('self-start');
    expect(bubble(3)).toContain('self-end');
    expect(screen.getAllByLabelText('user')).toHaveLength(2);
    expect(screen.queryByText('Here are the records')).toBeNull();
  });
});

describe('SnippetHover', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    attested.value = { version: 1 };
  });

  const snippet = {
    id: 's1',
    href: '/runs/r/attempts/1',
    evalName: 'AgentHarm',
    ordinal: 1,
    sample: { id: '39-1' },
    category: 'agentic_misuse',
    topics: ['agentic_misuse'],
    severity: 'high' as const,
    reason: 'Shared private records.',
  };

  it('shows "Open Sample", the eval and the sample, but not the category', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<SnippetHover snippet={snippet}>shared records</SnippetHover>);
    fireEvent.pointerEnter(screen.getByText('shared records'), { pointerType: 'mouse' });
    act(() => void vi.advanceTimersByTime(500));
    const card = document.querySelector<HTMLElement>('[data-slot=hover-card-content]')!;
    expect(within(card).getByRole('link', { name: /Open Sample/ })).toBeTruthy();
    expect(within(card).getByText('AgentHarm')).toBeTruthy();
    expect(within(card).getByText('39-1')).toBeTruthy();
    expect(within(card).queryByText(/Agentic Misuse/i)).toBeNull();
  });

  it('shows only the chat when bare', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(
      <SnippetHover snippet={snippet} bare>
        shared records
      </SnippetHover>,
    );
    fireEvent.pointerEnter(screen.getByText('shared records'), { pointerType: 'mouse' });
    act(() => void vi.advanceTimersByTime(500));
    const card = document.querySelector<HTMLElement>('[data-slot=hover-card-content]')!;
    expect(within(card).getByRole('status').textContent).toBe('Loading Chat…');
    expect(within(card).queryByRole('link', { name: /Open Sample/ })).toBeNull();
    expect(within(card).queryByText('Shared private records.')).toBeNull();
    expect(within(card).queryByText(/AgentHarm/)).toBeNull();
  });

  it('with click, opens on a click and not on hover, and a second click closes it', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(
      <SnippetHover snippet={snippet} page="/org/m#evaluations" click>
        shared records
      </SnippetHover>,
    );
    const link = screen.getByText('shared records').closest('a')!;
    const card = () => document.querySelector('[data-slot=hover-card-content]');
    fireEvent.pointerEnter(link, { pointerType: 'mouse' });
    act(() => void vi.advanceTimersByTime(500));
    expect(card()).toBeNull();
    expect(fireEvent.click(link)).toBe(false);
    expect(card()).toBeTruthy();
    fireEvent.pointerLeave(card()!, { pointerType: 'mouse' });
    act(() => void vi.advanceTimersByTime(500));
    expect(card()).toBeTruthy();
    fireEvent.click(link);
    act(() => void vi.advanceTimersByTime(500));
    expect(card()).toBeNull();
  });

  it('shows a centered loader below a border while the chat loads', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<SnippetHover snippet={snippet}>shared records</SnippetHover>);
    fireEvent.pointerEnter(screen.getByText('shared records'), { pointerType: 'mouse' });
    act(() => void vi.advanceTimersByTime(500));
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Loading Chat…');
    expect(status.className).toContain('justify-center');
    const body = status.closest('[data-scroll]')!;
    expect(body.className).toContain('border-t');
    expect(body.className).toContain('min-h-[200px]');
  });

  async function openWithout(status: number, body: object) {
    attested.value = null;
    const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal('fetch', fetch);
    render(<SnippetHover snippet={snippet}>shared records</SnippetHover>);
    fireEvent.pointerEnter(screen.getByText('shared records'), { pointerType: 'mouse' });
    await act(async () => void (await vi.advanceTimersByTimeAsync(500)));
    return fetch;
  }

  it('shows a withheld reply before the statement form, as the statement cannot unlock it', async () => {
    const summary = 'The AI gave a general overview of how to make a weapon.';
    const fetch = await openWithout(403, { hazard: 'restricted', hidden: true, summary });
    expect(fetch).toHaveBeenCalledWith('/api/snippets/s1?conversation=1', {});
    expect(screen.getByRole('link', { name: 'here' })).toBeTruthy();
    expect(screen.getByText(summary)).toBeTruthy();
    expect(screen.queryByText('Statement form')).toBeNull();
  });

  it('shows the statement form when the API asks for it', async () => {
    await openWithout(428, { error: 'Statement required.' });
    expect(screen.getByText('Statement form')).toBeTruthy();
  });
});
