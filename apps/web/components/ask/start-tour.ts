import { startWhyTour } from '@/components/why-tour';
import { WHY_REASONS } from '@/lib/why';
import { WHY_TOURS } from '@/lib/why-tour';
import type { useRouter } from 'nextjs-toploader/app';

type Router = ReturnType<typeof useRouter>;

/** Starts the tour `id` of `ASK_TOURS`: "home" and "why" run all reasons (the Full Tutorial),
 * "short" runs the Short Tutorial, and any other id runs one reason. */
export function startAskTour(id: string, router: Router) {
  if (id === 'short') return startWhyTour([], router, true);
  const ids = id === 'why' || id === 'home' ? WHY_REASONS.map((r) => r.id).filter((r) => WHY_TOURS[r]) : [id];
  startWhyTour(ids, router);
}
