import { z } from 'zod';
import { handleError, normalizeHandle } from './handles';
import { normalizeWebsite, WEBSITE_ERROR } from './urls';

// Profile fields, shared by onboarding and settings. Safe to import from client code.
export const ProfileSchema = z.object({
  username: z
    .string()
    .transform(normalizeHandle)
    .superRefine((value, ctx) => {
      const problem = handleError(value);
      if (problem) ctx.addIssue({ code: 'custom', message: `Username: ${problem}` });
    }),
  name: z.string().trim().min(1, 'Name is required.').max(120),
  affiliation: z.string().trim().max(200),
  website: z
    .string()
    .max(300)
    .transform((v, ctx) => {
      const website = normalizeWebsite(v);
      if (website === null) {
        ctx.addIssue({ code: 'custom', message: WEBSITE_ERROR });
        return z.NEVER;
      }
      return website;
    }),
});

export type ProfileInput = z.input<typeof ProfileSchema>;
export type Profile = z.output<typeof ProfileSchema>;

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}
