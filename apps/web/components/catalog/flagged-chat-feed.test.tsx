import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlaggedChatFeed } from './flagged-chat-feed';
import { FlaggedTopicProvider } from './flagged-topic';
import { TopicSnippets, type SnippetView } from './openaudit-card-client';

const query = vi.hoisted(() => ({ value: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/qwen/qwen3',
  useSearchParams: () => new URLSearchParams(query.value),
}));

// Neuronpedia lists only DeepSeek-V4-Flash, with a 2,048-token limit. `loads`: the renders that asked for the list.
const jlens = vi.hoisted(() => ({ loads: 0 }));
vi.mock('@/lib/jlens-models', () => ({
  useJlensModels: (load = true) => {
    if (!load) return undefined;
    jlens.loads++;
    return [
      {
        id: 'deepseek-v4-flash',
        label: 'Deepseek-V4-Flash',
        hfRepoId: 'deepseek-ai/DeepSeek-V4-Flash',
        tokenLimit: 2048,
        lensColumns: ['JACOBIAN_LENS'],
        thinkTags: true,
      },
    ];
  },
}));

// jsdom has no layout: the list's scroll box is 600 px tall, and each row 50 px.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(50);
});

afterEach(() => {
  vi.restoreAllMocks();
  jlens.loads = 0;
  query.value = '';
  history.replaceState(null, '', '/');
});

const snippet = (
  id: string,
  severity: SnippetView['severity'],
  date: string,
  title: string,
  topics = ['honesty'],
  evalName = 'E',
) =>
  ({
    id,
    href: `/runs/r/attempts/${id}`,
    evalName,
    ordinal: 1,
    sample: { id: '39-1' },
    category: 'honesty',
    topics,
    severity,
    title,
    reason: `${id} reason`,
    date,
  }) satisfies SnippetView;

const SNIPPETS = [
  snippet('old-high', 'high', '2026-09-01T00:00:00Z', 'Shutdown evasion'),
  snippet('new-high', 'high', '2026-09-20T00:00:00Z', 'Sycophancy', ['honesty', 'sycophancy']),
  snippet('critical', 'critical', '2026-08-01T00:00:00Z', 'Shutdown evasion'),
  snippet('mid', 'medium', '2026-10-02T00:00:00Z', 'Shutdown evasion'),
  snippet('low', 'low', '2026-10-05T00:00:00Z', 'Sycophancy', ['sycophancy'], 'F'),
];

const reasons = () => screen.queryAllByText(/ reason$/).map((p) => p.textContent);
const trigger = () => screen.getByRole('button', { name: /^Topic: / });
const evalTrigger = () => screen.getByRole('button', { name: /^Evaluation: / });
const openMenu = (button = trigger()) => fireEvent.keyDown(button, { key: 'Enter' });

