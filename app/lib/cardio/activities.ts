import type { CardioActivity } from '@/types';

/** Single source of truth for cardio activity options + labels. Used by the
 *  Log Cardio picker and the Profile "Cardio favorites" filter. */
export const CARDIO_ACTIVITIES: { value: CardioActivity; label: string }[] = [
  { value: 'treadmill', label: 'Treadmill' },
  { value: 'bike', label: 'Bike' },
  { value: 'walking', label: 'Walking' },
  { value: 'running-outdoor', label: 'Running' },
  { value: 'elliptical', label: 'Elliptical' },
  { value: 'rower', label: 'Rower' },
  { value: 'stair-climber', label: 'Stair climber' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'pickleball', label: 'Pickleball' },
  { value: 'other', label: 'Other' },
];

export function cardioLabel(a: CardioActivity): string {
  return CARDIO_ACTIVITIES.find((x) => x.value === a)?.label ?? a;
}
