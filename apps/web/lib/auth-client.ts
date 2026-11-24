import { apiKeyClient } from '@better-auth/api-key/client';
import { adminClient, inferAdditionalFields, magicLinkClient, usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { auth } from './auth';

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), adminClient(), usernameClient(), apiKeyClient(), inferAdditionalFields<typeof auth>()],
});

export const { signOut } = authClient;
