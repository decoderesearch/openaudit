import { Flag, notCounted } from '@/components/deploymeter/review-card';
import { ScoreText, VerdictChip } from '@/components/deploymeter/score-ring';
import { Fold } from '@/components/fold';
import Link from '@/components/link';
import { Page, PageHeader } from '@/components/page';
import { Section } from '@/components/section';
import { ABSTAIN, EVIDENCE_LABELS, judgePath } from '@/lib/deploymeter';
import { judgeReview } from '@/lib/server/deploymeter';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { cn } from '@/lib/utils';
import type { DeployReviewSample } from '@openaudit/spec';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

type Props = { params: Promise<{ lab: string; model: string; review: string }> };

async function load(params: Props['params']) {
  const { lab, model, review } = await params;
  const judge = `${decodeURIComponent(lab)}/${decodeURIComponent(model)}`;
  return { found: await judgeReview(judge, review, { drafts: isAdmin(await getViewer()) }) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { found } = await load(params);
  if (!found) return { title: 'Review' };
  return {
    title: `${found.name} on ${found.model.name}`,
    description: `The full Deploymeter review by ${found.name} of ${found.model.name}: each answer, the reasoning and the evidence it read.`,
    robots: found.panel.status === 'published' ? undefined : { index: false, follow: false },
  };
}

/** One judge's review in full. The judge saw no names; the page shows them for the reader. */
export default async function ReviewPage({ params }: Props) {
  const { found: r } = await load(params);
  if (!r) notFound();
  const excluded = notCounted(r);
  return (
    <Page>
      <PageHeader
        eyebrow={
          <span className="flex gap-x-1.5">
            <Link href="/judges" className="hover:text-sky-800 hover:underline">
              Deploymeter Judges
            </Link>
            <span aria-hidden>/</span>
            <Link href={judgePath(r.judge)} className="hover:text-sky-800 hover:underline">
              {r.name}
            </Link>
          </span>
        }
        title={`${r.name} on ${r.model.name}`}
        description={
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <Link href={r.model.href} className="text-sky-800 hover:underline">
              {r.model.name}
            </Link>
            <span>
              by {r.model.developer} · panel {r.panel.number} · OpenAudit V{r.panel.cardVersion} ·{' '}
              {r.panel.date.toISOString().slice(0, 10)} · prompt {r.panel.promptVersion}
              {r.panel.status !== 'published' && (
                <>
                  {' · '}
                  <Flag tone="amber">{r.panel.status}: only admins see it</Flag>
                </>
              )}
            </span>
          </span>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ScoreText score={r.score} className="text-4xl" />
        <div className="flex flex-col items-start gap-y-1 text-xs text-slate-600">
          {r.score !== null && <VerdictChip score={r.score} className="border-0" />}
          {excluded && <Flag tone="amber">{excluded}</Flag>}
          {EVIDENCE_LABELS[r.evidence] && (
            <span className="text-amber-800">
              {EVIDENCE_LABELS[r.evidence]}: its provider&apos;s safety filter blocked the full evidence.
            </span>
          )}
          {r.abstain && (
            <span className={cn('rounded px-1.5 py-0.5 text-[11px]/none font-medium', ABSTAIN.chip)}>
              {ABSTAIN.judge}
            </span>
          )}
          {r.abstain && <span>{ABSTAIN.text}</span>}
          {!r.abstain && r.enoughEvidence === false && (
            <span>The judge said the evidence was too thin to judge well.</span>
          )}
          {r.error && <span className="text-rose-800">Error: {r.error}</span>}
        </div>
      </div>
      {r.answers.map((a, i) => (
        <Answer key={i} n={i + 1} answer={a} shown={a.headline === r.shownHeadline} />
      ))}

      {r.guess && (
        <Section title="The Developer Guess">
          <p className="text-sm text-slate-700">
            After its review, the judge guessed the developer: <b>{r.guess.developer || 'no guess'}</b>
            {r.guess.model && <>, model {r.guess.model}</>} ({r.guess.confidence}% sure). This is{' '}
            {r.guess.rightDeveloper ? 'right' : 'wrong'}.
          </p>
          <Reasoning text={r.guess.reasoning} />
        </Section>
      )}

      <Section title="What the Judge Read">
        <Expand title="The system prompt for the review">
          <Pre>{r.panel.judgePrompt ?? 'Not saved for this panel.'}</Pre>
        </Expand>
        {r.guess && (
          <Expand title="The system prompt for the guess">
            <Pre>{r.panel.guessPrompt ?? 'Not saved for this panel.'}</Pre>
          </Expand>
        )}
        <Expand
          title={`The anonymous evidence${r.evidence === 'full' ? '' : `, ${r.evidence}`} (names hidden by ${r.panel.scrub})`}
        >
          <Pre>{JSON.stringify(r.panel.packet, null, 2)}</Pre>
        </Expand>
      </Section>
    </Page>
  );
}

function Answer({ n, answer: a, shown }: { n: number; answer: DeployReviewSample; shown: boolean }) {
  return (
    <Section
      title={
        <span>
          Answer {n} · <ScoreText score={a.score} />
          <span className="text-[11px]">
            {shown && (
              <>
                {' · '}
                <Flag>Shown on the model page</Flag>
              </>
            )}
            {a.abstain && (
              <>
                {' · '}
                <Flag>Abstained: the score does not count</Flag>
              </>
            )}
            {a.enoughEvidence === false && !a.abstain && (
              <>
                {' · '}
                <Flag tone="amber">Not enough evidence</Flag>
              </>
            )}
          </span>
        </span>
      }
    >
      <div className="flex flex-col gap-y-2 text-sm text-slate-700">
        <p className="font-medium text-slate-800">{a.headline}</p>
        <p>{a.summary}</p>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
          <Reasons title="Against wide deployment" items={a.reasonsAgainst} />
          <Reasons title="For wide deployment" items={a.reasonsFor} />
        </div>
        <Reasoning text={a.reasoning} tokens={a.reasoningTokens} />
        {a.reply && (
          <Expand title="The full reply">
            <Pre>{a.reply}</Pre>
          </Expand>
        )}
      </div>
    </Section>
  );
}

function Reasoning({ text, tokens }: { text: string | null | undefined; tokens?: number }) {
  if (text === undefined) return <p className="text-xs text-slate-500">The reasoning was not saved for this panel.</p>;
  if (!text)
    return (
      <p className="text-xs text-slate-500">
        The provider did not show the reasoning{tokens ? ` (${tokens.toLocaleString()} reasoning tokens)` : ''}.
      </p>
    );
  return (
    <Expand title={`The reasoning${tokens ? ` (${tokens.toLocaleString()} tokens)` : ''}`}>
      <p className="mb-1 text-[11px] text-slate-500">
        As the provider shows it. Some providers show a summary, not the full text.
      </p>
      <Pre>{text}</Pre>
    </Expand>
  );
}

function Reasons({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{title}</p>
      <ul className="mt-0.5 list-disc pl-4 text-xs">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function Expand({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details>
      <summary className="cursor-pointer text-xs font-medium text-sky-800 hover:underline">{title}</summary>
      <div className="mt-1.5">{children}</div>
    </details>
  );
}

function Pre({ children }: { children: ReactNode }) {
  return (
    <Fold size="sm">
      <pre className="overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-slate-700 lg:max-h-[32rem]">
        {children}
      </pre>
    </Fold>
  );
}
