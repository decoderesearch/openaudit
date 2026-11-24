// Runs a command with the env files loaded. The environment that called us wins over all files.
//
//   node scripts/with-env.mjs <command> [args...]          .env.localhost, then .env.local
//   node scripts/with-env.mjs --test <command> [args...]   .env.localhost, then .env.test
//
// `.env.localhost` and `.env.test` hold committed defaults for local Postgres. `.env.local` is
// gitignored and may point at a Neon branch; test runs never read it, so tests cannot touch it.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const out = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

let argv = process.argv.slice(2);
const isTest = argv[0] === '--test';
if (isTest) {
  argv = argv.slice(1);
}
const [command, ...args] = argv;
if (!command) {
  console.error('Usage: node scripts/with-env.mjs [--test] <command> [args...]');
  process.exit(1);
}

const files = isTest ? ['.env.localhost', '.env.test'] : ['.env.localhost', '.env.local'];
let fileEnv = {};
for (const name of files) {
  fileEnv = { ...fileEnv, ...parseEnvFile(path.join(ROOT, name)) };
}
// A test run keeps the test database even if the shell exports DATABASE_URL.
const env = isTest ? { ...process.env, ...fileEnv } : { ...fileEnv, ...process.env };

const child = spawn(command, args, { cwd: ROOT, stdio: 'inherit', env, shell: process.platform === 'win32' });
child.on('error', (err) => {
  console.error(`Cannot run "${command}": ${err.message}. Run it through pnpm, so node_modules/.bin is on PATH.`);
  process.exit(127);
});
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
