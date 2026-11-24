// Rules for users' run requests. Admins approve requests; some start at once (auto-approve).

/** The run error of a request that an admin declined. */
export const DECLINED = 'We did not approve this request.';

/** An eval with `autoApprove` starts at once when its estimated cost is at most this. */
export const AUTO_APPROVE_MAX_USD = 3;

/** Requests that one user can have auto-approved in 24 hours. More wait for an admin. */
export const AUTO_APPROVE_PER_DAY = 20;

/** Run statuses that stop a user from asking for the same run again. A declined request also does. */
export const REPEAT_STATUSES = ['requested', 'queued', 'running', 'importing', 'succeeded', 'failed'];

/**
 * Models that anyone can pick for a slot (a judge, an auditor): cheap models at the price and
 * quality frontier. A slot's default is also allowed.
 */
export const PICKABLE_SLOT_MODELS = [
  'openai/gpt-6-luna',
  'google/gemini-2.5-flash-lite',
  'openai/gpt-5-nano',
  'openai/gpt-4o-mini',
  'meta-llama/llama-3.3-70b-instruct',
  'openai/gpt-5-mini',
  'google/gemini-2.5-flash',
];
