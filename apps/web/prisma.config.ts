// Prisma CLI config: where the schema and migrations live, and the direct database URL the CLI
// uses for migrations. The runtime client connects through `lib/db.ts` with `DATABASE_URL`.
//
// The CLI runs through `scripts/with-env.js`, which loads the env files. `prisma generate` needs
// no database, so a missing URL is not an error here.
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});
