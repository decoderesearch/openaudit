// Names shared by the sign-in form, the confirm page and lib/auth.ts.

/** The page the sign-in email links to. It shows a "Sign in" button that uses the token. */
export const SIGN_IN_CONFIRM_PATH = '/signin/confirm';

/** The route the confirm page's form posts to. It sends the browser on to the verify endpoint. */
export const SIGN_IN_CONFIRM_POST = '/api/signin/confirm';

/** The Turnstile `action` for sign-in. The server refuses a token made for another action. */
export const TURNSTILE_ACTION = 'sign-in';

/** The query values that pass from the email link through the confirm page to the verify endpoint. */
export const VERIFY_PARAMS = ['token', 'callbackURL', 'newUserCallbackURL', 'errorCallbackURL'] as const;
