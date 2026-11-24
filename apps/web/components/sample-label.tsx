import { sampleLabel, sampleTitle, type SampleRef } from '@/lib/sample-label';

/** A sample's short label, with its full id on hover when the label shortens it. `max`: the
 * label's most characters. */
export function SampleLabel({ sample, max, className }: { sample: SampleRef; max?: number; className?: string }) {
  return (
    <span title={sampleTitle(sample, max)} className={className}>
      {sampleLabel(sample, max)}
    </span>
  );
}
