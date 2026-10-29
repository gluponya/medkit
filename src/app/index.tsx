import { Redirect } from 'expo-router';

import { useCabinets } from '@/data/cabinets';

/** No cabinet yet means the first launch: the welcome. Otherwise Home. */
export default function Start() {
  const cabinets = useCabinets();
  // TEMP: black-screen diagnosis.
  console.log('[start] cabinets', cabinets === undefined ? 'loading' : cabinets.length);
  if (cabinets === undefined) return null;
  return <Redirect href={cabinets.length === 0 ? '/welcome' : '/home'} />;
}
