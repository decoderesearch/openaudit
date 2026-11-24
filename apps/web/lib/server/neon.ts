// The Neon `production` branch, found with the Neon API. Local use only: it needs NEON_API_KEY
// and NEON_PROJECT_ID. NEON_SYNC_BRANCH sets another branch, for a test. The URL has the
// password; keep it in memory, and do not log it.

export type NeonDatabase = { url: string; label: string };

async function neon<T>(path: string): Promise<T> {
  const { NEON_API_KEY, NEON_PROJECT_ID } = process.env;
  if (!NEON_API_KEY || !NEON_PROJECT_ID) throw new Error('Set NEON_API_KEY and NEON_PROJECT_ID.');
  const r = await fetch(`https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}${path}`, {
    headers: { Authorization: `Bearer ${NEON_API_KEY}` },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Neon API ${path.split('?')[0]}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

async function lookup(): Promise<NeonDatabase> {
  const { branches } = await neon<{ branches: { id: string; name: string }[] }>('/branches');
  const name = process.env.NEON_SYNC_BRANCH || 'production';
  const branch = branches.find((b) => b.name === name);
  if (!branch) throw new Error(`Neon has no branch named ${name}.`);
  const { databases } = await neon<{ databases: { name: string; owner_name: string }[] }>(
    `/branches/${branch.id}/databases`,
  );
  if (databases.length !== 1) throw new Error(`Expected 1 database on ${name}, got ${databases.length}.`);
  const db = databases[0];
  const q = new URLSearchParams({
    branch_id: branch.id,
    database_name: db.name,
    role_name: db.owner_name,
    pooled: 'false',
  });
  const { uri } = await neon<{ uri: string }>(`/connection_uri?${q}`);
  return { url: uri, label: `Neon branch "${name}", database "${db.name}"` };
}

let cached: Promise<NeonDatabase> | undefined;

/** The direct (not pooled) URL of the production database. A failed lookup is not kept. */
export function productionDatabase(): Promise<NeonDatabase> {
  cached ??= lookup().catch((e) => {
    cached = undefined;
    throw e;
  });
  return cached;
}

/** True when two URLs point to the same Neon endpoint (pooled or not) and database. */
export function sameDatabase(a: string, b: string): boolean {
  const key = (s: string) => {
    const u = new URL(s);
    return `${u.hostname.replace(/-pooler(?=\.)/, '')}${u.pathname}`;
  };
  return key(a) === key(b);
}

/** The endpoint and the database of a URL, with no user or password. */
export function databaseLabel(s: string): string {
  const u = new URL(s);
  return `${u.hostname.split('.')[0]}${u.pathname}`;
}
