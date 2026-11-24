import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { currentPackages, OUT, packagesJson } from '../../scripts/runner-packages';
import { lockedVersions, parsePin, pinsMatch } from './runner-pins';

describe('parsePin', () => {
  it('reads names, extras and versions', () => {
    expect(parsePin('inspect-evals[agentdojo]==0.22.0')).toEqual({ name: 'inspect-evals', version: '0.22.0' });
    expect(parsePin('Inspect_Petri==3.1.0')).toEqual({ name: 'inspect-petri', version: '3.1.0' });
    expect(parsePin('ipi-arena-bench')).toEqual({ name: 'ipi-arena-bench', version: undefined });
    expect(parsePin('promptfoo@0.123.1')).toBeNull();
  });
});

describe('pinsMatch', () => {
  const have = { 'inspect-petri': '3.1.0', 'petri-bloom': '0.2.6' };
  const bloom = { kind: 'inspect', package: 'petri-bloom==0.2.6' } as const;

  it('needs the package and each dependency at its version', () => {
    expect(pinsMatch({ ...bloom, dependencies: ['inspect-petri==3.1.0'] }, have)).toBe(true);
    expect(pinsMatch({ ...bloom, dependencies: ['inspect-petri==3.1.1'] }, have)).toBe(false);
    expect(pinsMatch({ ...bloom, package: 'petri-bloom' }, have)).toBe(true);
    expect(pinsMatch({ kind: 'inspect' }, have)).toBe(true);
    expect(pinsMatch({ kind: 'inspect', package: 'promptfoo@0.123.1' }, have)).toBe(false);
  });
});

describe('lockedVersions', () => {
  const lock = (name: string, version: string) => `[[package]]\nname = "${name}"\nversion = "${version}"\n\n`;

  it('reads the asked packages and fails on two versions of one', () => {
    const text = lock('inspect-petri', '3.1.0') + lock('other', '1.0');
    expect(lockedVersions(text, ['inspect_petri', 'missing'])).toEqual({ 'inspect-petri': '3.1.0' });
    expect(() => lockedVersions(text + lock('other', '2.0'), ['other'])).toThrow(/1.0 and 2.0/);
  });

  it('runner-packages.json agrees with uv.lock and the seeds (pnpm runner:packages)', () => {
    expect(readFileSync(OUT, 'utf8')).toBe(packagesJson(currentPackages()));
  });
});
