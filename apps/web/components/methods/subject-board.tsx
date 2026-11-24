import { Tag } from '@/components/catalog/parts';
import { ACCESS_LABELS, type BoardVariant } from '@/lib/methods';

export type SubjectLink = { label: string; href?: string };

/** The access tag of a variant. */
export function AccessTag({ access }: { access: BoardVariant['access'] }) {
  return <Tag>{ACCESS_LABELS[access].toLowerCase()}</Tag>;
}
