import { TOPIC_LABELS } from '@/components/catalog/parts';
import type { Crumb, CrumbGroup, CrumbLink } from '@/components/nav/breadcrumbs';
import {
  commitmentPath,
  COMMITMENTS_PATH,
  COMMITMENTS_SEGMENT,
  orgCommitmentPath,
  orgCommitmentsPath,
} from '@/lib/commitments';
import { prisma } from '@/lib/db';
import { evalSlugOf } from '@/lib/eval-links';
import { EVAL_KIND_INFO, EVAL_KIND_LINKS, KIND_PAGES } from '@/lib/eval-list-filter';
import { parseId } from '@/lib/ids';
import { methodPath, suitePath, variantPath } from '@/lib/methods';
import { DEPARTURES_SEGMENT, INCIDENTS_SEGMENT, MODELS_SEGMENT, orgModelsPath } from '@/lib/org-research';
import { organizationPath } from '@/lib/organizations';
import { columnValue, mainScore } from '@/lib/runs/main-score';
import {
  cardPath,
  cardsForModel,
  cardTitle,
  documentByKey,
  evalLinksFor,
  findModel,
  findOrganization,
  getEval,
  getModel,
  isHiddenModel,
  isHiddenOrganization,
  modelEvalCounts,
  modelLinks,
  modelPath,
  organizationLinks,
  systemCardPath,
} from '@/lib/server/catalog';
import { listCommitments } from '@/lib/server/commitments';
import { evalHovers } from '@/lib/server/eval-hovers';
import { LEADERBOARD_TASKS } from '@/lib/server/method-leaderboards';
import { getMethod, getMethodArtifact, getSuite } from '@/lib/server/methods';
import { methodsWithVariants } from '@/lib/server/nav-methods';
import { attemptPath, evalRunLinks, getRun, runnableEvals, runPath, samplePath, samplesNear } from '@/lib/server/runs';
import { feedModelOrder } from '@/lib/server/snippet-feed';
import { topicFromSlug } from '@/lib/topics';
import type { EvalAttempt, SubjectKind, Topic } from '@openaudit/spec';

// Breadcrumbs for a URL path, for the root layout's `@breadcrumbs` slot. Null shows no bar.
// Static routes come first: Next matches them before `/<org>` and `/<owner>/<repo>`.

const TOP: Record<string, string> = {
  models: 'Models',
  evaluations: 'Evaluations',
  methods: 'Methods',
  topics: 'Topics',
  organizations: 'Organizations',
  settings: 'Settings',
  judges: 'Judges',
};
/** The crumb before an eval: what the eval tests. */
const SUBJECT_CRUMBS: Record<SubjectKind, string> = {
  model: 'Model Evaluations',
  method: 'Method Evaluations',
  auditor: 'Auditor Evaluations',
};
/** The eval kind of each subject. Auditor evals have none yet. */
const SUBJECT_KINDS: Partial<Record<SubjectKind, keyof typeof KIND_PAGES>> = { model: 'models', method: 'methods' };

/** What an eval tests: a link to its page, with a menu of Model and Method Evaluations. Auditor
 * evals have no page. */
function subjectCrumb(subject: SubjectKind): Crumb {
  const kind = SUBJECT_KINDS[subject];
  if (!kind) return { label: SUBJECT_CRUMBS[subject] };
  return {
    label: SUBJECT_CRUMBS[subject],
    href: KIND_PAGES[kind],
    menu: [{ links: EVAL_KIND_LINKS }],
    info: EVAL_KIND_INFO[kind],
  };
}
/** The last crumb of an eval's subpage. */
const EVAL_SUBPAGES: Record<string, string> = { samples: 'Samples', 'known-errors': 'Known Errors' };
const HIDDEN = new Set(['signin', 'onboarding', 'api', 'updates']);
/** Pages of one segment with no parent: only Home is before them. */
const PAGES: Record<string, string> = {
  contribute: 'How to Contribute',
  faqs: 'Frequently Asked Questions',
  features: 'OpenAudit Features',
  submit: 'Submit',
};
const ORG_HINT = 'Open Organization Page';

