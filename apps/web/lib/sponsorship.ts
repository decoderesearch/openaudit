import { SPONSOR } from '@/lib/legal';

// The terms of an audit sponsorship: in the sponsor dialog, and on the Terms page at #sponsorship.

export const SPONSORSHIP_HASH = 'sponsorship';

/** The amount buttons on the donation page (`DONATE_URL`), in USD. */
const DONATE_AMOUNTS = [50, 100, 250, 500, 1000, 2500, 5000, 10000];

/** The step on the donation page that gives `usd`: its button, else "Other" and the amount. */
export function donateAmountStep(usd: number): string {
  const amount = `$${usd.toLocaleString('en-US')}`;
  return DONATE_AMOUNTS.includes(usd) ? `Choose ${amount}.` : `Choose Other, then enter ${amount}.`;
}

/** What a sponsor agrees to. */
export const SPONSORSHIP_TERMS = [
  `Your gift is a donation to ${SPONSOR}, a nonprofit organization, for the work of Decode Research. You get no goods or services for it.`,
  'You, your family, your employer and anyone you act for will get no financial or other personal benefit from the audit.',
  `Your choice of model is a request, not a condition. ${SPONSOR} has final control over the funds. We choose the evals, the settings, the judges and what we publish.`,
  'You get no early access to the results, and you cannot review, change or stop them. We publish the results, whatever they show.',
  'The estimate is not a price. If the audit costs less than your gift, or if we cannot do it (for example, the model leaves OpenRouter), we use the rest for other audits or for the work of Decode Research. We do not refund a donation, except for a payment made in error.',
  'Tell us if you work for, or act for, an AI developer. We can decline any gift, for example to keep our audits independent.',
  'We do not guarantee that the audit completes, when it completes, or what it finds.',
] as const;
