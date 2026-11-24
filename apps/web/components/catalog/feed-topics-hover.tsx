'use client';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import type { FeedTopic } from '@/lib/server/snippet-feed';
import { TOPIC_LABELS } from '@/lib/topics';
import type { Topic } from '@openaudit/spec';
import type { ReactElement } from 'react';

const count = (n: number) => (n ? n.toLocaleString('en-US') : '–');

/** `children` in a feed row. On hover, a card at its right shows a table of the model's topics,
 * each with its number of flagged chats of high or medium severity, and of low severity. */
export function FeedTopicsHover({
  topics,
  model,
  children,
}: {
  topics: FeedTopic[];
  model: string;
  children: ReactElement;
}) {
  if (!topics.length) return children;
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="right" align="center" sideOffset={8} className="w-80 p-0 text-slate-700">
        <div className="border-b border-slate-100 px-3 py-2 text-[10px] font-bold text-slate-400">
          Flagged chats for <span className="text-slate-600">{model}</span>
        </div>
        <div className="max-h-[240px] overflow-y-auto overscroll-contain py-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] font-semibold tracking-wide text-slate-400 uppercase">
                <th className="px-3 py-1 text-left font-semibold">Topic</th>
                <th className="w-16 px-2 py-1 text-right font-semibold">High/Mid</th>
                <th className="w-12 py-1 pr-3 pl-2 text-right font-semibold">Low</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((t) => (
                <tr key={t.topic}>
                  <td className="px-3 py-1 text-slate-700">{TOPIC_LABELS[t.topic as Topic] ?? t.topic}</td>
                  <td className="px-2 py-1 text-right text-amber-700 tabular-nums">{count(t.counted)}</td>
                  <td className="py-1 pr-3 pl-2 text-right text-slate-500 tabular-nums">{count(t.low)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
