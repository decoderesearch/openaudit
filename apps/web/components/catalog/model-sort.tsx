'use client';

import { MODEL_SORTS, type ModelSort } from '@/components/catalog/model-list';
import { SegmentedControl } from '@/components/ui/segmented-control';

/** The order of a model list. */
export function ModelSortControl({ value, onChange }: { value: ModelSort; onChange: (value: ModelSort) => void }) {
  return <SegmentedControl label="Sort models" small value={value} options={MODEL_SORTS} onValueChange={onChange} />;
}
