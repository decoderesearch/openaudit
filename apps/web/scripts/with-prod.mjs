// Runs a command on the Neon `production` branch. Call it through with-env.mjs, so the Neon keys load.
//
//   node scripts/with-env.mjs node scripts/with-prod.mjs <command> [args...]           read-only
//   node scripts/with-env.mjs node scripts/with-prod.mjs --write <command> [args...]   writes allowed
//
// The prod URL goes only into the child env, and the output hides it. Read-only mode sets
// `default_transaction_read_only`, so Postgres refuses each write.

import { spawn } from 'node:child_process';

let argv = process.argv.slice(2);
const write = argv[0] === '--write';
if (write) {
  argv = argv.slice(1);
}
const [command, ...args] = argv;
if (!command) {
  console.error('Usage: node scripts/with-prod.mjs [--write] <command> [args...]');
  process.exit(1);
}

const { NEON_API_KEY, NEON_PROJECT_ID } = process.env;
if (!NEON_API_KEY || !NEON_PROJECT_ID) {
  console.error('NEON_API_KEY and NEON_PROJECT_ID are not set. Run this through scripts/with-env.mjs.');
  process.exit(1);
}

async function neon(path) {
  const res = await fetch(`https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}${path}`, {
    headers: { Authorization: `Bearer ${NEON_API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Neon API ${path}: HTTP ${res.status}`);
  }
  return res.json();
}

const { branches } = await neon('/branches');
const prod = branches.find((b) => b.name === 'production');
if (!prod) {
  throw new Error('No Neon branch has the name "production".');
}
const { databases } = await neon(`/branches/${prod.id}/databases`);
if (databases.length !== 1) {
  throw new Error(`Expected 1 database on production, got ${databases.length}.`);
}
const db = databases[0];
const query = new URLSearchParams({
  branch_id: prod.id,
  database_name: db.name,
  role_name: db.owner_name,
  pooled: 'false',
});
const { uri } = await neon(`/connection_uri?${query}`);

const url = new URL(uri);
if (!write) {
  url.searchParams.set('options', '-c default_transaction_read_only=on');
}
const dbUrl = url.toString();
console.log(`Target: Neon branch "${prod.name}", database "${db.name}", ${write ? 'WRITES ALLOWED' : 'read-only'}.`);

const env = {
  ...process.env,
  DATABASE_URL: dbUrl,
  DIRECT_URL: dbUrl,
  NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || '.next-prod',
};
const hide = (s) => s.replaceAll(dbUrl, '<url>').replaceAll(uri, '<url>').replace(/postgres(ql)?:\/\/\S+/g, '<url>');
const child = spawn(command, args, { env, stdio: ['inherit', 'pipe', 'pipe'], shell: process.platform === 'win32' });
child.stdout.on('data', (d) => process.stdout.write(hide(d.toString())));
child.stderr.on('data', (d) => process.stderr.write(hide(d.toString())));
child.on('error', (err) => {
  console.error(`Cannot run "${command}": ${err.message}. Run it through pnpm, so node_modules/.bin is on PATH.`);
  process.exit(127);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => {
  if (signal) {
    process.removeAllListeners(signal);
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
