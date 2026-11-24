import { prisma } from '@/lib/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getIncident, getOrganizationResearch } from './org-research';

const ORG = '01a0ea3a-e128-76e4-9de4-0a0000000001';
const id = (n: number) => `01a0ea3a-e128-76e4-9de4-0a00000001${String(n).padStart(2, '0')}`;
const incident = (n: number, slug: string, date: string, severity: string) => ({
  id: id(n),
  organizationId: ORG,
  slug,
  title: slug,
  date,
  datePrecision: date.length === 10 ? 'day' : 'month',
  severity,
  status: 'resolved',
  primaryCategory: 'systems_breached',
  categories: ['security'],
  summary: 'x',
  description: 'x',
});

describe('organization research reads', () => {
  beforeAll(async () => {
    await prisma.organization.create({
      data: { id: ORG, slug: 'research-test-org', displayName: 'Research Test', aliases: [] },
    });
    await prisma.orgIncident.createMany({
      data: [incident(1, 'old', '2023-04', 'yellow'), incident(2, 'new', '2025-01-02', 'red')],
    });
    await prisma.orgIncidentEvent.createMany({
      data: [1, 0, 2].map((order) => ({
        id: id(10 + order),
        incidentId: id(2),
        order,
        date: '2025-01-0' + (order + 1),
        datePrecision: 'day',
        title: `e${order}`,
      })),
    });
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: ORG } });
    await prisma.$disconnect();
  });

  it('lists incidents newest first', async () => {
    const r = await getOrganizationResearch(ORG);
    expect(r.incidents.map((i) => i.slug)).toEqual(['new', 'old']);
    expect(r.departures).toEqual([]);
  });

  it('reads one incident with its timeline in order', async () => {
    const found = await getIncident(ORG, 'new');
    expect(found?.incident.severity).toBe('red');
    expect(found?.events.map((e) => e.title)).toEqual(['e0', 'e1', 'e2']);
    expect(await getIncident(ORG, 'missing')).toBeNull();
  });

  it('deletes research rows with the organization', async () => {
    const other = '01a0ea3a-e128-76e4-9de4-0a0000000002';
    await prisma.organization.create({
      data: { id: other, slug: 'research-test-gone', displayName: 'Gone', aliases: [] },
    });
    await prisma.orgIncident.create({
      data: { ...incident(3, 'gone', '2024', 'orange'), organizationId: other, datePrecision: 'year' },
    });
    await prisma.organization.delete({ where: { id: other } });
    expect(await prisma.orgIncident.count({ where: { organizationId: other } })).toBe(0);
  });
});
