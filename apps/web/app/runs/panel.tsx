'use server';

import { AttemptView, loadAttempt, sampleOf } from '@/components/runs/attempt-view';
import { RunView, loadRun, runTitle } from '@/components/runs/run-view';
import { SampleAttempts } from '@/components/runs/sample-attempts';
import { parseId } from '@/lib/ids';
import { isSamplePanel, panelFromParams, panelPath, withPanel, type Panel, type SamplePanel } from '@/lib/run-panel';
import { limitRead } from '@/lib/server/limits';
import { getSampleAttempts } from '@/lib/server/runs';
import { snippetFocus } from '@/lib/server/snippet-focus';
import type { ReactNode } from 'react';

export type PanelView = { title: string; href: string; body: ReactNode };

/** A run, attempt or sample view for the side panel. Null: no such run, attempt or sample. */
export async function panelView(input: Panel): Promise<PanelView | null> {
  await limitRead('panel');
  const p = panelFromParams(withPanel(new URLSearchParams(), input));
  if (!p) return null;
  const href = panelPath(p);
  if (isSamplePanel(p)) return sampleView(p, href);
  if (p.attempt) {
    const found = await loadAttempt(p.run, p.attempt);
    if (!found) return null;
    const flag = await snippetFocus(p.snippet, found.attempt.id);
    const { id, epoch } = sampleOf(found);
    return {
      title: `${found.eval.displayName} on ${found.model.displayName} · Evaluation Sample: ${id}${epoch ? ` #${epoch}` : ''}`,
      href,
      body: <AttemptView found={found} mode="panel" focus={flag?.focus} flag={flag} />,
    };
  }
  const found = await loadRun(p.run);
  return (
    found && {
      title: runTitle(found),
      href,
      body: <RunView found={found} id={p.run} show={p.show} metric={p.metric} mode="panel" />,
    }
  );
}

/** As the sample pages: with `sampleRun`, only that run's attempts, and none is not found. */
async function sampleView(p: SamplePanel, href: string): Promise<PanelView | null> {
  const id = parseId(p.sample);
  const runId = p.sampleRun ? parseId(p.sampleRun) : undefined;
  if (!id || runId === null) return null;
  const found = await getSampleAttempts(id, runId);
  if (!found || (runId && !found.attempts.length)) return null;
  return {
    title: `${found.eval.displayName} · Evaluation Sample: ${found.sample.sourceId}`,
    href,
    body: <SampleAttempts found={found} run={runId ? { id: runId } : undefined} mode="panel" />,
  };
}
