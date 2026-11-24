import { execFileSync } from 'node:child_process';
import { Client } from 'pg';

// Migrates the test database and empties it. Refuses any database not named `*_test`.
export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/\/[a-z0-9_]+_test(\?|$)/.test(url)) {
    throw new Error(`Refusing to reset a database that is not a *_test database: ${url || '(unset)'}`);
  }
  execFileSync('prisma', ['migrate', 'deploy'], { stdio: 'inherit' });
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (rows.length) {
      await client.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} CASCADE`);
    }
  } finally {
    await client.end();
  }
}
