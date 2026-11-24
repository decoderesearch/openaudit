import { Flag } from '@/components/deploymeter/review-card';
import { ScoreText } from '@/components/deploymeter/score-ring';
import { Fold } from '@/components/fold';
import Link from '@/components/link';
import { Page, PageHeader } from '@/components/page';
import { Section } from '@/components/section';
import { judgePath } from '@/lib/deploymeter';
import { shareMetadata } from '@/lib/og/meta';
import { judgeList, judgePrompts, type JudgePromptVersion } from '@/lib/server/deploymeter';
import type { Metadata } from 'next';

const TITLE = 'Deploymeter Judges';
const DESCRIPTION =
  'The AI models that review each model for the Deploymeter: how much each trusts a model for wide public deployment, from anonymous evidence.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  ...shareMetadata(TITLE, DESCRIPTION, '/judges'),
};

/** The Deploymeter's AI judges, with what their published reviews show, and the prompts they get. */
export default async function JudgesPage() {
  const [judges, prompts] = await Promise.all([judgeList(), judgePrompts()]);
  return (
    <Page>
      <PageHeader
        title={TITLE}
        description="Each judge reads the same anonymous evidence about a model and gives a score from 0 to 100: how much it trusts the model for wide public deployment, from a safety view. A judge's score does not count for models of its own developer."
      />
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {judges.map((j) => (
          <li key={j.judge}>
            <Link
              href={judgePath(j.judge)}
              className="flex items-center gap-x-3 rounded-lg border border-slate-200 bg-white px-4 py-3 transition-colors hover:bg-sky-50"
            >
              <ScoreText score={j.average} className="w-14 shrink-0 text-center text-2xl" />
              <div className="flex min-w-0 flex-col gap-y-0.5">
                <span className="text-sm font-semibold text-slate-800">
                  {j.name}
                  <span className="text-xs font-normal text-slate-500">
                    {' · '}
                    <Flag>{j.openWeights ? 'Open weights' : 'Closed'}</Flag>
                    {!j.onPanel && (
                      <>
                        {' · '}
                        <Flag tone="amber">Not on the panel now</Flag>
                      </>
                    )}
                  </span>
                </span>
                <span className="font-mono text-[11px] text-slate-400">{j.judge}</span>
                <span className="text-xs text-slate-500">
                  {j.reviews === 0
                    ? 'No published reviews yet.'
                    : [
                        `${j.reviews} ${j.reviews === 1 ? 'review' : 'reviews'}, average score ${j.average}`,
                        j.distance !== null && `${j.distance} points from the panel score on average`,
                        j.guessRate !== null && `guessed the developer in ${Math.round(j.guessRate * 100)}%`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {prompts.length > 0 && (
        <Section id="prompts" title="The Judge Prompts">
          <p className="text-xs text-slate-600">
            Each judge gets the review prompt as its system prompt, and the anonymous evidence about the model as its
            message. It answers more than once, and its score is the median. A second call, with the guess prompt and
            the same evidence, asks it to guess the developer. This tests how well the evidence hides the names. Each
            review page shows the evidence that its judge read.
          </p>
          <div className="mt-3 flex flex-col gap-y-3">
            {prompts.map((p, i) => (
              <PromptVersion key={p.version} prompt={p} open={i === 0} />
            ))}
          </div>
        </Section>
      )}
    </Page>
  );
}

const day = (d: Date | null) => d?.toISOString().slice(0, 10);

function PromptVersion({ prompt: p, open }: { prompt: JudgePromptVersion; open: boolean }) {
  const first = day(p.first);
  const last = day(p.last);
  return (
    <details open={open} className="group/prompt rounded-md border border-slate-200">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm">
        <span className="font-mono font-semibold text-slate-800">{p.version}</span>
        <span className="text-xs text-slate-500">
          {p.panels} {p.panels === 1 ? 'panel' : 'panels'} · {first === last ? first : `${first} to ${last}`}
        </span>
      </summary>
      <div className="flex flex-col gap-y-3 border-t border-slate-200 px-3 pt-2 pb-3">
        <Prompt title="The review prompt" text={p.judge} />
        <Prompt title="The guess prompt" text={p.guess} />
      </div>
    </details>
  );
}

function Prompt({ title, text }: { title: string; text: string | null }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{title}</p>
      <Fold size="sm">
        <pre className="overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-slate-700 lg:max-h-[32rem]">
          {text ?? 'Not saved.'}
        </pre>
      </Fold>
    </div>
  );
}
