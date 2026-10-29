import { Redirect } from 'expo-router';

import { useCabinets } from '@/data/cabinets';

/** No cabinet yet means the first launch: the welcome. Otherwise Home. */
export default function Start() {
  const cabinets = useCabinets();
  if (cabinets === undefined) return null;
  return <Redirect href={cabinets.length === 0 ? '/welcome' : '/home'} />;
}
