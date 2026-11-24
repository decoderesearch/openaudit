# OpenAudit

[OpenAudit](https://openaudit.com) is an open record of AI model safety. It collects what labs
publish (system cards, safety reports, commitments, incidents), runs public safety evals on the
models itself, and shows all of it with the sources, the transcripts and the logs.

This repo has the site, the eval runner, the data and the submission checks.

## Parts

| Folder | What it is |
| --- | --- |
| `apps/web` | The site: Next.js on Cloudflare Workers (OpenNext), Postgres with Prisma. |
| `apps/runner` | The eval runner (Python, [Inspect](https://inspect.aisi.org.uk)). It takes runs from the queue, runs them, and imports the results, cards and flagged chats. |
| `apps/runner-cloud` | The Cloudflare Worker that starts runner containers from the run queue, and its crons. Only our hosted queue needs it. |
| `spec` | The data schemas (YAML) and the TypeScript, Python and Swift types made from them (`pnpm spec:generate`). |
| `data` | Seed data (`data/seed`), text extracted from documents (`data/extracted`) and the scripts that make them (`data/scripts`). |
| `evals` | Harnesses that run our evals of safety methods (lenses, probes, sparse autoencoders). |
| `submissions` | Method variants, evals and harnesses that others send, and the checks for them. |

## How it works

- **Data.** The seed files in `data/seed` hold organizations, models, documents, commitments,
  incidents, evals and methods. `pnpm seed:import` (in `apps/web`) loads them into Postgres.
- **Runs.** A run request goes to a queue. The runner runs the Inspect task, stores the log in an
  S3-style bucket (Cloudflare R2), and imports the scores, the samples and the flagged chats.
- **Cards.** After runs end, the runner builds each model's OpenAudit card: a summary of its eval
  results, with links to the chats that support each point.
- **Known errors.** Samples with a dataset error (for example a wrong answer key) are left out of
  the adjusted pass rates. Staff confirm each one. See `EVAL_KNOWN_ERRORS.md`.

## Quick start

You need Node 24, pnpm, [uv](https://docs.astral.sh/uv/) and Postgres 16.

```sh
pnpm install
createdb openaudit_dev                       # the database in apps/web/.env.localhost
cd apps/web
pnpm db:deploy                               # migrations
pnpm seed:import --apply                     # seed data
pnpm dev                                     # http://localhost:3300
```

`apps/web/.env.localhost` has the local defaults. Put your own values and secrets in
`apps/web/.env.local` (gitignored); `apps/web/.env.example` lists each variable. Cloudflare is not
needed for local work: rate limits, the password gate and Hyperdrive are off outside Workers.

To run an eval, the runner needs a bucket (`R2_S3_ENDPOINT`: R2, S3 or MinIO) and model API keys
(OpenRouter). See `apps/runner/openaudit_runner/cli.py` for its commands.

## Guides

- [Contributing](CONTRIBUTING.md): setup, checks and pull requests.
- [Add a model](ADD_MODEL.md), [import a system card](IMPORT_SYSTEM_CARD.md),
  [add an eval](ADD_AN_EVAL.md), [add a method](ADD_A_METHOD.md),
  [add an eval of methods](ADD_A_METHOD_EVAL.md), [add an incident](ADD_INCIDENT.md),
  [update commitments](ADD_COMMITMENT.md), [known errors](EVAL_KNOWN_ERRORS.md).
- [Submit a method variant, an eval or a harness](submissions/README.md).
- [Model ladders](spec/model-ladders.yaml): the default models for our own LLM jobs and eval
  judges. After a change, run `pnpm spec:generate`.

## License

The code is under the [Apache License 2.0](LICENSE). Our own data and text (the seed files, scores,
run settings and other metadata that we write) are under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): credit OpenAudit and link to
openaudit.com. Eval content and content from others (documents and quotes from them, dataset
samples, model outputs) keep the terms of their source.

## Security

See [SECURITY.md](SECURITY.md).
