import { prisma } from '@/lib/db';
import { newId } from '@/lib/ids';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findOrganization } from './catalog';
import { handleProblem } from './handles';

const TAG = `org${Date.now().toString(36)}`;
const ids = { a: newId(), b: newId() };

describe('findOrganization', () => {
  beforeAll(async () => {
    await prisma.organization.createMany({
      data: [
        { id: ids.a, slug: `${TAG}-qwen`, displayName: 'Alibaba', aliases: [], slugAliases: [`${TAG}-alibaba`] },
        { id: ids.b, slug: `${TAG}-meta`, displayName: 'Meta', aliases: [], slugAliases: [`${TAG}x`] },
      ],
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [ids.a, ids.b] } } });
    await prisma.$disconnect();
  });

  it('finds the page by its slug', async () => {
    expect(await findOrganization(`${TAG}-qwen`)).toMatchObject({ org: { id: ids.a }, redirect: false });
  });

  it('finds a redirect by a slug alias or another letter case', async () => {
    expect(await findOrganization(`${TAG}-Alibaba`)).toMatchObject({
      org: { id: ids.a, slug: `${TAG}-qwen` },
      redirect: true,
    });
    expect(await findOrganization(`${TAG}-QWEN`)).toMatchObject({ org: { id: ids.a }, redirect: true });
  });

  it('finds nothing for other names', async () => {
    expect(await findOrganization(`${TAG}-nope`)).toBeNull();
    expect(await findOrganization('a b')).toBeNull();
  });

  it('keeps organization slugs and aliases out of usernames', async () => {
    expect(await handleProblem(`${TAG}x`)).toBe('This name is taken.');
    expect(await handleProblem(`${TAG}y`)).toBeNull();
  });
});
