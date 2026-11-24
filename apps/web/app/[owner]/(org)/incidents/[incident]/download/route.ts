import { loadIncident } from '@/components/org/incident-view';
import { incidentPath } from '@/lib/org-research';
import { clientIp } from '@/lib/rate-limit';
import { allow, tooMany } from '@/lib/server/limits';

// An incident's data as a JSON file, as its page shows it: its facts, models, events to date and
// log excerpts. Public catalog data only.

type Context = { params: Promise<{ owner: string; incident: string }> };

export async function GET(request: Request, { params }: Context) {
  if (!(await allow('general', 'incident-download', clientIp(request.headers)))) return tooMany();
  const { owner, incident } = await params;
  const found = await loadIncident(owner, decodeURIComponent(incident));
  if (!found) return Response.json({ error: 'Not found' }, { status: 404 });
  const { incident: i, events, models, org } = found;
  const today = new Date().toISOString().slice(0, 10);
  const data = {
    organization: { slug: org.slug, name: org.displayName },
    incident: {
      slug: i.slug,
      url: new URL(incidentPath(org, i.slug), request.url).href,
      title: i.title,
      date: i.date,
      datePrecision: i.datePrecision,
      ...(i.endDate && { endDate: i.endDate }),
      status: i.status,
      primaryCategory: i.primaryCategory,
      categories: i.categories,
      summary: i.summary,
      description: i.description,
      sources: i.sources,
    },
    models: models.map((m) => ({ name: m.name, displayName: m.displayName })),
    events: events
      .filter((e) => e.date <= today)
      .map(({ date, datePrecision, title, description, sources }) => ({
        date,
        datePrecision,
        title,
        ...(description && { description }),
        sources,
      })),
    ...(i.logs?.length && { logs: i.logs }),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${org.slug}-${i.slug}.json"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