describe('FlaggedChatFeed', () => {
  it('shows all chats, the most severe first, then the newest', () => {
    render(<FlaggedChatFeed snippets={SNIPPETS} />);
    expect(screen.getByRole('heading', { name: 'Flagged Chats' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Severity: / })).toBeNull();
    expect(trigger().textContent).toBe('Topics');
    expect(evalTrigger().textContent).toBe('Evaluations');
    expect(reasons()).toEqual(['critical reason', 'new-high reason', 'old-high reason', 'mid reason', 'low reason']);
  });

  it('lists each topic with its count, the most chats first', async () => {
    render(<FlaggedChatFeed snippets={SNIPPETS} />);
    openMenu();
    const items = await screen.findAllByRole('menuitemradio');
    expect(items.map((o) => o.textContent)).toEqual(['All Topics', 'Honesty4', 'Sycophancy2']);
  });

  it('filters by topic', async () => {
    render(<FlaggedChatFeed snippets={SNIPPETS} />);
    openMenu();
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Sycophancy 2' }));
    expect(reasons()).toEqual(['new-high reason', 'low reason']);
    expect(trigger().textContent).toBe('Sycophancy');
    expect(screen.getByText('Showing 2 of 5 Chats')).toBeTruthy();
  });

  it("filters by eval, with each menu's counts from the other filter, and clears both", async () => {
    render(<FlaggedChatFeed snippets={SNIPPETS} />);
    openMenu(evalTrigger());
    expect((await screen.findAllByRole('menuitemradio')).map((o) => o.textContent)).toEqual([
      'All Evaluations',
      'E4',
      'F1',
    ]);
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'F 1' }));
    expect(reasons()).toEqual(['low reason']);
    openMenu();
    expect((await screen.findAllByRole('menuitemradio')).map((o) => o.textContent)).toEqual([
      'All Topics',
      'Sycophancy1',
    ]);
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Sycophancy 1' }));
    expect(screen.getByText('Showing 1 of 5 Chats')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(reasons()).toHaveLength(5);
    expect(trigger().textContent).toBe('Topics');
    expect(evalTrigger().textContent).toBe('Evaluations');
    expect(screen.queryByRole('button', { name: 'Clear Filters' })).toBeNull();
  });

  it("filters by a topic pill's topic, and shows all again on a second click", () => {
    render(
      <FlaggedTopicProvider>
        <TopicSnippets snippets={SNIPPETS.filter((s) => s.topics.includes('sycophancy'))} topic="sycophancy" />
        <FlaggedChatFeed snippets={SNIPPETS} />
      </FlaggedTopicProvider>,
    );
    const pill = screen.getByRole('button', { name: '1 Flagged Chat High/Mid Severity' });
    expect(screen.queryByRole('button', { name: 'Clear Filters' })).toBeNull();
    fireEvent.click(pill);
    expect(pill.getAttribute('aria-pressed')).toBe('true');
    expect(reasons()).toEqual(['new-high reason', 'low reason']);
    expect(trigger().textContent).toBe('Sycophancy');
    fireEvent.click(pill);
    expect(reasons()).toHaveLength(5);
    expect(trigger().textContent).toBe('Topics');
    fireEvent.click(pill);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(reasons()).toHaveLength(5);
    expect(pill.getAttribute('aria-pressed')).toBe('false');
  });

  it("filters by an eval pill's eval only, and a topic pill then shows its topic only", () => {
    render(
      <FlaggedTopicProvider>
        <TopicSnippets snippets={SNIPPETS.filter((s) => s.evalName === 'F')} evalName="F" />
        <TopicSnippets snippets={SNIPPETS.filter((s) => s.topics.includes('sycophancy'))} topic="sycophancy" />
        <FlaggedChatFeed snippets={SNIPPETS} />
      </FlaggedTopicProvider>,
    );
    const evalPill = screen.getByRole('button', { name: '1 Flagged Chat Low Severity' });
    const topicPill = screen.getByRole('button', { name: '1 Flagged Chat High/Mid Severity' });
    fireEvent.click(evalPill);
    expect(evalPill.getAttribute('aria-pressed')).toBe('true');
    expect(reasons()).toEqual(['low reason']);
    expect(evalTrigger().textContent).toBe('F');
    fireEvent.click(topicPill);
    expect(evalPill.getAttribute('aria-pressed')).toBe('false');
    expect(reasons()).toEqual(['new-high reason', 'low reason']);
    expect(evalTrigger().textContent).toBe('Evaluations');
    fireEvent.click(evalPill);
    fireEvent.click(evalPill);
    expect(reasons()).toHaveLength(5);
  });

  it('puts the chats that the reader can open first in each level, with a lock on the others', () => {
    const locked = { ...SNIPPETS[2]!, locked: true };
    render(<FlaggedChatFeed snippets={[locked, ...SNIPPETS.slice(0, 2), ...SNIPPETS.slice(3)]} />);
    expect(reasons()).toEqual(['new-high reason', 'old-high reason', 'critical reason', 'mid reason', 'low reason']);
    expect(screen.getAllByLabelText('Restricted')).toHaveLength(1);
  });

  describe('Debuggable via Neuronpedia', () => {
    const DEEPSEEK = ['deepseek-ai/DeepSeek-V4-Flash-0731'];
    const sized = [
      { ...SNIPPETS[0]!, tokens: 1500 },
      { ...SNIPPETS[1]!, tokens: 2809 },
      { ...SNIPPETS[2]!, tokens: 300, locked: true },
      { ...SNIPPETS[3]!, tokens: null },
      { ...SNIPPETS[4]!, tokens: 2048 },
    ];

    it('is the last topic, below a line, and loads the J-Lens models only when the menu opens', async () => {
      render(<FlaggedChatFeed snippets={sized} jlensNames={DEEPSEEK} />);
      expect(jlens.loads).toBe(0);
      openMenu();
      const items = await screen.findAllByRole('menuitemradio');
      expect(items.map((o) => o.textContent)).toEqual([
        'All Topics',
        'Honesty4',
        'Sycophancy2',
        'Debuggable via Neuronpedia2',
      ]);
      expect(screen.getByRole('separator')).toBeTruthy();
      expect(jlens.loads).toBeGreaterThan(0);
    });

    it('shows the open chats whose transcript likely fits the J-Lens token limit', async () => {
      render(<FlaggedChatFeed snippets={sized} jlensNames={DEEPSEEK} />);
      openMenu();
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Debuggable via Neuronpedia 2' }));
      expect(reasons()).toEqual(['old-high reason', 'low reason']);
      expect(trigger().textContent).toBe('Debuggable via Neuronpedia');
    });

    it('is not there without the model names', async () => {
      render(<FlaggedChatFeed snippets={sized} />);
      openMenu();
      expect((await screen.findAllByRole('menuitemradio')).map((o) => o.textContent)).not.toContain(
        'Debuggable via Neuronpedia2',
      );
      expect(screen.queryByRole('separator')).toBeNull();
    });
  });

  it('renders only the rows in view of a long list, and more as it scrolls', () => {
    const many = Array.from({ length: 1000 }, (_, i) =>
      snippet(`s${i}`, 'medium', `2026-09-01T00:00:${String(i % 60).padStart(2, '0')}Z`, 'Title'),
    );
    const { container } = render(<FlaggedChatFeed snippets={many} />);
    const rendered = () => container.querySelectorAll('li[data-snippet]').length;
    expect(rendered()).toBeGreaterThan(0);
    expect(rendered()).toBeLessThan(40);
    const box = container.querySelector('ul')!.parentElement!.parentElement!;
    box.scrollTop = 25_000;
    fireEvent.scroll(box);
    expect(Number(container.querySelector('li[data-snippet]')!.getAttribute('data-index'))).toBeGreaterThan(100);
    expect(rendered()).toBeLessThan(40);
  });

  it("scrolls to a link's chat with the Evaluations hash", async () => {
    query.value = 'run=r&attempt=1&snippet=low';
    history.replaceState(null, '', '/#evaluations');
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(
      <section>
        <FlaggedChatFeed snippets={SNIPPETS} />
      </section>,
    );
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });
});
