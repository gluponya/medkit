import { router } from 'expo-router';

import type { Added } from '@/data/medicines';

import { useDraft } from './draft';

/**
 * The end of every add (docs/journeys.md, J2): the draft is dropped and the
 * adding screens close. Then the medicine opens with the «Додано» toast, or,
 * when adding started from «Додати нагадування», its new reminder on top of it.
 */
export function finishAdd(added: Added): void {
  const { then, reset } = useDraft.getState();
  reset();
  router.dismissAll();
  if (then === 'reminder') {
    router.push({ pathname: '/medicine/[id]', params: { id: added.medicineId } });
    router.push({ pathname: '/medicine/[id]/reminder', params: { id: added.medicineId } });
    return;
  }
  router.push({
    pathname: '/medicine/[id]',
    params: { id: added.medicineId, added: added.packageId, isNew: added.isNew ? '1' : '' },
  });
}
