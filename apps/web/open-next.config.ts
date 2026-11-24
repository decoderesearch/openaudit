import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default {
  ...defineCloudflareConfig({}),
  // Not `build`: that runs `prisma migrate deploy` on the database in the env files.
  buildCommand: 'pnpm build:app',
};
