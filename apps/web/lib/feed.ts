import { SEVERITIES, SEVERITY_COLORS, type SnippetSeverity } from '@/lib/openaudit-card';

/** The number of entries in one load of an updates feed. */
export const FEED_PAGE = 25;

/** The updates feed sends this many flagged chats of each model and group; the reader loads the rest. */
const FEED_SNIPPETS = 3;

/** The groups of a model's flagged chats, by severity. Critical chats go with high. */
export const CHAT_GROUPS = ['high', 'medium', 'low'] as const;
export type ChatGroup = (typeof CHAT_GROUPS)[number];
export const chatGroup = (s: SnippetSeverity): ChatGroup => (s === 'critical' ? 'high' : s);

/** A count in at most 4 characters, cut down, not rounded up: `999`, `1.5K`, `15K`. */
export function shortCount(n: number) {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(Math.floor(n / 100) / 10).toString()}K`;
  return `${Math.floor(n / 1000)}K`;
}

/** Each group's name and its colors (`SEVERITY_COLORS`). */
export const CHAT_GROUP_STYLES: Record<ChatGroup, { label: string; icon: string; text: string }> = {
  high: { label: 'High', ...SEVERITY_COLORS.high },
  medium: { label: 'Medium', ...SEVERITY_COLORS.medium },
  low: { label: 'Low', ...SEVERITY_COLORS.low },
};

/** `items` in turns: one of each `key` in turn, in the order given, so one key cannot fill the
 * start. Items with the same `block` stay together, in the order given. */
export function inTurns<T>(items: T[], key: (t: T) => string, block: (t: T) => string): T[] {
  const out: T[] = [];
  for (let i = 0; i < items.length;) {
    let end = i;
    while (end < items.length && block(items[end]!) === block(items[i]!)) end++;
    const byKey = Map.groupBy(items.slice(i, end), key);
    for (let turn = 0; out.length < end; turn++)
      for (const list of byKey.values()) if (turn < list.length) out.push(list[turn]!);
    i = end;
  }
  return out;
}

/** The first `n` chats of each group, in the order given. */
export function firstOfEachGroup<T extends { severity: SnippetSeverity }>(chats: T[], n = FEED_SNIPPETS): T[] {
  const seen: Partial<Record<ChatGroup, number>> = {};
  return chats.filter((c) => {
    const g = chatGroup(c.severity);
    seen[g] = (seen[g] ?? 0) + 1;
    return seen[g] <= n;
  });
}

/** `n` chats: first the `open` most severe chats of `chats` that a reader can open, of any
 * severity, then the chats of `rest` in the order given. */
export function openChatsFirst<T extends { severity: SnippetSeverity; locked?: boolean }>(
  chats: T[],
  { rest = chats, n = FEED_SNIPPETS, open = 2 }: { rest?: T[]; n?: number; open?: number } = {},
): T[] {
  const first = chats
    .filter((c) => !c.locked)
    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity))
    .slice(0, open);
  return [...first, ...rest.filter((c) => !first.includes(c))].slice(0, n);
}

/** One load of an updates feed. `more`: entries follow. */
export type FeedPage<T> = { entries: T[]; more: boolean };

/** The kinds of model feed: the evals we ran, or incidents. */
export type ModelFeedKind = 'evals' | 'incidents';

/** The model feeds that the navbar Models menu shows, in order. */
export const NAV_MODEL_FEEDS: ModelFeedKind[] = [];

export const MODEL_FEED_TITLES: Record<ModelFeedKind, string> = {
  incidents: 'Latest Model Incidents',
  evals: 'Latest Model Evaluations',
};
