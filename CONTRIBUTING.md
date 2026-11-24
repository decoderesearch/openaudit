# Contributing

Thank you for your help. We accept pull requests for the code, the data and the docs.

- **A new method variant, eval or harness:** follow [`submissions/README.md`](submissions/README.md).
  We run each accepted submission on our own machines.
- **An error on the site or in the data** (a wrong score, a wrong label, a bad source): use the
  Report button on the page, or the Submit form on [openaudit.com](https://openaudit.com). A pull
  request that fixes a seed file is also good.
- **A security problem:** do not open an issue. See [SECURITY.md](SECURITY.md).
- **A large change:** open an issue first, so that we can agree on the plan.

## Setup

You need Node 24, pnpm, [uv](https://docs.astral.sh/uv/) and Postgres 16. Follow the quick start in
the [README](README.md). `pnpm install` also sets the Git hooks (`.githooks`).

## Checks

| Command | What it does | When |
| --- | --- | --- |
| `pnpm lint` | ESLint and TypeScript | Before each commit (hook) |
| `pnpm test` | Unit tests (Vitest, `node --test`, pytest) | Before each commit (hook) |
| `pnpm spec:check` | The generated spec files match `spec/schemas` | Before each push (hook) |
| `pnpm test:db` | Database tests | Before each push (hook) |
| `pnpm test:e2e` | Page tests (Playwright) | Before each push (hook) |

The push checks need the local Postgres, with the test database in `apps/web/.env.test`. Each pull
request runs the same checks in CI.

## Pull requests

- Keep each pull request to one change. Say what it changes and why.
- Add or change tests for a change in behavior.
- After a change to `spec/schemas`, run `pnpm spec:generate` and commit the generated files.
- Do not commit secrets, `.env.local`, or personal paths.
- Agents: read [`AGENTS.md`](AGENTS.md) and the `AGENTS.md` file of the app that you change.

## Style

- Write docs, comments and site text in simple, short sentences (ASD-STE100 Simplified Technical
  English). Comments say what the code cannot show; they do not tell the history of a change.
- Follow the style of the code around your change. The UI rules are in
  [`apps/web/AGENTS.md`](apps/web/AGENTS.md).
- Prettier formats TypeScript and JSON (`pnpm --filter @openaudit/web format:write`).

## License

By sending a pull request, you agree that your contribution is under the
[Apache License 2.0](LICENSE).
