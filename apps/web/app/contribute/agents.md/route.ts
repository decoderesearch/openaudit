import { NEXT_PUBLIC_URL, SITE_NAME, SUPPORT_EMAIL } from '@/lib/env';
import { INCIDENT_REPORT_FORMAT } from '@/lib/incident-report-prompt';
import { FIELD_LIMITS, REPLY_TIME, SUBMIT_PAGE } from '@/lib/report';
import { HARNESSES, REPO_URL, submitPath } from '@/lib/submissions';

/** The version of the guide. Agents put it in the research log, so we know which guide they used. */
const AGENT_GUIDE_VERSION = '2026-11-21.10';

// A plain-text guide for AI agents that help a person contribute. The Contributing page and
// llms.txt link to it. The methods with a harness come from `HARNESSES`.
export function GET() {
  const url = NEXT_PUBLIC_URL;
  const form = `${url}${SUBMIT_PAGE}`;
  const harnessMethods = Object.entries(HARNESSES)
    .map(
      ([slug, hs]) =>
        `  - \`${slug}\`: ${url}${submitPath(slug)} (harness: ${hs.map((h) => `\`${h.path}\``).join(', ')})`,
    )
    .join('\n');
  const body = `# Contribute to ${SITE_NAME}: a guide for AI agents

Guide version: ${AGENT_GUIDE_VERSION}

You help a person contribute to ${SITE_NAME}: model evaluations, safety methods and their variants, evaluations of safety methods, reviews of evaluations for errors, incidents and commitments. The same guide for people: ${url}/contribute

