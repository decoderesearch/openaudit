// Runs after `opennextjs-cloudflare build`. OpenNext copies the `.env*` files into the Worker, and
// `.env.local` holds our secrets. This empties that copy, so the Worker reads only its own vars and
// secrets (`.dev.vars` in preview). Then it fails if any secret from the env files is still in the
// output.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.open-next');
const SECRET_NAME = /KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL|DIRECT_URL/;

fs.writeFileSync(
  path.join(OUT, 'cloudflare', 'next-env.mjs'),
  ['production', 'development', 'test'].map((mode) => `export const ${mode} = {};\n`).join(''),
);

const secrets = new Map();
for (const name of fs.readdirSync(ROOT).filter((f) => f.startsWith('.env') && f !== '.env.example')) {
  for (const line of fs.readFileSync(path.join(ROOT, name), 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?(.*?)["']?\s*$/);
    if (match && SECRET_NAME.test(match[1]) && match[2].length >= 12) {
      secrets.set(match[2], `${name}:${match[1]}`);
    }
  }
}

function* files(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (entry.isFile()) yield full;
  }
}

const leaks = [];
for (const file of files(OUT)) {
  const text = fs.readFileSync(file, 'latin1');
  for (const [value, source] of secrets) {
    if (text.includes(value)) leaks.push(`${source} in ${path.relative(ROOT, file)}`);
  }
}
if (leaks.length) {
  console.error(`Secrets in the Worker build. Do not deploy it:\n  ${leaks.join('\n  ')}`);
  process.exit(1);
}
console.log(`Worker build has no env-file secrets (checked ${secrets.size}).`);
