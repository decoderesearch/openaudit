// Roles. Safe to import from client code.

// Site roles. `user` is the default; `moderator` handles public annotations and incidents;
// `admin` is set by an admin, or by `BOOTSTRAP_ADMIN_EMAILS` when the account is made.
export const SITE_ROLES = ['user', 'moderator', 'admin'] as const;
export type SiteRole = (typeof SITE_ROLES)[number];
