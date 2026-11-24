import type { Document } from '@openaudit/spec';

type DateLike = string | Date | null | undefined;

function toDate(value: DateLike): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'per',
  'the',
  'to',
  'vs',
]);

/** "Feature Match (MCC)" from "Feature match (MCC)". Small words stay lower case, but not first. */
export function titleCase(s: string) {
  return s.replace(/(^|[\s(])([a-z][\w']*)/g, (_, pre: string, w: string, at: number) =>
    at > 0 && SMALL_WORDS.has(w) ? pre + w : pre + w[0].toUpperCase() + w.slice(1),
  );
}

export function dateShort(value: DateLike): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

/** "10/21/2026". */
export function dateNumeric(value: DateLike): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString('en-US') : '—';
}

/** "10-01-2026". */
export function dateDashed(value: DateLike): string {
  const d = toDate(value);
  const two = (n: number) => String(n).padStart(2, '0');
  return d ? `${two(d.getMonth() + 1)}-${two(d.getDate())}-${d.getFullYear()}` : '—';
}

export function dateTime(value: DateLike): string {
  const d = toDate(value);
  return d
    ? d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';
}

export const DOCUMENT_KINDS: Record<Document['kind'], string> = {
  system_card: 'System card',
  safety_report: 'Safety report',
  technical_report: 'Technical report',
  model_page: 'Model page',
  blog: 'Blog post',
};
