import { router } from 'expo-router';

import type { Added } from '@/data/medicines';
import { askForNotifications, rescheduleDoses } from '@/data/notifications';
import { useSession } from '@/data/session';

import { useDraft } from './draft';
import { useScan } from './scan';

/**
 * The end of every add (docs/journeys.md, J2): the draft is dropped and the
 * adding screens close. Then the medicine opens with the «Додано» toast, or,
 * when adding started from «Додати нагадування», its new reminder on top of it.
 * The first add is where the app asks for notifications: the pack's date is
 * what they are for, even in a cabinet without reminders. In the scanner's
 * «Кілька поспіль» it goes back to the scanner instead, with the toast there.
 */
export function finishAdd(added: Added): void {
  const { then, name, reset } = useDraft.getState();
  reset();
  void askForNotifications().then(rescheduleDoses);
  const scan = useScan.getState();
  if (then === 'medicine' && scan.open && useSession.getState().scanMany) {
    scan.set({ added: { ...added, name } });
    router.dismissTo('/add/scan');
    return;
  }
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