export async function crumbsFor(segments: string[]): Promise<Crumb[] | null> {
  const [first, second, third, fourth] = segments.map(decodeURIComponent);
  if (!first || HIDDEN.has(first)) return null;
  if (first in PAGES) return second ? null : [{ label: PAGES[first] }];

  if (first in TOP) {
    const top: Crumb = { label: TOP[first], href: `/${first}` };
    // `/evaluations` goes to the Models page.
    if (!second) return first === 'evaluations' ? null : [top];
    if (first === 'evaluations') {
      if (second === 'known-errors') return [{ label: 'Known Errors' }];
      if (second === 'suites') {
        const suite = third ? await getSuite(third) : null;
        const kind = suite?.evals[0]?.facets.subjects[0];
        return suite && kind ? suiteCrumbs(suite.suite, kind) : null;
      }
      const found = await getEval(second);
      if (!found) return null;
      const crumbs = await evalCrumbs(found.eval);
      if (third === 'methods') {
        const data = fourth ? await getMethod(fourth) : null;
        const variant = data?.variants.find((v) => v.slug === decodeURIComponent(segments[4] ?? ''));
        return variant ? [...crumbs, { label: variant.displayName }] : null;
      }
      const sub = third && EVAL_SUBPAGES[third];
      return sub ? [...crumbs, { label: sub }] : crumbs;
    }
    if (first === 'methods') {
      if (second === 'leaderboards') {
        const task = LEADERBOARD_TASKS.find((t) => t.slug === third);
        return task ? [top, { label: 'Leaderboards' }, { label: task.title }] : null;
      }
      const [data, menu] = await Promise.all([getMethod(second), methodMenu()]);
      if (!data) return null;
      const methodCrumb: Crumb = { label: data.method.displayName, href: methodPath(second), menu };
      if (!third) return [top, methodCrumb];
      if (third === 'submit') return [top, methodCrumb, { label: 'Submit Variant' }];
      const variantCrumb = (v: { slug: string; displayName: string }): Crumb => ({
        label: v.displayName,
        href: variantPath(second, v.slug),
        menu,
      });
      if (third === 'artifacts') {
        const found = fourth ? await getMethodArtifact(second, fourth) : null;
        return found ? [top, methodCrumb, variantCrumb(found.variant), { label: found.artifact.displayName }] : null;
      }
      const variant = data.variants.find((v) => v.slug === third);
      return variant ? [top, methodCrumb, variantCrumb(variant)] : null;
    }
    if (first === 'topics') {
      const topic = topicFromSlug(second, Object.keys(TOPIC_LABELS) as Topic[]);
      return topic ? [top, { label: TOPIC_LABELS[topic] }] : null;
    }
    if (first === 'models') return second === 'compare' && !third ? [top, { label: 'Compare' }] : null;
    if (first === 'judges') {
      const judge = { label: third ? `${second}/${third}` : second, href: `/judges/${second}/${third}` };
      return fourth ? [top, judge, { label: 'Review' }] : [top, { label: judge.label }];
    }
    if (first === 'organizations' && second === COMMITMENTS_SEGMENT && !fourth) {
      const commitments = await listCommitments();
      const menu = [{ links: commitments.map((c) => ({ label: c.name, href: commitmentPath(c.slug) })) }];
      const table: Crumb = { label: 'Safety Commitments', href: COMMITMENTS_PATH, menu };
      if (!third) return [top, table];
      const c = commitments.find((x) => x.slug === third);
      return c ? [top, table, { label: c.name, href: commitmentPath(c.slug) }] : null;
    }
    return null;
  }

  if (!second) {
    const found = await findOrganization(segments[0]);
    if (!found || found.redirect || (await isHiddenOrganization(found.org.id))) return null;
    const [organizations, rows] = await Promise.all([orgLinks(), modelRows(found.org.id)]);
    const crumbs: Crumb[] = [
      { label: TOP.organizations, href: '/organizations' },
      {
        label: found.org.displayName,
        href: organizationPath(found.org),
        menu: [{ hint: ORG_HINT, links: organizations }],
      },
    ];
    if (rows.length)
      crumbs.push({ label: 'Models', href: orgModelsPath(found.org), menu: [{ links: rows }], ahead: true });
    return crumbs;
  }

  if (second === MODELS_SEGMENT && !segments[2]) {
    const found = await findOrganization(segments[0]);
    if (!found || found.redirect || (await isHiddenOrganization(found.org.id))) return null;
    const [organizations, rows] = await Promise.all([orgLinks(), modelRows(found.org.id)]);
    return [
      { label: TOP.organizations, href: '/organizations' },
      {
        label: found.org.displayName,
        href: organizationPath(found.org),
        menu: [{ hint: ORG_HINT, links: organizations }],
      },
      { label: 'Models', href: orgModelsPath(found.org), ...(rows.length > 0 && { menu: [{ links: rows }] }) },
    ];
  }

  if (second === DEPARTURES_SEGMENT && !segments[2]) {
    const found = await findOrganization(segments[0]);
    if (!found || found.redirect || (await isHiddenOrganization(found.org.id))) return null;
    return [
      { label: TOP.organizations, href: '/organizations' },
      { label: found.org.displayName, href: organizationPath(found.org) },
      { label: 'Departures' },
    ];
  }

  if (second === COMMITMENTS_SEGMENT && !segments[3]) {
    const found = await findOrganization(segments[0]);
    if (!found || found.redirect || (await isHiddenOrganization(found.org.id))) return null;
    const commitments = await listCommitments();
    const crumbs: Crumb[] = [
      { label: TOP.organizations, href: '/organizations' },
      { label: found.org.displayName, href: organizationPath(found.org) },
      {
        label: 'Safety Commitments',
        href: orgCommitmentsPath(found.org),
        menu: [{ links: commitments.map((c) => ({ label: c.name, href: orgCommitmentPath(found.org, c.slug) })) }],
      },
    ];
    if (!third) return crumbs;
    const c = commitments.find((x) => x.slug === third);
    return c ? [...crumbs, { label: c.name, href: orgCommitmentPath(found.org, c.slug) }] : null;
  }

  if (second === INCIDENTS_SEGMENT) {
    const found = await findOrganization(segments[0]);
    if (!found || found.redirect) return null;
    // A hidden organization has no public page, but its incidents do.
    const hidden = await isHiddenOrganization(found.org.id);
    if (!segments[2]) {
      if (hidden) return null;
      return [
        { label: TOP.organizations, href: '/organizations' },
        { label: found.org.displayName, href: organizationPath(found.org) },
        { label: 'Incidents' },
      ];
    }
    return [
      { label: TOP.organizations, href: '/organizations' },
      { label: found.org.displayName, ...(!hidden && { href: organizationPath(found.org) }) },
      { label: 'Incident' },
    ];
  }

  if (first === 'samples') {
    const id = parseId(second);
    const sample = id && (await sampleRow(id));
    const found = sample && (await getEval(sample.evalVersion.eval.slug));
    if (!id || !sample || !found) return null;
    const [crumbs, near] = await Promise.all([evalCrumbs(found.eval), samplesNear(id)]);
    const name = found.eval.displayName;
    const splits = [...new Set(near.map((s) => s.split))];
    return [
      ...crumbs,
      {
        label: 'Samples',
        href: `/evaluations/${encodeURIComponent(found.eval.slug)}/samples`,
        menu: splits.map((split) => ({
          title: splits.length > 1 ? split : undefined,
          links: near.filter((s) => s.split === split).map((s) => ({ label: s.sourceId, href: samplePath(s) })),
        })),
        heading: `Evaluation Samples for ${name}`,
        selected: samplePath({ id }),
      },
      { label: `Evaluation Sample: ${sample.sourceId}` },
    ];
  }

  if (first === 'runs') {
    const id = parseId(second);
    const run = id && (await getRun(id));
    const found = run && (await getModel(...(run.model.name.split('/') as [string, string])));
    if (!run || !found) return null;
    const here = runPath(run.run);
    const [links, evals] = await Promise.all([
      menuLinks(found.organization.id),
      evalRunLinks(found.model.id, run.run.id),
    ]);
    const crumbs = modelCrumbs(found, links);
    crumbs.push({
      ...evalsCrumb(evals, found.model.displayName, here),
      label: `Evaluation Run: ${run.eval.displayName}`,
      href: here,
    });
    if (third === 'attempts' && /^\d{1,6}$/.test(fourth ?? ''))
      crumbs.push(await attemptCrumbFor(run, Number(fourth), `${run.eval.displayName} on ${found.model.displayName}`));
    const sample = third === 'samples' && fourth ? parseId(fourth) : null;
    const row = sample && (await sampleRow(sample));
    if (row) crumbs.push({ label: `Evaluation Sample: ${row.sourceId}` });
    return crumbs;
  }

  // Raw segments, as the page passes them, so the cached reads are shared.
  const row = await findModel(segments[0], segments[1]);
  if (!row || (await isHiddenModel(row.id))) return null;
  const [found, links, evals] = await Promise.all([
    getModel(segments[0], segments[1]),
    menuLinks(row.organizationId),
    third ? [] : evalRunLinks(row.id),
  ]);
  if (!found) return null;
  const { model, documents } = found;
  const crumbs = modelCrumbs(found, links);
  if (evals.length) crumbs.push({ ...evalsCrumb(evals, model.displayName), ahead: true });
  if (third === 'cards' && !fourth) crumbs.push({ label: 'Summaries' });
  if ((third === 'cards' || third === 'reports') && fourth) {
    const cards = await cardsForModel(model, { results: false });
    const keys = new Set(cards.map((c) => c.document.key));
    const link = (c: (typeof cards)[number]) => ({
      label: cardTitle(c.document),
      href: cardPath(model, c.document.key, c.document.kind),
    });
    const systemCards = cards.filter((c) => c.document.kind === 'system_card');
    const menu: CrumbGroup[] = [
      {
        title: 'System Card',
        links: [
          {
            label:
              systemCards.length > 1
                ? `System Card (combines ${systemCards.length} documents)`
                : systemCards.length
                  ? 'System Card'
                  : 'No System Card',
            href: systemCardPath(model),
          },
          ...(systemCards.length > 1 ? systemCards.map(link) : []),
        ],
      },
      { title: 'Reports', links: cards.filter((c) => c.document.kind !== 'system_card').map(link) },
      {
        title: 'Other Documents',
        links: documents
          .filter((d) => !keys.has(d.key))
          .map((d) => ({ label: cardTitle(d), href: d.url, external: true })),
      },
    ];
    const doc = cards.find((c) => c.document.key === fourth)?.document ?? (await documentByKey(fourth));
    if (doc) crumbs.push({ label: cardTitle(doc), href: cardPath(model, fourth, doc.kind), menu });
  }
  return crumbs;
}

