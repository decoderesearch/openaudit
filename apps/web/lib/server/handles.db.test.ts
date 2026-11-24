import { prisma } from '@/lib/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { suggestUsername } from './handles';

const TAG = `sgst${Date.now().toString(36)}`;

describe('suggestUsername', () => {
  let me: string;

  beforeAll(async () => {
    me = (await prisma.user.create({ data: { name: 'me', email: `${TAG}_me@example.org` } })).id;
    await prisma.user.create({ data: { name: 'x', email: `${TAG}_x@example.org`, username: `${TAG}_taken` } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
    await prisma.$disconnect();
  });

  it('uses the part before @', async () => {
    expect(await suggestUsername(`${TAG}.Jane-Doe@example.org`, me)).toBe(`${TAG}_jane_doe`);
  });

  it('is empty when another user has it', async () => {
    expect(await suggestUsername(`${TAG}_taken@example.org`, me)).toBe('');
  });

  it('is empty when it is reserved or too short', async () => {
    expect(await suggestUsername('admin@example.org', me)).toBe('');
    expect(await suggestUsername('jo@example.org', me)).toBe('');
  });
});
