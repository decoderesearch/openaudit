import Link from '@/components/link';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, prefetch: _, ...p }: { href: string; prefetch?: boolean; children: React.ReactNode }) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
}));

const pathname = vi.hoisted(() => ({ value: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));

const fetchMock = vi.fn(async () =>
  Response.json({
    '/google/gemini-4-argon': {
      name: 'Gemini 4 Argon',
      developer: 'Google',
      released: '2026-10-13',
      meter: 50,
      votes: { reject: 3, limits: 6, approve: 0 },
      flagged: 641,
      evals: 1,
    },
    '/acme/bare': { name: 'Bare', developer: 'Acme' },
  }),
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  pathname.value = '/';
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockClear();
});

async function hover(name: string) {
  fireEvent.pointerEnter(screen.getByText(name), { pointerType: 'mouse' });
  await act(async () => void (await vi.advanceTimersByTimeAsync(500)));
}

/** The newest card: the one before it can still be closing. */
const card = () => [...document.querySelectorAll('[data-slot="hover-card-content"]')].at(-1);

describe('Link to a model', () => {
  it('shows the name, developer, release month, Deploymeter and counts, from one request', async () => {
    render(
      <>
        <Link href="/google/gemini-4-argon#deploymeter">Argon</Link>
        <Link href="/acme/bare">Bare</Link>
      </>,
    );
    await hover('Argon');
    expect(card()!.textContent).toBe(
      'Gemini 4 ArgonGoogle·Oct 2026Open Model →50%Deploymeter641 Flagged Chats1 Evaluation',
    );
    const links = [...card()!.querySelectorAll('a')].map((a) => [a.getAttribute('href'), a.getAttribute('aria-label')]);
    expect(links).toEqual([
      ['/google/gemini-4-argon', null],
      ['/google/gemini-4-argon', 'Deploymeter: 50 of 100, Limited Deployment'],
    ]);
    await hover('Bare');
    expect(card()!.textContent).toBe('BareAcmeOpen Model →–DeploymeterNo Flagged ChatsNo Evaluations');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows no card on the model page, for other pages, or with hover off', async () => {
    pathname.value = '/google/gemini-4-argon';
    render(
      <>
        <Link href="/google/gemini-4-argon">Self</Link>
        <Link href="/evaluations/mask">Eval</Link>
        <Link href="/acme/bare" hover={false}>
          Off
        </Link>
        <Link href="/acme/unknown">Unknown</Link>
      </>,
    );
    for (const name of ['Self', 'Eval', 'Off', 'Unknown']) await hover(name);
    expect(card()).toBeUndefined();
  });
});
