// Writes lib/runs/runner-packages.json: the versions in uv.lock of the packages that seed eval
// versions pin. Run it after each change to a pin or to uv.lock.
//
//   pnpm runner:packages
import { lockedVersions, parsePin, runnerPins, type Locked } from '@/lib/runs/runner-pins';
import type { EvalRunner } from '@openaudit/spec';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
export const OUT = fileURLToPath(new URL('../lib/runs/runner-packages.json', import.meta.url));

/** The packages that seed Inspect versions pin, at their uv.lock versions. */
export function currentPackages(): Locked {
  const dir = root('data/seed/evals');
  const names = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap(
      (f) => (JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as { versions: { runner?: EvalRunner }[] }).versions,
    )
    .flatMap((v) => (v.runner?.kind === 'inspect' ? runnerPins(v.runner) : []))
    .flatMap((pin) => parsePin(pin!)?.name ?? []);
  return lockedVersions(readFileSync(root('uv.lock'), 'utf8'), names);
}

export const packagesJson = (packages: Locked) => `${JSON.stringify(packages, null, 2)}\n`;

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const packages = currentPackages();
  writeFileSync(OUT, packagesJson(packages));
  console.log(`Wrote ${Object.keys(packages).length} packages to ${OUT}`);
}
