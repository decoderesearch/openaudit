import type { EvalCounts } from '@/components/catalog/model-list';
import { Meter } from '@/components/deploymeter/meter';
import { votesOf } from '@/lib/deploymeter';

/** A model's Deploymeter score and votes bar, small. Not a link and no hover: the box it is in
 * links to the model. */
export function ModelStats({ evals }: { evals: EvalCounts }) {
  return (
    <div className="flex shrink-0 items-center">
      <Meter score={evals.deploymeter} votes={evals.judges ? votesOf(evals.judges) : null} small />
    </div>
  );
}
