// A handle names one user (their username). Organization slugs share this namespace.
// Aliases use it as a prefix (`jlin-honesty-4`), so a handle has no '-'.

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;
const HANDLE_RE = /^[a-z0-9_]+$/;

// Site words, and names a user could use to look official.
export const RESERVED_HANDLES = new Set([
  'about',
  'admin',
  'administrator',
  'anonymous',
  'api',
  'app',
  'auth',
  'docs',
  'everyone',
  'help',
  'legal',
  'me',
  'moderator',
  'new',
  'null',
  'official',
  'onboarding',
  'openaudit',
  'orgs',
  'privacy',
  'root',
  'security',
  'settings',
  'signin',
  'signout',
  'staff',
  'status',
  'support',
  'system',
  'team',
  'terms',
  'undefined',
  'users',
  'www',
]);

export function normalizeHandle(value: string): string {
  return value.trim().toLowerCase();
}

// A handle made from a display name: "Decode Research!" becomes "decode_research".
export function suggestHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, HANDLE_MAX)
    .replace(/_+$/, '');
}

// Why a normalized handle is not allowed, or null if it is.
export function handleError(handle: string): string | null {
  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX) {
    return `Use ${HANDLE_MIN} to ${HANDLE_MAX} characters.`;
  }
  if (!HANDLE_RE.test(handle)) {
    return 'Use lowercase letters, digits and underscores only.';
  }
  if (handle.startsWith('_') || handle.endsWith('_')) {
    return 'Do not start or end with an underscore.';
  }
  if (RESERVED_HANDLES.has(handle)) {
    return 'This name is reserved.';
  }
  return null;
}
