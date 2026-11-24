import { apiKey } from '@better-auth/api-key';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { admin, captcha, magicLink, username } from 'better-auth/plugins';
import { prisma } from './db';
import { sendEmail } from './email/send';
import { magicLinkEmail } from './email/templates';
import {
  BETTER_AUTH_SECRET,
  BETTER_AUTH_URL,
  BOOTSTRAP_ADMIN_EMAILS,
  NEXT_PUBLIC_URL,
  SUPPORT_EMAIL,
  TRUSTED_ORIGINS,
  TURNSTILE_ENABLED,
  TURNSTILE_SECRET_KEY,
  TURNSTILE_TEST_SECRET,
} from './env';
import { HANDLE_MAX, HANDLE_MIN, handleError, normalizeHandle } from './handles';
import { newId } from './ids';
import { IP_ADDRESS_HEADERS } from './platform';
import { signInEmailBlock } from './server/email-limits';
import { SIGN_IN_CONFIRM_PATH, TURNSTILE_ACTION } from './sign-in';
import { normalizeWebsite, WEBSITE_ERROR } from './urls';

function badRequest(message: string): APIError {
  return new APIError('BAD_REQUEST', { message });
}

// API callers skip the forms, so the hook checks the website too. Null clears it.
function cleanWebsite(value: unknown): string | null {
  const website = normalizeWebsite(typeof value === 'string' ? value : '');
  if (website === null) throw badRequest(WEBSITE_ERROR);
  return website || null;
}

// The email links to our confirm page, not to the verify endpoint. Mail scanners open links;
// only a person presses "Sign in", so a scanner cannot use the token or make an account.
function confirmUrl(verifyUrl: string): string {
  return `${NEXT_PUBLIC_URL}${SIGN_IN_CONFIRM_PATH}${new URL(verifyUrl).search}`;
}

export const auth = betterAuth({
  baseURL: BETTER_AUTH_URL,
  secret: BETTER_AUTH_SECRET || undefined,
  trustedOrigins: TRUSTED_ORIGINS,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  advanced: {
    database: { generateId: () => newId() },
    ipAddress: { ipAddressHeaders: IP_ADDRESS_HEADERS },
  },
  user: {
    additionalFields: {
      affiliation: { type: 'string', required: false, input: true },
      website: { type: 'string', required: false, input: true },
      // Set when onboarding completes. Null means "show onboarding".
      onboardedAt: { type: 'date', required: false, input: false },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-in/magic-link') return;
      const email = typeof ctx.body?.email === 'string' ? ctx.body.email : '';
      const block = email ? await signInEmailBlock(email) : null;
      if (block === 'inbox') {
        throw new APIError('TOO_MANY_REQUESTS', {
          message: 'We sent several sign-in emails to this address. Wait an hour, then try again.',
        });
      }
      if (block === 'site') {
        throw new APIError('SERVICE_UNAVAILABLE', {
          message: `Sign-in email is paused for now. Try again later, or write to ${SUPPORT_EMAIL}.`,
        });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (BOOTSTRAP_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
            return { data: { ...user, role: 'admin' } };
          }
          return { data: user };
        },
      },
      update: {
        before: async (user) => {
          if (!('website' in user) || user.website === undefined) return { data: user };
          return { data: { ...user, website: cleanWebsite(user.website) } };
        },
      },
    },
  },
  plugins: [
    ...(TURNSTILE_ENABLED
      ? [
          captcha({
            provider: 'cloudflare-turnstile',
            secretKey: TURNSTILE_SECRET_KEY,
            endpoints: ['/sign-in/magic-link'],
            ...(!TURNSTILE_TEST_SECRET && { expectedAction: TURNSTILE_ACTION }),
          }),
        ]
      : []),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendEmail(email, 'magic_link', magicLinkEmail(confirmUrl(url)));
      },
    }),
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
    }),
    username({
      minUsernameLength: HANDLE_MIN,
      maxUsernameLength: HANDLE_MAX,
      usernameNormalization: normalizeHandle,
      validationOrder: { username: 'post-normalization' },
      // The plugin checks other users; this adds our rules.
      usernameValidator: (name) => !handleError(name),
      displayUsername: false,
    }),
    apiKey({
      defaultPrefix: 'oa_sk_',
      defaultKeyLength: 40,
      enableMetadata: true,
      // A valid `x-api-key` header acts as the key owner's session on every endpoint.
      enableSessionForAPIKeys: true,
      rateLimit: { enabled: false },
    }),
    // Lets server actions set cookies. Must be the last plugin.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