/** An attempt's crumb, "Attempt 3: sample_id", with a menu of up to 100 attempts of the run on each
 * side, each with its main score as the run's samples show it. */
async function attemptCrumbFor(
  { run, version, results }: NonNullable<Awaited<ReturnType<typeof getRun>>>,
  ordinal: number,
  name: string,
): Promise<Crumb> {
  const rows = await prisma.evalAttempt.findMany({
    where: { runId: run.id, ordinal: { gte: ordinal - 100, lte: ordinal + 100 } },
    select: { ordinal: true, sampleId: true, epoch: true, scores: true, metrics: true },
    orderBy: { ordinal: 'asc' },
  });
  const epochs = run.settings.epochs;
  const label = (a: (typeof rows)[number]) =>
    `Attempt ${a.ordinal}: ${a.sampleId}${typeof epochs === 'number' && epochs > 1 ? `, epoch ${a.epoch}` : ''}`;
  const here = rows.find((a) => a.ordinal === ordinal);
  if (!here) return { label: `Attempt ${ordinal}` };
  const scoresOf = (a: (typeof rows)[number]) => (a.scores ?? {}) as EvalAttempt['scores'];
  const column = mainScore(version, results, Object.keys(scoresOf(here)));
  return {
    label: label(here),
    menu: [
      {
        links: rows.map((a) => ({
          label: label(a),
          href: attemptPath(run, a.ordinal),
          ...(column && { score: columnValue({ scores: scoresOf(a), metrics: a.metrics }, column) }),
        })),
      },
    ],
    heading: `Eval Attempts for ${name}`,
    selected: attemptPath(run, ordinal),
  };
}

