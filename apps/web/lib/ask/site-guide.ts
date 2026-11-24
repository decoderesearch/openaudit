// The site assistant's guide to the site: what each page is, the words that the site uses, and how
// to read the main pages. `lib/ask/knowledge.ts` puts it before the FAQs, the Why OpenAudit
// reasons and the Contribute page. `knowledge.test.ts` checks that each path here is a page.
// Change this file when you add, move or remove a page (see "The site assistant" in AGENTS.md).

export const SITE_GUIDE = `# What OpenAudit is

OpenAudit is an independent source for safety evaluations of AI models, AI organizations and safety methods. Decode Research, a non-profit, runs it. Results come from evaluations that we run ourselves, and from public sources such as system cards. OpenAudit keeps the raw data (logs, artifacts, metrics) so that people can check and repeat the results.

# The pages (site map)

Home and help
- / : the home page. Three lists: Models (with Deploymeter scores), Organizations (with commitment points), and Safety Methods (method evaluations with their top 3 methods). The hero has Get Started (a box with the Full and Short Tutorials of the Features page) and Contribute (the How to Contribute page). The Help menu (the "?" in the navbar) has these two, Features and FAQs.
- /features : OpenAudit Features. The reasons for the site, each with a problem, a solution, examples and caveats, and guided tours.
- /faqs : Frequently Asked Questions.
- /contribute : How to Contribute. Agent prompts and paths for each kind of contribution.
- /contribute/agents.md : the guide for AI agents that help a person contribute.
- /submit : the Submit form: an incident, an evaluation, a method, or other feedback and errors.
- /terms and /privacy : the Terms of Service and the Privacy Policy.

Models
- /models : all models, with their Deploymeter scores and evaluation results.
- /models/compare : compare models side by side: evaluation results, flagged chats and Deploymeter scores.
- /<owner>/<repo> : a model page, for example /google/gemini-3.1-flash-lite. The default tab shows our results: the Deploymeter score, a summary, flagged chats and the evaluations that we ran. The System Card tab (/<owner>/<repo>?tab=system-card) shows what the lab's own documents say.
- /<owner>/<repo>/cards and /<owner>/<repo>/cards/<card> : the lab's system cards, with the data that we extracted (findings, safety framework verdicts, topics, external testers, results), each with its page number and quote.
- /<owner>/<repo>/reports/<report> : other reports about the model (technical reports, safety reports).
- /judges : the Deploymeter judges. /judges/<lab>/<model> : one judge. /judges/<lab>/<model>/<review> : one full review by a judge.

Evaluations of models
- /evaluations : all model evaluations that we track and run.
- /evaluations/<slug> : one evaluation, for example /evaluations/agentharm: what it tests, how it scores, its results for each model, and its samples.
- /evaluations/<slug>/samples : the evaluation's samples (eval content: only for people, after their statement).
- /evaluations/known-errors : errors that we found in evaluation items, such as wrong answer keys. /evaluations/<slug>/known-errors : the errors of one evaluation.
- /evaluations/suites/<suite> : a suite: a group of evaluations from one source.
- /topics : safety topics, with the evaluations of models and of methods for each. /topics/<topic> : one topic.

Runs
- /runs/<id> : one run of an evaluation on a model: its scores, settings, cost and samples.
- /runs/<id>/attempts/<n> : one attempt: the full chat (transcript) of a model on one sample, with its score.
- /runs/<id>/samples/<sample> and /samples/<id> : one sample and the attempts of each model on it.
- /runs/mine : "My Evals", the runs of the signed-in person.

Safety methods
- /methods : the safety methods (for example probes, LLM monitors, sparse autoencoders, workspace lenses) and the evaluations that test them.
- /methods/<method> : one method, with its variants and their results.
- /methods/<method>/<variant> : one variant of a method.
- /methods/<method>/artifacts/<id> : a file that a variant made, such as trained probe weights.
- /methods/<method>/submit : how to submit a variant of this method.
- /methods/leaderboards/<task> : a leaderboard: the methods ranked on one method evaluation.
- /evaluations/<slug>/methods/<method>/<variant> : the results of one variant on one method evaluation.

Organizations
- /organizations : the organizations (AI labs and companies), with their commitment points, incidents and departures.
- /organizations/commitments : the safety commitments dashboard: which organizations made which commitments, and how far.
- /organizations/commitments/<commitment> : one commitment across all organizations, for example /organizations/commitments/rd-pause.
- /<org> : an organization page, for example /anthropic: its feed of commitments, incidents and departures, and its models.
- /<org>/commitments and /<org>/commitments/<commitment> : the organization's commitments, and one of them with its evidence and score.
- /<org>/incidents and /<org>/incidents/<incident> : the organization's incidents, and one incident with its details, chat logs and sources.
- /<org>/departures : notable people who left the organization.
- /<org>/models : the organization's models.

Account
- /signin, /settings : sign in, and the settings (email updates). Updates in the navbar subscribes to email updates: at most one email each week.

# Words that the site uses

- Deploymeter: the % score on a model. A panel of 9 AI judges, each from a different lab, reads the anonymized results of our evaluations and the flagged chats. Each judge answers "Should this model be widely deployed, based on its safety evaluations and capabilities?" with a % and a decision (Approve, Limited Approval or Disapprove). The score is the median of the judges' scores. A high score does not mean a safe model, because our evaluations are often outdated. See /faqs#percentage.
- Flagged chats: chats from our runs that another AI marked as the most concerning (for example, real help with a weapon). Their count shows on model pages.
- Evaluation (eval): a test. A model evaluation tests models. A method evaluation tests safety methods (for example, how well a lie detector finds lies).
- Run: one evaluation on one model, with its settings. An attempt: one model's reply to one sample in a run. A sample (item): one question or task of an evaluation.
- Score and pass rate: each attempt gets a score; the run shows its metrics. "Safer" depends on the metric: the site shows which direction is safer.
- Known errors: evaluation items with a wrong answer key or a scorer that marks a good reply as failed. The evaluation pages leave the confirmed ones out of their Adjusted Pass Rate.
- Release-date warning: the model was released after the evaluation's data was public, so the model may have seen the items in training. Most public evaluations are older than the newest models, so their scores can look better than they are (see /faqs#outdated).
- System card: a lab's own report about a model. The System Card tab shows what the lab says; the default tab shows what we found.
- Safety commitment: a policy or process that an organization committed to in public. Commitment points: how many parts of the commitment the organization meets. A commitment that cannot be checked independently gets half its points. See /faqs#commitments.
- Incident: an event where an AI system or an organization caused or nearly caused harm, or broke a commitment. Departure: a notable person who left an organization.
- Safety method: a tool that inspects or monitors a model, for example a probe (a lie detector that reads the model's activations), an LLM monitor, a logprob classifier, a sparse autoencoder (SAE) or a workspace lens. A variant: one version of a method (its recipe and settings). A harness (method evaluation harness): code that runs a method evaluation on a variant, with the same code as our runs.
- Eval content: samples, attempts, transcripts, excerpts and logs. Only people can see it, after a statement that they are not an AI agent and will not train on it. Some of it shows harmful text.
- Canary GUID: a string on our pages that tells AI developers to keep this content out of training data.

# How to read the main pages

- A model page: start with the Deploymeter % and its summary. Then the evaluations: each row is one run, with its score and if a safer score is higher or lower. Read the results with care: many evaluations are older than the model.
- An evaluation page: what it tests, how it scores (the metrics and which direction is safer), the results of each model, and its known errors.
- A method evaluation (leaderboard): the methods ranked on one task, for each subject model. A higher rank is better at the safety job, for example finding lies.
- The commitments dashboard: each row is an organization, each column a commitment. A cell shows the points, and if they are verified.

# Limits of the site

- Public evaluations are often older than the newest models, so the newest models can have no results or results that look too good (see /faqs#newest-models).
- For closed models, we test the model through its API, with the lab's safeguards. This can make closed models look safer.
- OpenAudit is a first version. Results can have errors: report them with /submit.`;
