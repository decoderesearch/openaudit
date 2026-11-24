import { prisma } from '@/lib/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminEmails } from './admins';
import { adminUsers, setUserRole } from './user-admin';

const TAG = `role${Date.now().toString(36)}`;

afterAll(() => prisma.$disconnect());

describe('setUserRole', () => {
  let actor: string;
  let target: string;

  beforeAll(async () => {
    actor = (await prisma.user.create({ data: { name: 'a', email: `${TAG}_a@example.org`, role: 'admin' } })).id;
    target = (await prisma.user.create({ data: { name: 't', email: `${TAG}_t@example.org` } })).id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorId: actor } });
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  });

  it('sets the role and logs from and to', async () => {
    expect(await setUserRole(actor, target, 'moderator')).toBe(true);
    expect(await setUserRole(actor, target, 'user')).toBe(true);
    expect((await prisma.user.findUnique({ where: { id: target } }))?.role).toBe('user');
    const log = await prisma.auditLog.findMany({ where: { actorId: actor }, orderBy: { createdAt: 'asc' } });
    expect(log.map((l) => l.meta)).toEqual([
      { from: 'user', to: 'moderator' },
      { from: 'moderator', to: 'user' },
    ]);
  });

  it('logs nothing when the role does not change', async () => {
    const before = await prisma.auditLog.count({ where: { actorId: actor } });
    expect(await setUserRole(actor, target, 'user')).toBe(true);
    expect(await prisma.auditLog.count({ where: { actorId: actor } })).toBe(before);
  });

  it('is false for a user that does not exist', async () => {
    expect(await setUserRole(actor, '00000000-0000-7000-8000-000000000000', 'admin')).toBe(false);
  });

  it('lists matches with admins first', async () => {
    const { users, total } = await adminUsers(TAG);
    expect(total).toBe(2);
    expect(users.map((u) => u.id)).toEqual([actor, target]);
  });
});

describe('adminEmails', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}_e` } } });
  });

  it('has the admins in the database who are not banned, and no one else', async () => {
    await prisma.user.createMany({
      data: [
        { name: 'a', email: `${TAG}_e_admin@example.org`, role: 'admin' },
        { name: 'b', email: `${TAG}_e_banned@example.org`, role: 'admin', banned: true },
        { name: 'm', email: `${TAG}_e_mod@example.org`, role: 'moderator' },
      ],
    });
    const ours = (await adminEmails()).filter((e) => e.startsWith(`${TAG}_e`));
    expect(ours).toEqual([`${TAG}_e_admin@example.org`]);
  });
});