/** The menu of method and variant crumbs: each method, then its variants, indented. A hover on a
 * link shows its summary. */
async function methodMenu(): Promise<CrumbGroup[]> {
  const methods = await methodsWithVariants();
  return methods.map((m) => ({
    links: [
      { label: m.label, href: m.href, info: m.summary },
      ...m.variants.map((v) => ({ label: v.label, href: v.href, indent: true, ...(v.summary && { info: v.summary }) })),
    ],
  }));
}

const sampleRow = (id: string) =>
  prisma.evalSample.findUnique({
    where: { id },
    select: { sourceId: true, evalVersion: { select: { eval: { select: { slug: true } } } } },
  });

/** The organizations by name. */
async function orgLinks() {
  return (await organizationLinks()).toSorted((a, b) => a.label.localeCompare(b.label));
}

/** An organization's models, each with its counts, in the order of its page's Models feed: the
 * models in the feed by its default sort, then the others, the newest release first. */
async function modelRows(organizationId: string) {
  const [models, evals, order] = await Promise.all([
    modelLinks(organizationId),
    modelEvalCounts(),
    feedModelOrder(organizationId),
  ]);
  const place = (href: string) => (order.includes(href) ? order.indexOf(href) : order.length);
  return models
    .map((m) => ({
      label: m.label,
      href: m.href,
      evals: {
        openAudit: evals.openAudit.get(m.id) ?? 0,
        systemCard: evals.systemCard.get(m.id) ?? 0,
        flagged: evals.flagged.get(m.id) ?? 0,
        deploymeter: evals.deploymeter.get(m.id) ?? null,
        judges: evals.judges.get(m.id) ?? null,
      },
    }))
    .sort((a, b) => place(a.href) - place(b.href));
}

