// Checks data/seed/commitments/*.json. Prints each problem and exits with 1 when there is one.
//
//   pnpm exec tsx scripts/check-commitments.ts
import schema from '@openaudit/spec/schema.json' with { type: 'json' };
import addFormats from 'ajv-formats';
import Ajv2020 from 'ajv/dist/2020.js';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crossProblems, parseCommitment, type CommitmentFile } from './commitments';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const DIR = join(ROOT, 'data', 'seed', 'commitments');

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats.default(ajv);
ajv.addSchema(schema);
const validate = (type: string, record: unknown) => {
  const check = ajv.getSchema(`${schema.$id}#/$defs/${type}`)!;
  return check(record) ? null : ajv.errorsText(check.errors);
};

const seed = JSON.parse(readFileSync(join(ROOT, 'data', 'seed', 'system_cards.json'), 'utf8')) as {
  organizations: { id: string; slugAliases: string[] }[];
};
const orgs = new Set(seed.organizations.flatMap((o) => [o.id, ...o.slugAliases]));

const problems: string[] = [];
const parsed: CommitmentFile[] = [];
let events = 0;
let cells = 0;
for (const name of readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()) {
  const r = parseCommitment(readFileSync(join(DIR, name), 'utf8'), `data/seed/commitments/${name}`, validate, orgs);
  problems.push(...r.problems);
  if (!r.parsed) continue;
  parsed.push(r.parsed);
  cells += r.parsed.orgs.length;
  events += r.parsed.orgs.reduce((s, o) => s + o.events.length, 0);
}
problems.push(...crossProblems(parsed));
for (const p of problems) console.log(`! ${p}`);
console.log(
  `${parsed.length} commitments, ${cells} organization entries, ${events} events, ${problems.length} problems`,
);
if (problems.length) process.exitCode = 1;
