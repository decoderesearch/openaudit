import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EVAL_KIND_INFO, EVAL_KIND_LINKS } from '../eval-list-filter';
import { resolveOrganization } from '../organizations';

const ORGS = [
  { slug: 'qwen', slugAliases: ['alibaba'], displayName: 'Alibaba', id: 'o1', aliases: [] },
  { slug: 'gone', slugAliases: [], displayName: 'Gone', id: 'o2', aliases: [] },
];
const viewer = vi.hoisted(() => ({ role: 'user' }));

vi.mock('@/lib/server/catalog', () => ({
  findOrganization: vi.fn(async (segment: string) => resolveOrganization(segment, ORGS)),
  getOrganization: vi.fn(async (slug: string) => {
    const organization = ORGS.find((o) => o.slug === slug);
    return organization ? { organization, models: [], documents: [] } : null;
  }),
  isHiddenOrganization: vi.fn(async (id: string) => id === 'o2'),
  organizationLinks: vi.fn(async () => [{ label: 'Alibaba', href: '/qwen' }]),
  modelLinks: vi.fn(async () => [{ label: 'Qwen3', href: '/Qwen/Qwen3' }]),
  modelEvalCounts: vi.fn(async () => ({
    openAudit: new Map(),
    systemCard: new Map(),
    flagged: new Map(),
    deploymeter: new Map(),
    judges: new Map(),
  })),
  modelPath: vi.fn(() => '/Qwen/Qwen3'),
  evalLinksFor: vi.fn(async () => [{ label: 'MASK', href: '/evaluations/mask' }]),
  getEval: vi.fn(async (slug: string) => {
    const subjects = { mask: ['model'], 'varied-deception': ['method'] }[slug];
    return subjects ? { eval: { slug, displayName: slug.toUpperCase(), facets: { subjects } } } : null;
  }),
}));
vi.mock('@/lib/db', () => {
  const none = { findMany: vi.fn(async () => []) };
  return {
    prisma: {
      $queryRaw: vi.fn(async () => []),
      orgIncident: none,
      orgIncidentEvent: none,
      orgDeparture: none,
      systemCard: none,
      openAuditCard: none,
      evalSuite: none,
    },
  };
});
vi.mock('@/lib/server/runs', () => ({ getRun: vi.fn(), runPath: vi.fn(), runnableEvals: vi.fn(async () => []) }));
vi.mock('@/lib/server/eval-hovers', () => ({
  evalHovers: vi.fn(async () => ({ mask: { summary: 'Tests honesty under pressure.', topics: ['Honesty'] } })),
}));
vi.mock('@/lib/server/commitments', () => ({
  listOrgCommitments: vi.fn(async () => []),
  listCommitments: vi.fn(async () => []),
}));
vi.mock('@/lib/server/snippet-feed', () => ({
  auditSummary: vi.fn(async () => ({ models: 0, average: null, latest: null })),
  auditedModels: vi.fn(async () => []),
  snippetFeedFor: vi.fn(async () => []),
  unauditedModels: vi.fn(async () => []),
  feedModelOrder: vi.fn(async () => []),
}));
vi.mock('@/lib/server/org-latest-update', () => ({ latestUpdate: vi.fn(async () => null) }));
vi.mock('@/lib/server/audit-estimate', () => ({ auditEstimate: vi.fn(async () => null), roundUsd: (n: number) => n }));
vi.mock('@/lib/server/viewer', () => ({
  getViewer: vi.fn(async () => viewer),
  isAdmin: (v: { role: string } | null) => v?.role === 'admin',
}));

const { default: OrganizationPage } = await import('@/app/[owner]/(org)/page');
const { default: ModelsPage } = await import('@/app/[owner]/(org)/models/page');
const { default: DeparturesPage } = await import('@/app/[owner]/(org)/departures/page');
const { default: IncidentsPage } = await import('@/app/[owner]/(org)/incidents/page');
const { crumbsFor, underSuites } = await import('./breadcrumbs');

/** The digest that Next.js reads from a thrown redirect or not-found error. */
async function digestOf(render: () => unknown) {
  try {
    await render();
  } catch (e) {
    return (e as { digest?: string }).digest ?? String(e);
  }
  return 'rendered';
}

const params = <T>(p: T) => ({ params: Promise.resolve(p) });
const OrgModelsPage = (p: { params: Promise<{ owner: string }> }) =>
  ModelsPage({ ...p, searchParams: Promise.resolve({}) });