/** The evals menu: the `runnable` evals (active ones that we can run), then the others. The current
 * eval (`here`) goes above both when it is not runnable. With no runnable evals, one list. */
export function evalMenu(links: CrumbLink[], runnable: Set<string>, here: string): CrumbGroup[] {
  const can = links.filter((l) => runnable.has(l.href));
  if (!can.length) return [{ links }];
  const other = links.filter((l) => !runnable.has(l.href));
  return [
    { links: other.filter((l) => l.href === here) },
    { title: 'Runnable Evals', sticky: true, links: can },
    { title: 'Other Evals', sticky: true, links: other.filter((l) => l.href !== here) },
  ];
}

type MenuSuite = { link: CrumbLink; evals: Set<string> };

/** The suites with public evals that test `kind`, each with the paths of those evals. */
async function suitesFor(kind: SubjectKind): Promise<MenuSuite[]> {
  const rows = await prisma.evalSuite.findMany({
    select: {
      slug: true,
      displayName: true,
      summary: true,
      evals: { where: { visibility: 'public', subjects: { has: kind } }, select: { slug: true } },
    },
  });
  return rows.map((s) => ({
    link: { label: s.displayName, href: suitePath(s.slug), info: s.summary },
    evals: new Set(s.evals.map((e) => `/evaluations/${e.slug}`)),
  }));
}

/** `links` by name, with the evals of a suite indented under the suite. A suite with only one
 * eval in `links` does not show: its eval shows on its own. */