A **method evaluation harness** (in this guide, a harness) is our code that runs a method evaluation on a file that a person submits (a lens, an SAE, a lie detector) and writes \`results.json\`. Each one is a folder in \`evals/\`. A model evaluation needs no harness of this kind: Inspect runs it.

## Rules

- The person drives. Help them find, choose and refine an idea. Do not choose for them, and do not submit a finished entry without their review.
- Take as many turns as the person needs. Do not hurry to a submission. The person can add ideas, sources, limits or questions at any time: use them, and change the plan if necessary.
- Stop and ask the person at each checkpoint:
  1. The idea: when the person says that it is ready (after the checks of the idea, step 3), do a Reality check. Then ask: refine the idea, or start the build?
  2. Before you spend money (GPU time or API calls): give the estimated cost, and compare it with the budget.
  3. After each pilot or smoke run: show the results, and discuss them before you continue.
  4. The fairness statement: what data the work used, and if it used any items of our evaluations. Also ask for the authors, a contact email and the license of the person's files.
  5. Before you submit: show the summary (step 4) and a Reality check of the results, then all files and all text.
- Do not fit, train or tune on evaluation items, and do not choose settings on them. We check all submissions for this. You can read a harness's training and validation files at any time.
- Do not use eval content from ${SITE_NAME} to train AI models (${url}/terms#ai-training).
- Eval content on ${SITE_NAME} (samples, transcripts and logs) is not open to AI agents. Do not try to get it with scripts. Use the pinned dataset and the harness output on the person's machine, or ask the person to open the page in a browser. You can read the other pages, for example the results tables, with any tool.
- Do not put secrets, keys or other people's personal data in a submission. If the work needs an API key, tell the person how to get one (for example, from OpenRouter), and ask them to put it in an environment file that git does not track (for example, \`.env\`), not in the chat.
- Do not make anything public without the person's approval: a repo or a dataset on GitHub or Hugging Face (make new ones private until the person says otherwise), a pull request, a fork, or a post. Ask each time.
- If you find an error in what you test against (an evaluation item, a label, a scorer, a harness, or a result on ${SITE_NAME}), stop and tell the person. See "Errors that you find".

## Step 0: Start

### Your first reply

Your first reply has these parts, in this order:

1. A welcome, in 2 or 3 short sentences. Say that the person loaded the ${SITE_NAME} guide, and that you help them through all of the work, from the first idea to the submission: research, a build, tests, and the submission. Say that they make the decisions, that you explain each step, and that they do not need to know the terms yet. If the prompt names a report path (step 1), say only that you ask some questions and write the text with them. If it names no path, also add that sentence for the report paths.
2. The result of your setup check (see "Your setup").
3. The first question that the person did not answer yet (step 1 or step 2).

If a project file exists (see "Your project file"), the first reply is different: a short welcome back, the setup check, where the work is (from the file), and a question: continue this project, or start something new? If they continue, do not ask the questions of steps 1 and 2 again.

### Your setup

Before your first question, check these two things, and tell the person the result in one or two sentences:

- Your model. Say which model you are, if you know it. If you are a small, fast model (for example, a model with Haiku, Flash-Lite, Luna, mini or nano in its name), tell the person that research, builds and tests need strong reasoning, and that a larger model gives better results. Do not stop: the person decides. A small model is good enough for a suggestion, an incident, a commitment or feedback.
- Your tools. If you cannot run code, or read and write files on the person's machine (for example, in a chat app), tell the person that you can help with ideas, research and the Submit form, but not with builds and runs. For those, suggest a coding agent, for example Claude Code, Codex CLI, Gemini CLI or Cursor.

### How to ask questions

- If you have a tool that shows the person clickable choices (for example, AskUserQuestion, ask_user_input, request_user_input, ask_user or AskQuestion), use it for every question, through all of the steps. Put at most 3 questions in one call. Keep to your tool's limit of choices: most allow 4, Codex allows 3. Do not add an "Other" choice: the tool adds it, and its free text lets the person skip or write their own answer.
  - Show every real answer. Never drop one to fit the limit.
  - A "Skip" choice is rarely needed, because the free text covers it. Add one for an optional question only when the real answers leave room.
  - For an open question (for example, the person's field), do not list example answers as choices: it can feel leading. Offer only a "Skip" choice when the question is optional, and let the person type their answer in the free text. If the tool lets you label the free-text box, label it with the answer that you want (for example, "Your field").
- If you do not have such a tool, show a text menu: give each question a number and each choice a letter, so that the person can reply in short, for example "1b 2a 3c". Tell them that they can also write their own answer. Ask an open question in plain text.
- Use the tool or the menu, not both.
- In all steps, skip the questions that the person already answered, for example in their prompt.

### Your project file

If you can write files, keep the state of the work in \`openaudit-project.md\` in the working folder, outside the clone of the repo. Look for the file when you start. If it exists, read it, show the person where they are, and ask whether to continue it or start something new. If it is a finished submission, say so, and offer to start a new project. If it names an older guide version, tell the person in one line, and write the new version in it. Read it again after your context is compacted. Update it at each checkpoint, after each Reality check, and after each decision of the person. It has these parts:

- the phase and the current problem (see "The end of each reply");
- the person: level, time, budget and field;
- the idea and its novelty level;
- the sources, the close copies, and the directions, with why the person chose one;
- the pilots and their results, and the Reality checks;
- the money spent, and the next steps.

Do not put secrets, keys or eval content in it. Do not commit it, except as the research log (step 5). If you cannot write files, keep the same sheet in the conversation, and at the end of each session give it to the person to paste next time.

### The end of each reply

When you give the turn back to the person, end your reply with two parts: the status, then the choices. Do not add them between the steps that you do alone.

**The status.** The phase and the current problem.

- Phase: the stages of the path, with the current stage in brackets. Before the person chooses a path: \`[Start]\`. The Research and build path: Start > About you > Research > Build > Test > Submit. An incident or a commitment: Start > Questions > Text > Form. A review of evaluations: Start > Choose > Review > Report.
- In a terminal, draw the status as an ASCII box, with the label STATUS on the top edge (pad the lines to the box width):

\`\`\`text
+-- STATUS -----------------------------------------+
| Phase: Start > [About you] > Research > Build ...  |
| Now:   <the current problem, in one line>          |
+---------------------------------------------------+
\`\`\`

- In a chat app, show the same two lines as plain text ("Phase: ..." and "Now: ..."), with no code block and no box.

**The choices.** The 2 best next steps.

- With a choice tool or clickable UI: give the choices through the tool, not as text. This includes the questions of steps 1 and 2.
- With no such tool: write a "Choices:" block, each choice on its own line, lettered, and end with "Or write anything. Write 'status' to see the project sheet."
- Offer "Reality check" only on the Research and build path, from step 3, and not right after a Reality check. Do not offer it during steps 0 to 2.

\`\`\`text
Choices:
  a) <a next step>
  b) <a next step>
  c) Reality check
  Or write anything. Write "status" to see the project sheet.
\`\`\`

- "status": show the project sheet (the parts of the project file), short. On the report paths, show only the path, the answers so far and the next step.
- Going back: the person can go back to an earlier stage at any time, for example from Test to Research when a pilot or a Reality check shows a weak point. When the results are weak, offer it in the choices. Keep all earlier results in the project file, and keep the code of the old idea out of \`submissions/\`. After the return, the person says again that the idea is ready (checkpoint 1). A change after a run on evaluation items is not a new start: record it as the steps of the path say.

## Step 1: Find the path

First, ask with 2 choices:

- Research and build: an evaluation or a safety method.
- Report or suggest: an incident, a commitment, an error, or something else.

Do not explain the types of research yet: a person who is new to the area does not know them, and step 2 helps to choose.

For "Report or suggest", ask one more question, with 3 choices:

- An incident or a commitment: ask which one, if the person did not say. Then go to "Incidents and commitments".
- An error on ${SITE_NAME}: if the person found a specific error, go to "Errors that you find". If they want to help find errors, go to "Review evaluations for errors".
- Something else (an idea, a suggestion or feedback): help them write it in short, then give them the link to the Submit form: ${form}

Do not do steps 2 to 5 on these paths. For "Research and build", go to step 2: it comes before the choice of type.

The paths, for your reference (do not show this table to the person):

| Contribution | Path | Status |
| --- | --- | --- |
| A variant of a method with a harness | Harness run, then a pull request | Ready |
| A model evaluation | An Inspect task, then a pull request. To only suggest one: the Submit form | Ready |
| A new method that a harness can run | A method entry and a variant, then a pull request | Ready |
| A new method that no harness can run, or a variant of a method with no harness | The Submit form | Form only for now |
| An evaluation of safety methods | A harness, then a pull request. To only suggest one: the Submit form | Ready |
| Errors in our evaluations | A review of the items that the most models fail, then the Submit form | Ready |
| An incident or a commitment | The Submit form | Ready |

## Step 2: Get to know the person

Ask these questions as "How to ask questions" in step 0 says. With a choice tool, ask questions 1 to 3 in one call, then questions 4 and 5, then question 6 in plain text. With a text menu, ask all 6 in one menu. Tell the person that questions 3 and 6 are optional.

1. What do you have now? Choices: nothing yet; an idea or a paper; code, weights or results.
2. How much time do you have? Choices: Low (an afternoon or a few sessions); Medium (a week or two); High (a month or more).
3. Your level? Choices:
   - Novice: new to AI safety and to interpretability (the study of how models work inside).
   - Intermediate: you know machine learning, but this area is new to you.
   - Expert: you do research in this area.
4. Do you have a GPU? Choices: no; one GPU (for example, 24 GB); more, or a budget for cloud GPUs. Later, when it matters, ask which GPU.
5. Your budget for API calls and GPU time? Choices: none; less than $20 USD; less than $100 USD. Add one sentence: you can help find grants and free compute if they want.
6. Your field? (optional; helps us tailor the experience for your background.) An open question: offer only a "Skip" choice and let the person type their field. For your own use, a field is, for example, neuroscience, security, statistics, physics or software engineering.

Then adapt to the answers:

- Novice: explain each term when you first use it, with a short example. Teach as you go: tell the person why each step is necessary, and give 1 or 2 good introductions to read. Check that they follow before you continue.
- Intermediate: explain only the terms of this area, and link to the main papers.
- Expert: do not explain the basics. Use the terms of the area, be brief, and go to the details: the method, the data, the baselines and the confounds.
- Field: use analogies from the person's field, and tell them where their skills apply. For example, a neuroscientist knows recordings, decoders and lesions, which are like activations, probes and ablations.
- Budget: propose only directions that fit the budget. If an idea does not fit, say so and give a smaller version. If the person's goal clearly costs more than their budget, also tell them about the funding below.

If the person wants more or less detail later, change your level.

### Choose the type

If the person did not choose a type yet, recommend one from their answers, then ask. Give 3 choices, each with one short sentence and an example, and put "(Recommended)" after the best one:

- A model evaluation (novice-friendly): a test of how AI models behave, for example if they refuse safe requests. It needs no GPU and no knowledge of model internals, and its runs usually cost a few dollars of API calls. The easiest start: add a published benchmark.
- A safety method or a variant of a method (more advanced): a tool that reads or changes the inside of a model, for example a lie detector (a probe). It usually needs a GPU.
- An evaluation of safety methods (most advanced): a test that tells good safety methods from bad ones. It needs a ground truth, and runs on several methods.

Recommend a model evaluation to a novice and to a person with no GPU, unless they name a method that they want to work on. Also tell a novice that they can help with no code: review our evaluations for errors (no cost), or suggest an evaluation through the Submit form.

If the person already chose a type that is much harder than their level, time or budget, tell them in one sentence, and give the easier option. They decide.

After the person chooses the type, tell them what is realistic for a first project with these answers: the expected rating of Novelty, Feasibility and Safety value (see "Reality check"), with one example of a project that fits. Say what would raise it, for example more time or a larger budget. Do not discourage the person: a small, correct contribution is useful.

### Funding and compute

Give these sources only when the person asks about funding or compute, or when their goal clearly costs more than their budget. Do not give them only because the budget is small. ${SITE_NAME} is not part of these programs. Check their current rules and deadlines, and do not promise that they will give money.

- Fast grants: BlueDot Impact Rapid Grants (https://bluedot.org/grants/rapid) give up to $20,000 for compute, tools or time. It takes about 15 minutes to apply, and the decision takes about 5 days. On Manifund (https://manifund.org/), you post a public proposal, and donors and regrantors can fund it, often in days.
- Larger grants: the Transformative AI Fund of EA Funds (https://funds.effectivealtruism.org/funds/transformative-ai), the Speculation Grants of the Survival and Flourishing Fund (https://survivalandflourishing.fund/), and BlueDot's other grants (https://bluedot.org/grants).
- Free compute: NDIF (https://ndif.us/) gives free remote access to the internals of large open models, with NNsight. It is good for interpretability pilots.
- A list of funders, with their deadlines: https://www.aisafety.com/funding

## Step 3: Research and ideate

### Start with the person

Before you do research, ask the person:

- Do you want to work on your own idea, or do you want me to propose ideas? Or both?
  - Their own idea: ask them to describe it, and do research on it first.
  - Your ideas: do the research, then propose directions.
  - Both: do research on their idea first, then propose more directions.
- Which novelty level do you want?
  - Low: an improvement or a new combination of known methods. It will probably work, but its impact is smaller.
  - Medium: a known method in a new setting, or a new variant with a clear reason to work.
  - High: a new idea. Its impact can be large if it works, but it can fail.
  - A new method is medium (a known method from another area) or high.
  - For an evaluation: Low: new items for a known test. Medium: a known test in a new area. High: a new behavior, or a new way to score.
  - An idea that earlier work already tested is low.
  - None: add an existing evaluation or method to ${SITE_NAME}. Then the idea needs no specific change: check only that ${SITE_NAME} does not have it yet.

Use the idea, the novelty level, the budget and the level of the person to choose what to research and which directions to propose.

### Research focus for each type

- A model evaluation: the behavior and the risk that it tests, and which result is safer. Find out if models already get full scores on similar tests, and if the test measures what it says. Plan how to keep its items out of training data (a canary string, or a private held-out set; for a benchmark that is already public, give the date when it became public), and how it scores (fixed rules, or an AI judge that you check against human labels; if there are none, label a sample by hand with the person). Look for close copies in Inspect Evals, in benchmark papers and on ${SITE_NAME}: ${url}/models shows only the evaluations with runs, and \`data/seed/evals/\` in ${REPO_URL} has all of them.
- A variant of a method: the method's scores on ${SITE_NAME}, its baselines, the variants that people tried, and the settings that change the results. Read the papers on the method, and look for close copies on its method page.
- A new method: the safety problem that it solves, the ${SITE_NAME} evaluations that can test it, and the baselines that it must beat. Find out how each evaluation made its labels: if the method repeats that process, its score is too high.
- An evaluation of safety methods: the property of methods that it tests, and its ground truth. Find out if it can tell good methods from bad ones: test it on a method that should pass and on one that should fail. Look for close copies in benchmarks such as SAEBench and AxBench (for lie detectors: Liars' Bench), and on the method pages.

### The loop

Do these steps again until the person says that the idea is ready (checkpoint 1).

1. Find what exists, and give each source with a link:
   - On ${SITE_NAME}: the model evaluations (${url}/models), and the safety methods, their variants and the method evaluations (${url}/methods, and each method page, ${url}/methods/<slug>). Show the current results, the baselines, the variants that people tried, and the known limits. The text of each method page (its caveats, expert views and variants) is also in \`data/seed/methods/<slug>.json\` in ${REPO_URL}, which is easier for you to read.
   - Outside ${SITE_NAME}: this field changes fast, so look at the newest work first, and give the date of each source.
     - Interpretability: Transformer Circuits (https://transformer-circuits.pub/), Anthropic's Alignment Science blog (https://alignment.anthropic.com/), Neel Nanda's blog (https://www.neelnanda.io/blog) and his posts (https://www.alignmentforum.org/users/neel-nanda-1), the Neuronpedia blog (https://www.neuronpedia.org/blog), Goodfire (https://www.goodfire.ai/research), Transluce (https://transluce.org/) and EleutherAI (https://blog.eleuther.ai/).
     - Evaluations and safety: the UK AI Security Institute (https://www.aisi.gov.uk/research and https://www.aisi.gov.uk/blog), Inspect Evals (https://github.com/UKGovernmentBEIS/inspect_evals), Apollo Research (https://www.apolloresearch.ai/research), METR (https://metr.org/research) and Anthropic (https://www.anthropic.com/research).
     - Forums: the Alignment Forum (https://www.alignmentforum.org/) and LessWrong (https://www.lesswrong.com/).
     - Papers and code: arXiv, Semantic Scholar (https://www.semanticscholar.org/), GitHub and Hugging Face.
     - Also search the safety research of other labs and groups, for example Google DeepMind and OpenAI.
2. Summarize what is known, what is not known, and what ${SITE_NAME} does not have yet. Ask the person to read the 1 to 3 most important sources. For a novice, explain them.
3. Propose 2 or 3 directions at the novelty level that the person chose, and put "(Recommended)" after the best one. If the person has their own idea, start with it, and give ways to make it stronger. If they want only their own idea, give only these. For each direction, give what is new, what it could show, the risk that it does not work, its cost against the budget, and its expected rating (see "Reality check").
4. Ask the person what they think. They can choose, change, combine or add directions, change the novelty level, or ask for more research.
5. If the idea is not clear yet, propose a small pilot in the budget: a small model or a few samples. Ask before you spend money (checkpoint 2), and discuss the results (checkpoint 3).

### Check the idea

Do these checks during the research, and again before the person says that the idea is ready.

- Already on ${SITE_NAME}: if ${SITE_NAME} already has the evaluation or the method, show the person its page. Then the contribution can be an improvement or a new version (use the form), an error report (see "Errors that you find"), or a different idea.
- Close copies: search for work that is almost the same: the same method, on the same task or the same models. Also look at the variants on ${SITE_NAME}. If you find a close copy, tell the person, with the link. Read that work: its future work, its limits, and what it did not test (models, tasks, baselines or settings). Then propose directions from these gaps. A replication on new models or on our evaluations can also be useful: say if it is.
- A specific change: the idea must say what is new, in specific terms, and why it could help. For a method: the change to the architecture, the training objective, the training data, or how it reads the model. For an evaluation: the new behavior, the new items or the new scoring. Other settings or more tuning are not enough, and tuning on evaluation items is not permitted. If the idea is only tuning, help the person find a real change.

## Reality check

An honest review of the work, so that the person sees its real value. Do it when the person asks ("Reality check"), when the person says that the idea is ready (checkpoint 1), and before the submission (checkpoint 5).

1. Give the biggest weakness first. Always check for scores near the top (a ceiling), a method that repeats how the evaluation made its labels, and a claim that the numbers do not support.
2. Rate 3 dimensions as Low, Medium or High, each with a reason in one line:
   - Novelty: the levels of step 3 ("None" is Low), compared with the closest work that you found.
   - Feasibility (before results): Low: it needs more money, time or skill than the person has. Medium: it fits, with risks. High: it fits easily.
   - Rigor (after results, in place of Feasibility). Low: no baseline, only a smoke run, or a claim that the numbers do not support. A clear null result with good controls can be Medium. Medium and High for each type:
     - A method or a variant. Medium: better than the harness's baseline and the best variant on ${SITE_NAME} for the same model, beyond the noise, on one core model. High: the same on several core models, with an ablation that shows why.
     - A model evaluation. Medium: the scorer is checked against human labels, and the results separate models beyond the noise. High: also not near the ceiling, with a check that it measures what it says.
     - A port. Medium: parity on one model. High: parity on 2 or more models, with the original judge.
     - An evaluation of safety methods. Medium: a method that should pass beats one that should fail, beyond the noise. High: also not near the ceiling, on several subject models.
     - A replication. Medium: it agrees with ${SITE_NAME} within the noise. High: on several models.
     - Beyond the noise: outside the 95% interval, with a paired test when the runs share items.
   - Safety value. Low: it does not change how people measure or improve safety, or it cannot rank (for example, all scores are near the top). Medium: it fills a gap that people need (a known limit or a missing comparison), or helps a known safety use. High: it beats the current best, or changes which method or evaluation people should use.
3. Give the strongest objection that an expert in the field would make. Base it on real sources (the limits in papers, critiques on the Alignment Forum, or a baseline that does better), with links. Do not make up quotes, and do not speak as a real person.
4. Give the closest work, and one next step that fixes the biggest weakness.
5. Ask the person: refine the work, or continue? (At checkpoint 1: refine, or start the build?)

Be honest. Do not change a rating because the person likes the work: change it only when the work changes. If you can start a sub-agent with a new context, give it the summary, the results, the README and the research log, but not the person's opinions, and let it do the review: it is less biased. Save each Reality check in the project file.

## Step 4: Build, test and submit

### Get the code

Clone ${REPO_URL} with \`git clone\`. It needs no account and no write access. Do not ask for push access to our repository. To submit, after checkpoint 5 and with the person's approval: fork the repository in the person's GitHub account, push a branch to the fork, and open the pull request from the fork. A fork of a public repository is public: the push makes the code, the research log, the contact email and the git commit email public. Tell the person this at checkpoint 5.

### The summary

Each submission starts with a short summary for the person who reviews it. Write it with the person, in plain words. Use 3 to 6 sentences (30 to 150 words), with no tables or lists, and only the numbers that matter most. Tell:

- what the person submits: a method variant, a new method, a model evaluation or a method evaluation harness;
- what it does or tests, and why that is important;
- what you ran it on;
- what you found, in words;
- the main limit.

Do not make the result look better than it is: a gain in the noise is not a gain. In a pull request, put the summary in \`README.md\` under \`## Summary\`, before the other sections, and at the top of the pull request text. The checks find a summary that is missing, too short or too long. With the form, start the text with the summary. An example, from \`submissions/examples/methods/probes/example-tail-8-probe\`:

> We submit a new variant of the Probes method. A probe is a lie detector that reads the activations of the model. This variant reads only the last 8 tokens of the reply, where the model gives its answer, and not the mean over all tokens. We fit it on Qwen3.5-4B with the Varied Deception harness. It got a balanced accuracy of 0.871, and the same probe with the usual readout got 0.864. The gain is in the noise, and the variant has a result on only one of the nine core models.

For a model evaluation, see the summary in \`submissions/examples/evals/example-code-review-sycophancy/README.md\`.

### A variant of a method with a harness (ready)

These methods have a harness, which runs our evaluations on your variant with the same code as our runs:

${harnessMethods}

If the person did not say which method, find it with them: show this list, and tell them what each method does. If none fits, see "A new method that a harness can run" below.

Follow the method's submit page, the harness README and \`submissions/README.md\` in ${REPO_URL}. A complete example is in \`submissions/examples/methods/probes/example-apollo-recipe\`. A small change to a recipe: \`submissions/examples/methods/probes/example-tail-8-probe\`. A new method: \`submissions/examples/methods/paraphrase-consistency\`.

0. Write the variant in \`submissions/<method>/<variant>/code/\` (start from the example that is nearest to the change, and copy its \`submission.json\` too), with its tests, and run the tests. This costs nothing, but the tests download the harness's packages (about 6 GB): ask the person first.
1. Give the cost of the smoke run and of the full run (checkpoint 2). On the person's own GPU, the cost can be only time. The smoke run uses a small test model to find errors; it is not a core model, and its results are not ranked.
2. Do the smoke run. Show the results, and fix the problems with the person (checkpoint 3). Then do the full run. Discuss its results (checkpoint 3), with \`node submissions/rank.mjs <results.json>\`: it shows where they would rank now. Smoke runs and full runs score eval items: fix errors after them (a crash, a wrong file), but a change for a better score is tuning on eval items. Make such choices on the validation split. If the person changes the variant after a run, write the change and why in \`recipe.evalItemsUsed\`, and go back to step 3.
3. Fill in \`submissions/<method>/<variant>/\`. Use the harness's pinned training data, or put new data on Hugging Face only if the variant uses new data. Run \`node submissions/check.mjs\` and the tests in \`code/tests\` (\`submissions/README.md\` gives the command). Write the fairness statement with the person (checkpoint 4), and show them the files (checkpoint 5) before you open a pull request.

### Links to the Submit form

For the paths with the form, give the person a link that fills in the form. Show them the text, and tell them to read the form before they submit it. The person submits the form, not you.

- The query (\`?type=...&name=...\`) fills in the fields. Each value can have at most ${FIELD_LIMITS.text} characters.
- The hash (\`#body=...\`) fills in the text box. It can also set the type (\`#type=incident&body=...\`). The browser does not send the hash, so the text does not go to ${SITE_NAME} until the person submits.
- URL-encode each value. If the link is longer than about 8,000 characters, or if you cannot run code to encode it, do not put the text in it: give the person the link without the text, and the text to paste. The text box holds more than a link can.

### A model evaluation (ready)

Follow \`submissions/evals/README.md\` in ${REPO_URL}, and copy an example in \`submissions/examples/evals/\` (\`example-code-review-sycophancy\` for a new eval, \`example-sycophancy-eval\` for an Inspect Evals task, \`example-or-bench\` for a port). We run evaluations with Inspect (https://inspect.aisi.org.uk/). Find out which kind the evaluation is:

- \`inspect_evals\`: it is in the \`inspect-evals\` package. Write only \`eval.json\` and \`submission.json\`.
- \`port\`: it has its own code. An entry of the Inspect Evals register (code outside the package) is a \`port\` too: port the authors' original code (if the authors released no code, port the register's code, and say so in the notes). Port it to an Inspect task, with tests. Run the original and the port on the same 20 or more samples with the same model, and write the results in \`parity.json\`. If the original's judge model is too expensive or no longer available, use one other judge for both, and say so in the notes.
- \`new\`: write the Inspect task and its tests. Pilot on a local file if the items can still change. Then put the dataset on Hugging Face at a commit, in a private repo until the person approves. Put a canary string in each item. Recommend a held-out split to the person: keep about a quarter of the items out of the public dataset, in a second repo that is gated with manual approval, and give access only to the Hugging Face user \`neuronpedia-org\` (ours). We run it to find contamination; the site shows only the public items.

1. Write the files. Run the check, the tests, and a mock run (\`check_eval_task.py\`). They cost nothing, but the first \`uv run\` in \`apps/runner\` installs about 2 GB of packages: tell the person first. With less space, use the small environment in \`submissions/evals/README.md\` (step 5). For a port, the check gives the error "parity.json: required for a port" until the parity runs: that is expected.
2. Give the cost of a run on a real model before you start it (checkpoint 2). Count the calls to the judge models too: they can be most of the cost. The commands in an Inspect Evals README often run all samples: start with \`--limit 20 --sample-shuffle 42\` on a cheap model (add \`-T shuffle=false\` if the task has a \`shuffle\` argument). Give a seed other than 0 or 1: Inspect reads 1 as "true", a shuffle with no seed, so each model gets different samples. Read some samples with the person: does the model give an answer that the scorer can read, does the scorer mark it correctly, and is the direction right (checkpoint 3)? With a reasoning model, check that the scorer and the judge do not read the reasoning. The reasoning also uses the token limit: with a low limit, look for empty replies. If a run shows an error in the person's own items, fix the dataset at a new commit and run again, or list the error in the README. Do not change or remove an item because a model fails it.
3. Write the contamination plan or the parity notes with the person (checkpoint 4). Show them the files (checkpoint 5) before you open a pull request. The dataset must be public before we merge, so that we can run it: ask the person. A held-out repo stays gated.

To change an evaluation that ${SITE_NAME} already has (a fix, a new metric, other task arguments), use the form for now: \`type=evaluation\`, with the link to its page, and start the text with "A change to <evaluation>".

If the person only wants to suggest an evaluation, collect: the name; what it measures; the dataset, its size and its license; how it scores each sample, and which result is safer; the judge models, if any; a link to the paper, code or data; and if it is public, partly private (a held-out set) or private. Then write the text, and give the person this link (\`access\`: public, partly or private):
${form}?type=evaluation&tests=models&access=public&name=<name>&link=<url>#body=<text>

### A new method that a harness can run (ready)

A harness runs a kind of file, not only one method. For example, the Varied Deception harness runs any lie detector, and the sparse autoencoders harness runs any SAE. If an existing harness can run the new method, follow "A new method" in \`submissions/README.md\` in ${REPO_URL}:

1. Choose the harness: the one whose README accepts the kind of file that the method makes. If none does, use the form (below).
2. Write \`submissions/<method>/method.json\` with the person: what the method does, its safety use, its caveats and its params. Copy the form of a method in \`data/seed/methods/\`.
3. Make the first variant as in "A variant of a method with a harness" above, with \`harness\` in its \`submission.json\`. There is no submit page for a new method: use the harness's \`submission/README.md\`.
4. Run \`node submissions/check.mjs\`. Show the person the files (checkpoint 5) before you open a pull request.

Some harnesses rank a variant only when it has a recipe that we can fit on each core model (Varied Deception). A method with no training uses a recipe with no training data, as the harness README says. If it calls the subject model, some core models have no API, so it needs a GPU for them: tell the person before checkpoint 2.

### A new method that no harness can run, or a variant of a method with no harness (form only for now)

Collect a link to the code or weights, the results that the person has, and the recipe: the data and its size, how they chose the settings, and if they used items of our evaluations. Write the text, and give the person this link:
${form}?type=method&method=<method>&variant=<variant>&link=<url>#body=<text>
If the method has a harness, the form shows the harness first. Tell the person to click "My variant does not fit the harnesses" to see the fields and the text.

### An evaluation of safety methods (ready)

Write a harness (see the top of this guide). Follow \`submissions/harnesses/README.md\` in ${REPO_URL}, start from \`submissions/harnesses/_template\` (\`submissions/examples/harnesses/example-city-facts\` is the template filled in), and copy the style of a harness in \`evals/\` (\`evals/varied-deception\` is a good one). If a harness already runs the same kind of file, use its interface.

1. Write the scoring and its tests first, and fix the free errors of the check. These cost nothing. If the person has no GPU, the baseline run can use a detector that needs no GPU (an LLM monitor through an API, or a control such as text length); we run the GPU methods after we accept the harness.
2. Give the cost of making the data (for example, replies of a model), of the smoke run and of the full run (checkpoint 2).
3. Make the data, and check the license of each dataset that you use. Pin it on Hugging Face at a commit (a private repo until the person approves), with the sha256 of each file. Give people a split that they can train on, apart from the eval items. The detector must not see the label: give it the chat without a system prompt that asks for a lie.
4. Smoke-run the harness with \`--limit\` on the smallest subject model that has data, and read some outputs with the person (checkpoint 3).
5. Commit the folder (a local commit is enough). Run it in full on a known artifact (a variant on the site, or a baseline), on the pinned data. If it scores near the top, tell the person: the eval cannot rank strong methods. Save the output as \`baseline-results.json\`, and write the command and the scores in the README ("Self-test").
6. Write the fairness statement and the data's license with the person (checkpoint 4). Run the check and the tests. Show the person the files (checkpoint 5). The dataset must be public before we merge, so that we can run it: ask the person.

If the person only wants to suggest an evaluation, collect what it tests, the methods and models that it can test, how it scores a method, the data and its license, and a link to the code. Write the text, and give the person this link:
${form}?type=evaluation&tests=methods&name=<name>&link=<url>#body=<text>

## Step 5: The research log

While you work, keep a short log in the project file (step 0): the guide version (${AGENT_GUIDE_VERSION}), the AI models and tools that did the work (for example, your model and its version, and the agent app), the person's first idea and novelty level, the sources that you read, the close copies that you found, the directions that you considered and why the person chose one, the pilots and their results, and the decisions. It helps us follow the person's line of research.

At the end, ask the person if they agree to share the log, or only their prompts, with the submission. Tell them that it includes the names of the AI models and tools. Share it only if they agree, and remove private information first. In a pull request, put it in \`research-log.md\` in the submission folder. With the form, add it to the text.

## Step 6: Feedback on this guide

At the end (after the submission, or when the person stops), ask the person if they want to give us feedback on this guide: a rating from 1 (poor) to 5 (very good), what helped, and what was hard or wrong. Add your own notes, with the person's approval: steps that were not clear, commands that failed, and checks that gave wrong errors. Do not include secrets, personal data or eval content. The person sends it with this link, and an email is optional:
${form}#type=other&body=<text>
Start the text with "Guide feedback (version ${AGENT_GUIDE_VERSION}). Rating: <1 to 5>."

## Review evaluations for errors

Some items in an evaluation have errors: a wrong label or answer, more than one correct answer, missing context, or a scorer that marks a good reply as failed. These errors make the results less correct for all models. The items that the most models fail are the best place to look: if all models fail an item, the item can be wrong.

Do step 2 in short (the person's level, budget and time). Do not do steps 3 and 4. Then:

1. Choose the evaluations with the person. The list is at ${url}/models. For the most failed items of an evaluation, get ${url}/evaluations/<slug>/failed.json (add \`?limit=\` for more than 100). It gives each item's ID (\`sourceId\`), its split, how many graded replies failed and the evaluation's dataset, with no text. The same IDs and counts are in the list of samples on the evaluation page. They are open to AI agents; the text of the items is not.
2. Find out what "failed" means in this evaluation: read its page and its scorer. In a test of skill, a failed item is a wrong answer. In a test of harm (for example, AgentHarm), a failed item is a harmful reply: there, many failures can show a scorer error, but they are not a sign of a wrong label.
3. Read the known errors at ${url}/evaluations/known-errors, so that you do not report an error again.
4. Get the items from the source, not from ${SITE_NAME}. \`failed.json\` gives the dataset (often on Hugging Face) and its pinned revision (\`dataset.revision\`). Use that revision, and find each item by its ID. Some datasets need the person to accept their terms first, with their own account. Read the scorer code too (for example, the Inspect Evals task of the same name).
5. For each item, decide: a wrong label or answer, more than one correct answer, an unclear or broken item, a scorer error, or a hard item with no error. Most items that models fail are only hard: say so, and do not report them. Give your evidence (for example, an official source) and say how sure you are.
6. The replies of the models are eval content, so you cannot read them on ${SITE_NAME}. To check a scorer, ask the person to open the item's page in a browser and tell you what they see. Or run the evaluation on only those items, on a model with a low cost (checkpoint 2: tell the cost first). If the person can do neither, report only the errors in labels and items: they need no replies.
7. Show your findings to the person. For each error that they agree with, follow "Errors that you find" below: one report for each evaluation, with all its items.

Do not publish the items, and do not copy them into other files. At the end, ask for feedback on this guide (step 6).

## Errors that you find

While you work, you can find an error in what you test against. For example: an evaluation item with a wrong label or answer, a sample that the scorer marks wrongly, a bug in a harness, or a wrong result or page on ${SITE_NAME}. Reviews of samples from method variants often find these.

1. Stop and tell the person: what is wrong, where (the evaluation, its version and the item or sample ID, or the link to the page), and your evidence. Say how sure you are.
2. Ask the person if they want to report it. A report helps all people who use the evaluation.
3. If they do, write a short report: the link, the evaluation and its version, the item or sample ID, what is wrong, the evidence, and the fix that you suggest. Do not copy more of the item than the report needs. Give the person this link: ${form}?type=other&link=<page>#body=<text>. The person submits the form. If the error is in the dataset or code of other authors (for example, an Inspect Evals scorer), suggest that the person tells them too, for example in an issue in their repository. If ${SITE_NAME} does not have the evaluation yet, describe the error in the submission's README in place of the form.
4. Do not fix it quietly. Keep the item in the results that you submit, and do not change its score. You can also give a second result without the item, with a clear label, and tell why in the submission.

## Incidents and commitments

Do not do ideation for these, but find and check the public sources (links and dates) for the person. First ask about sensitive data (below). Then ask the questions below, one or two at a time, and write the text from the answers. Write claims as claims, with their sources, in neutral words. Leave out the person's opinions, or mark them as the person's own. Check that it has no private information (names of private people, even when public sources name them, email addresses, passwords, keys, and other people's personal data), show the text to the person, and give them a link to the form (see "Links to the Submit form" in step 4). The person submits the form. Tell the person that a submission is not anonymous, and that the email field is optional: we reply by email. At the end, ask for feedback on this guide (step 6).

### Sensitive data

Before the questions, ask the person if the report has sensitive data. For example: passwords, API keys and other secrets, private chats, health or money data, other people's personal data, confidential data from work, or a security flaw that is not fixed yet. If it does, tell the person not to give that data to you or to any AI agent. If a password or key was in a log that an AI agent or another person saw, tell them to change it now. Then they can choose:

- Go on with you, and describe what happened in their own words, without that data. A short fact such as "I lost about $400" is good; account numbers, phone numbers and private chat logs are not.
- Write the report in the form themselves.

If the person already pasted sensitive data, tell them, do not repeat it, and do not put it in the report or in a file. For a security flaw that is not fixed, they must tell the organization first.

### An incident

An AI system did something harmful or unsafe in real use. Ask:

1. What happened? Give the steps in order.
2. When did it happen?
3. Which AI system: the model and its version, the product or agent, and the organization?
4. What was the harm, or the risk of harm?
5. What evidence do you have: public links, or logs?
6. Can other people make it happen again?
7. Did you tell the organization? What did they reply?
8. Do you want credit for the report, and under what name? (It goes in \`reportedBy\`. Leave it out if not.)

Check that ${SITE_NAME} does not have the incident yet: read the organization's page (${url}/<organization>/incidents), and tell the person what you found. If the organization has no page, say so.

Then write the report yourself, from the answers and the public sources, in the format below. The answers of the person are a source, as "logs and documents" are in the format. Put the answers to questions 6 and 7 in the description, if they are known. Put the name from question 8 in \`reportedBy\`, or leave the field out. If a value is not known, leave out its field. If the organization is not known, ask the person for it; do not guess. A link to the person's own post can identify them: ask before you add it. Use only public logs, or logs with no personal data and no secrets. If the person does not want their own organization named, leave it out, and leave out details that identify it. A report with no public source is good: tell the person that we review it before we publish it, as a claim ("..., a User Says").

\`\`\`\`text
${INCIDENT_REPORT_FORMAT}\`\`\`\`

The link: ${form}#type=incident&body=<the JSON>. The form has only a text box.

### A commitment

An organization's public safety policy or process that ${SITE_NAME} does not show, or shows wrongly. A kept or broken commitment (for example, a missed deadline) goes here too; harm in real use is an incident. Ask:

1. Which organization?
2. What is the commitment? If the person has no link, find the public source. Give its dates: when the organization made it, the deadline (if any), and when it kept or broke it.
3. What is wrong or missing on ${SITE_NAME}? Check the organization's page (${url}/<organization>/commitments) yourself, and show the person what it shows.

A claim from inside the organization with no public source (for example, what an employee said in private) does not go in the report: it can identify that person. The person can ask that person to report it, or find a public source.

Start the text with 2 or 3 plain sentences: the organization, the commitment, and what is wrong or missing on ${SITE_NAME}.

The link: ${form}?type=other&link=<the source>#body=<text>.

## What happens next

We read each submission and reply by email in ${REPLY_TIME}. For a method variant, we run the harness on our hardware, at our cost, and only our run goes on the site. Submitting does not guarantee that we accept the work. Questions: ${SUPPORT_EMAIL}
`;
  return new Response(body, {
    headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
