import type { EvalRunner } from '@openaudit/spec';
import locked from './runner-packages.json';

// The versions of the packages that eval versions pin, as the runner's uv.lock has them.
// `pnpm runner:packages` writes runner-packages.json.

export type Locked = Record<string, string>;

const LOCKED: Locked = locked;

/** The package name as PyPI compares it: `Inspect_Evals` is `inspect-evals`. */
export const packageName = (name: string) => name.toLowerCase().replace(/[-_.]+/g, '-');

/** `inspect-evals[agentdojo]==0.22.0` to its name and version. Null: not a Python pin. */
export function parsePin(pin: string): { name: string; version?: string } | null {
  const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]*\])?(?:==([^\s;]+))?$/.exec(pin.trim());
  return m ? { name: packageName(m[1]), version: m[2] } : null;
}

/** The task's package and its dependencies. */
export const runnerPins = (runner: EvalRunner) => [runner.package, ...(runner.dependencies ?? [])].filter((p) => !!p);

/** Whether the runner has each pinned package, at the pinned version. */
export function pinsMatch(runner: EvalRunner, have: Locked = LOCKED): boolean {
  return runnerPins(runner).every((pin) => {
    const p = parsePin(pin!);
    return !!p && p.name in have && (!p.version || have[p.name] === p.version);
  });
}

/** Package name to version, from the text of a uv.lock. A name locked at two versions throws. */
export function lockedVersions(lock: string, names: string[]): Locked {
  const all = new Map<string, Set<string>>();
  for (const m of lock.matchAll(/^\[\[package\]\]\nname = "([^"]+)"\nversion = "([^"]+)"/gm)) {
    const name = packageName(m[1]);
    all.set(name, (all.get(name) ?? new Set()).add(m[2]));
  }
  const out: Locked = {};
  for (const name of [...new Set(names.map(packageName))].sort()) {
    const versions = [...(all.get(name) ?? [])];
    if (versions.length > 1) throw new Error(`uv.lock has ${name} at ${versions.join(' and ')}.`);
    if (versions.length) out[name] = versions[0];
  }
  return out;
}