export function underSuites(links: CrumbLink[], suites: MenuSuite[]): CrumbLink[] {
  const suiteOf = new Map<string, MenuSuite>();
  for (const s of suites) {
    const own = links.filter((l) => s.evals.has(l.href));
    if (own.length > 1) for (const l of own) suiteOf.set(l.href, s);
  }
  const rows: { label: string; links: CrumbLink[] }[] = [];
  const shown = new Set<MenuSuite>();
  for (const l of links) {
    const s = suiteOf.get(l.href);
    if (!s) rows.push({ label: l.label, links: [l] });
    else if (!shown.has(s)) {
      shown.add(s);
      const own = links.filter((x) => suiteOf.get(x.href) === s).map((x) => ({ ...x, indent: true }));
      rows.push({ label: s.link.label, links: [s.link, ...own] });
    }
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label)).flatMap((r) => r.links);
}

/** The menu of the evals that test `kind`, as `evalMenu` with `here`, with the evals of each suite
 * under it. Also the hover of an eval. */
async function kindEvals(kind: SubjectKind, here: string) {
  const [links, runnable, hovers, suites] = await Promise.all([
    evalLinksFor(kind),
    runnableEvals(),
    evalHovers(),
    suitesFor(kind),
  ]);
  const about = (slug: string | null) => {
    const h = slug ? hovers[slug] : undefined;
    return h && (h.summary || h.topics.length) ? h : undefined;
  };
  const menu = evalMenu(
    links.map((l) => ({ ...l, about: about(evalSlugOf(l.href)) })),
    new Set(runnable.filter((r) => r.status === 'active').map((r) => `/evaluations/${r.slug}`)),
    here,
  ).map((g) => ({ ...g, links: underSuites(g.links, suites) }));
  return { menu, about, suites };
}

/** What the eval tests, its suite when the suite has more than one eval, then the eval with a menu
 * of the evals that test the same. */
async function evalCrumbs(e: { slug: string; displayName: string; facets: { subjects: SubjectKind[] } }) {
  const kind = e.facets.subjects[0];
  const href = `/evaluations/${encodeURIComponent(e.slug)}`;
  const { menu, about, suites } = await kindEvals(kind, href);
  const suite = suites.find((s) => s.evals.has(href) && s.evals.size > 1);
  const crumbs: Crumb[] = [
    subjectCrumb(kind),
    ...(suite ? [{ label: suite.link.label, href: suite.link.href }] : []),
    {
      label: e.displayName,
      href,
      about: about(e.slug),
      menu,
      heading: SUBJECT_CRUMBS[kind],
      selected: href,
    },
  ];
  return crumbs;
}

/** What the suite's evals test, then the suite with the menu of an eval's crumb. */
async function suiteCrumbs(s: { slug: string; displayName: string; summary: string }, kind: SubjectKind) {
  const href = suitePath(s.slug);
  const { menu } = await kindEvals(kind, href);
  const crumbs: Crumb[] = [
    subjectCrumb(kind),
    {
      label: s.displayName,
      href,
      info: s.summary,
      menu,
      heading: SUBJECT_CRUMBS[kind],
      selected: href,
    },
  ];
  return crumbs;
}

/** A menu of the evals run on a model, each to its run. It opens the model evals list. */
function evalsCrumb(evals: Awaited<ReturnType<typeof evalRunLinks>>, model: string, selected?: string): Crumb {
  const links = evals.map(({ label, href, summary, topics, result }) => ({
    label,
    href,
    run: { summary, topics: topics.map((t) => TOPIC_LABELS[t] ?? t), result },
  }));
  return { label: 'Evaluations', href: '/models', menu: [{ links }], heading: `Evals for ${model}`, selected };
}

async function menuLinks(organizationId: string) {
  const [organizations, models] = await Promise.all([orgLinks(), modelRows(organizationId)]);
  return { organizations, models };
}

function modelCrumbs(
  { model, organization }: NonNullable<Awaited<ReturnType<typeof getModel>>>,
  { organizations, models }: Awaited<ReturnType<typeof menuLinks>>,
) {
  const crumbs: Crumb[] = [
    {
      label: organization.displayName,
      href: organizationPath(organization),
      menu: [{ hint: ORG_HINT, links: organizations }],
    },
    {
      label: model.displayName,
      href: modelPath(model),
      menu: [{ links: models }],
    },
  ];
  return crumbs;
}