describe('organization pages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the page at the slug', async () => {
    expect(await digestOf(() => OrganizationPage(params({ owner: 'qwen' })))).toBe('rendered');
  });

  it('redirects (308) an alias or another letter case to the slug', async () => {
    for (const owner of ['alibaba', 'Alibaba', 'Qwen']) {
      expect(await digestOf(() => OrganizationPage(params({ owner })))).toMatch(/^NEXT_REDIRECT;replace;\/qwen;308;/);
    }
  });

  it('is a 404 for an unknown name', async () => {
    expect(await digestOf(() => OrganizationPage(params({ owner: 'nope' })))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it('is a 404 for a hidden organization, except for admins', async () => {
    expect(await digestOf(() => OrganizationPage(params({ owner: 'gone' })))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
    viewer.role = 'admin';
    expect(await digestOf(() => OrganizationPage(params({ owner: 'gone' })))).toBe('rendered');
    viewer.role = 'user';
  });

  it('renders the models page at the slug, else redirects or is a 404', async () => {
    expect(await digestOf(() => OrgModelsPage(params({ owner: 'qwen' })))).toBe('rendered');
    expect(await digestOf(() => OrgModelsPage(params({ owner: 'alibaba' })))).toMatch(
      /^NEXT_REDIRECT;replace;\/qwen\/models;308;/,
    );
    expect(await digestOf(() => OrgModelsPage(params({ owner: 'gone' })))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
    expect(await crumbsFor(['qwen', 'models'])).toMatchObject([
      { label: 'Organizations', href: '/organizations' },
      { label: 'Alibaba', href: '/qwen' },
      { label: 'Models', href: '/qwen/models', menu: [{ links: [{ label: 'Qwen3', href: '/Qwen/Qwen3' }] }] },
    ]);
    expect(await crumbsFor(['gone', 'models'])).toBeNull();
  });

  it('renders the departures page at the slug, else redirects or is a 404', async () => {
    expect(await digestOf(() => DeparturesPage(params({ owner: 'qwen' })))).toBe('rendered');
    expect(await digestOf(() => DeparturesPage(params({ owner: 'alibaba' })))).toMatch(
      /^NEXT_REDIRECT;replace;\/qwen\/departures;308;/,
    );
    expect(await digestOf(() => DeparturesPage(params({ owner: 'gone' })))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
    expect(await crumbsFor(['qwen', 'departures'])).toEqual([
      { label: 'Organizations', href: '/organizations' },
      { label: 'Alibaba', href: '/qwen' },
      { label: 'Departures' },
    ]);
    expect(await crumbsFor(['gone', 'departures'])).toBeNull();
  });

  it('renders the incidents page at the slug, else redirects or is a 404', async () => {
    expect(await digestOf(() => IncidentsPage(params({ owner: 'qwen' })))).toBe('rendered');
    expect(await digestOf(() => IncidentsPage(params({ owner: 'alibaba' })))).toMatch(
      /^NEXT_REDIRECT;replace;\/qwen\/incidents;308;/,
    );
    expect(await digestOf(() => IncidentsPage(params({ owner: 'gone' })))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
    expect(await crumbsFor(['qwen', 'incidents'])).toEqual([
      { label: 'Organizations', href: '/organizations' },
      { label: 'Alibaba', href: '/qwen' },
      { label: 'Incidents' },
    ]);
    expect(await crumbsFor(['gone', 'incidents'])).toBeNull();
  });

  it('has breadcrumbs only at the slug', async () => {
    expect(await crumbsFor(['qwen'])).toMatchObject([
      { label: 'Organizations', href: '/organizations' },
      { label: 'Alibaba', href: '/qwen' },
      {
        label: 'Models',
        href: '/qwen/models',
        menu: [{ links: [{ label: 'Qwen3', href: '/Qwen/Qwen3' }] }],
        ahead: true,
      },
    ]);
    expect(await crumbsFor(['alibaba'])).toBeNull();
    expect(await crumbsFor(['nope'])).toBeNull();
    expect(await crumbsFor(['organizations'])).toEqual([{ label: 'Organizations', href: '/organizations' }]);
  });

  it('puts what an eval tests before the eval, as a link to its page', async () => {
    expect(await crumbsFor(['evaluations', 'mask', 'samples'])).toEqual([
      {
        label: 'Model Evaluations',
        href: '/models',
        menu: [{ links: EVAL_KIND_LINKS }],
        info: EVAL_KIND_INFO.models,
      },
      {
        label: 'MASK',
        href: '/evaluations/mask',
        about: { summary: 'Tests honesty under pressure.', topics: ['Honesty'] },
        menu: [
          {
            links: [
              {
                label: 'MASK',
                href: '/evaluations/mask',
                about: { summary: 'Tests honesty under pressure.', topics: ['Honesty'] },
              },
            ],
          },
        ],
        heading: 'Model Evaluations',
        selected: '/evaluations/mask',
      },
      { label: 'Samples' },
    ]);
    expect((await crumbsFor(['evaluations', 'varied-deception']))?.[0]).toEqual({
      label: 'Method Evaluations',
      href: '/methods',
      menu: [{ links: EVAL_KIND_LINKS }],
      info: EVAL_KIND_INFO.methods,
    });
    expect(await crumbsFor(['evaluations', 'nope'])).toBeNull();
    expect(await crumbsFor(['evaluations'])).toBeNull();
    expect(await crumbsFor(['evaluations', 'known-errors'])).toEqual([{ label: 'Known Errors' }]);
  });

  it('puts the evals of a suite under the suite, by name, and no suite of one eval', () => {
    const link = (label: string) => ({ label, href: `/evaluations/${label.toLowerCase()}` });
    const suite = (label: string, evals: string[]) => ({
      link: { label, href: `/evaluations/suites/${label.toLowerCase()}` },
      evals: new Set(evals.map((e) => `/evaluations/${e}`)),
    });
    const rows = underSuites(
      [link('Alpha'), link('Core'), link('Ravel'), link('Synth'), link('Zeta')],
      [suite('Bench', ['core', 'ravel']), suite('SynthBench', ['synth'])],
    );
    expect(rows.map((r) => `${'indent' in r && r.indent ? '  ' : ''}${r.label}`)).toEqual([
      'Alpha',
      'Bench',
      '  Core',
      '  Ravel',
      'Synth',
      'Zeta',
    ]);
  });
});
