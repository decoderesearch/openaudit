import Link from '@/components/link';
import { CopyPrompt } from '@/components/methods/copy-prompt';
import { SubmitDialogButton } from '@/components/nav/report-dialog';
import { Eyebrow, Page, PageTitle } from '@/components/page';
import { Section } from '@/components/section';
import { methodPath, type EvalView } from '@/lib/methods';
import { getMethod } from '@/lib/server/methods';
import { agentPrompt, HARNESSES, REPO_URL, SUBMIT_BUTTON, type Harness } from '@/lib/submissions';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

type Props = { params: Promise<{ method: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getMethod((await params).method);
  return { title: data ? `Submit a variant of ${data.method.displayName}` : 'Submit a variant' };
}

const TEXT = 'flex flex-col gap-2 text-sm/relaxed text-slate-600';
const LINK = 'font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:decoration-sky-700';
const AGENT_ID = 'coding-agent';

export default async function SubmitVariantPage({ params }: Props) {
  const data = await getMethod((await params).method);
  if (!data) notFound();
  const { method, evals } = data;
  const harnesses = HARNESSES[method.slug] ?? [];
  const formButton = (
    <SubmitDialogButton type="method" fields={{ method: method.displayName }} className={SUBMIT_BUTTON}>
      <Plus aria-hidden />
      Submit with the form
    </SubmitDialogButton>
  );
  return (
    <Page className="max-w-3xl">
      <div>
        <Eyebrow>Submit Variant</Eyebrow>
        <PageTitle>
          <Link href={methodPath(method.slug)} className="hover:text-sky-800 hover:underline">
            {method.displayName}
          </Link>
        </PageTitle>
        <p className="mt-1 text-sm/normal text-slate-600">
          Did you make a new variant of this method? Send it to us. If it looks good, we run it on our evaluations, and
          it goes on the site, ranked, next to the other variants.
        </p>
      </div>

      {harnesses.length === 0 ? (
        <NoHarness evals={evals} formButton={formButton} />
      ) : harnesses.length === 1 ? (
        <HarnessSteps slug={method.slug} harness={harnesses[0]!} evals={evals} />
      ) : (
        <>
          <p className="text-sm/relaxed text-slate-600">
            This method has {harnesses.length} method evaluation harnesses: code that runs our evaluations on your
            variant. Each runs different evaluations. Run one of them and send its results. We run the others on our
            side.
          </p>
          {harnesses.map((h) => (
            <Section key={h.path} title={evalNames(h, evals)}>
              <HarnessSteps slug={method.slug} harness={h} evals={evals} nested />
            </Section>
          ))}
        </>
      )}

      <Section title="Tell Us How You Made It">
        <div className={TEXT}>
          <p>
            {harnesses.some((h) => h.recipe)
              ? 'The recipe file is required for a rank, and this text helps us a lot.'
              : 'This is optional, but it helps us a lot.'}{' '}
            A variant that is fit or tuned on the evaluation items can get a high score that does not generalize. Tell
            us:
          </p>
          <ul className="list-disc pl-5">
            <li>The data that you fit or trained on, and how much of it.</li>
            <li>How you chose the settings, and on which data.</li>
            <li>If you used items of our evaluations, and which.</li>
            <li>The script or the commit that makes the variant, and the compute.</li>
          </ul>
        </div>
      </Section>

      <Section title="What Happens Next">
        <div className={TEXT}>
          <p>
            We read your submission and reply by email. If it looks good, we run it on our own hardware, at our cost.
            Only our run goes on the site. The results that you send are a check, and do not go on the site.
          </p>
        </div>
      </Section>
    </Page>
  );
}

const evalNames = (h: Harness, evals: EvalView[]) =>
  new Intl.ListFormat('en').format(h.evals.map((e) => evals.find((v) => v.slug === e)?.displayName ?? e));

/** The steps of one harness. `nested`: inside the harness's own box, so each step has a small title. */
function HarnessSteps({
  slug,
  harness: h,
  evals,
  nested = false,
}: {
  slug: string;
  harness: Harness;
  evals: EvalView[];
  nested?: boolean;
}) {
  const folder = `${REPO_URL}/tree/main/${h.path}`;
  const models = new Intl.ListFormat('en').format(h.models);
  const agentId = nested ? `${AGENT_ID}-${h.path.split('/').at(-1)}` : AGENT_ID;
  const step = nested ? { plain: true, className: 'mt-3' } : {};
  return (
    <>
      <Section title="Submission Requirements" {...step}>
        <div className={TEXT}>
          {h.recipe ? (
            <p>
              {h.recipe} Our method evaluation harness runs {evalNames(h, evals)} on it. It takes:
            </p>
          ) : (
            <p>
              One {h.artifact} file for each model that you have, on Hugging Face or another public host. Our method
              evaluation harness runs {evalNames(h, evals)} on it. It takes:
            </p>
          )}
          <ul className="list-disc pl-5">
            {h.formats.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        <Section title="Models" plain className="mt-2">
          <div className={TEXT}>
            {h.coreModels ? (
              <p>
                We rank on {h.coreModels.length} core models: {new Intl.ListFormat('en').format(h.coreModels)}. A
                variant gets a rank only with a result on each. One small core model is enough to submit: we fit your
                recipe on the others. {h.modelData}
              </p>
            ) : h.anyModel ? (
              <>
                <p>
                  You can use any model, and one model is enough. Our leaderboard models are {models}. On these, we rank
                  your {h.artifact} next to ours.
                </p>
                <p>
                  {h.modelData} If your {h.artifact} on another model looks good, we can add that model to our
                  leaderboard, or fit your {h.artifact} on our models with your recipe.
                </p>
              </>
            ) : h.models.length === 1 ? (
              <p>
                Use {models}. {h.modelData}
              </p>
            ) : (
              <p>
                Use one or more of {models}. One model is enough. {h.modelData}
              </p>
            )}
          </div>
        </Section>
      </Section>

      <Section title="Prepare for Submission" {...step}>
        <div className={TEXT}>
          <p>
            To make the submission with a coding agent, go to{' '}
            <a href={`#${agentId}`} className={LINK}>
              Use a Coding Agent
            </a>
            .
          </p>
          <p>
            The{' '}
            <a href={folder} className={LINK}>
              harness
            </a>{' '}
            runs the same code as our runs. The smoke tier runs on {h.smoke.model} in {h.smoke.time}: it shows that your{' '}
            {h.artifact} works with it. The full tier gives the scores.
          </p>
          <p>
            Then put your files in a pull request, in <code>submissions/{slug}/&lt;variant&gt;/</code>. Start from the{' '}
            <a href={`${folder}/submission`} className={LINK}>
              template
            </a>{' '}
            and the{' '}
            <a href={`${REPO_URL}/tree/main/submissions`} className={LINK}>
              general steps
            </a>
            .
          </p>
        </div>
      </Section>
      <Section title="Use a Coding Agent" id={agentId} {...step}>
        <div className={TEXT}>
          <p>Give this prompt to your coding agent. It runs the harness and makes the submission.</p>
          <CopyPrompt text={agentPrompt(slug, h)} />
        </div>
      </Section>
    </>
  );
}

function NoHarness({ evals, formButton }: { evals: EvalView[]; formButton: ReactNode }) {
  const code = evals.flatMap((e) => e.links.filter((l) => l.kind === 'repo').map((l) => ({ ...l, eval: e })));
  return (
    <Section title="Submit">
      <div className={TEXT}>
        <p>
          We do not have a method evaluation harness for this method yet. Send us a link to your variant with the form:
          its code or weights, the results that you have, and how you got them.
        </p>
        {code.length > 0 && (
          <>
            <p>You can run these evaluations with their own code:</p>
            <ul className="list-disc pl-5">
              {code.map((l) => (
                <li key={`${l.eval.slug} ${l.url}`}>
                  {l.eval.displayName}:{' '}
                  <a href={l.url} className={LINK}>
                    {l.title ?? l.url}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
        {formButton}
      </div>
    </Section>
  );
}
