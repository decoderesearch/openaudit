import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { photoFiles } from './commons-photos';

describe('commons photos', () => {
  it('has our copy of each departure photo in the seed', () => {
    const missing = photoFiles()
      .map((f) => f.path)
      .filter((p) => p && !existsSync(join(__dirname, '../public', p)));
    expect(missing, 'Run: pnpm photos:commons').toEqual([]);
  });
});
