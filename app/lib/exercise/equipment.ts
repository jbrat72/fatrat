/**
 * Granular equipment — the single source of truth for what a user owns.
 *
 * Stored on the profile as `equipmentItems: string[]` (Page-5 checklist
 * labels). Everything that needs "can this user do this exercise?" — the Plan
 * Wizard, the in-workout Swap/Add pickers — goes through `canUseExercise`,
 * which combines the coarse `equipment` type with the exercise's granular
 * `requiresEquipment` field (a Flat bench is also satisfied by an Adjustable).
 */
import type { ExerciseDefinition, EquipmentType, EquipmentAccess } from '@/types';

export const EQUIP_GROUPS: Record<string, string[]> = {
  'Free Weights': ['Barbell & Plates', 'Dumbbells — Fixed', 'Dumbbells — Adjustable', 'Kettlebells', 'EZ Curl Bar', 'Trap Bar'],
  'Racks & Benches': ['Power / Squat Rack', 'Bench — Flat', 'Bench — Adjustable', 'Dip Station'],
  'Machines': ['Smith Machine', 'Leg Press', 'Lat Pulldown / Row', 'Chest/Shoulder Press Machine', 'Leg Curl/Extension', 'Pec Deck', 'Hack Squat', 'Gym Machine'],
  'Cables & Accessories': ['Cable Machine', 'Functional Trainer', 'Resistance Bands', 'Pull-Up Bar', 'Suspension Trainer', 'Landmine', 'Ab Wheel', 'GHD'],
  'Cardio / Conditioning': ['Battle Ropes', 'Sled / Prowler', 'Rower / Assault Bike / Ski Erg'],
};
export const ALL_EQUIPMENT: string[] = Object.values(EQUIP_GROUPS).flat();

/** Friendlier display label for the internal 'Gym Machine' sentinel. */
export function equipLabel(item: string): string { return item === 'Gym Machine' ? 'Other Gym Machine' : item; }

/** Granular checklist → coarse EquipmentType set the library is tagged with.
 *  Bodyweight is always available. */
export function availableTypes(items: string[]): Set<EquipmentType> {
  const s = new Set<EquipmentType>(['bodyweight']);
  const has = (l: string) => items.includes(l);
  if (has('Barbell & Plates') || has('EZ Curl Bar') || has('Trap Bar')) s.add('barbell');
  if (has('Dumbbells — Fixed') || has('Dumbbells — Adjustable')) s.add('dumbbell');
  if (has('Kettlebells')) s.add('kettlebell');
  if (has('Resistance Bands')) s.add('band');
  if (has('Smith Machine')) s.add('smith');
  if (has('Cable Machine') || has('Functional Trainer')) s.add('cable');
  for (const m of ['Leg Press', 'Lat Pulldown / Row', 'Chest/Shoulder Press Machine', 'Leg Curl/Extension', 'Pec Deck', 'Hack Squat', 'Gym Machine']) {
    if (has(m)) { s.add('machine'); break; }
  }
  return s;
}

/** True if the user's equipment can perform this exercise (coarse + granular). */
export function canUseExercise(e: ExerciseDefinition, items: string[]): boolean {
  if (!availableTypes(items).has(e.equipment)) return false;
  const req = e.requiresEquipment;
  if (!req || req.length === 0) return true;
  const set = new Set(items);
  return req.every((label) => set.has(label) || (label === 'Bench — Flat' && set.has('Bench — Adjustable')));
}

/** Only weighted training is possible? (used for calisthenics-style defaults) */
export function isBodyweightOnly(items: string[]): boolean {
  const t = availableTypes(items);
  return [...t].every((x) => x === 'bodyweight');
}

/** Best-effort coarse EquipmentAccess from a granular list (keeps the legacy
 *  `profile.equipment` field meaningful; granular is the real source of truth). */
export function coarseFromItems(items: string[]): EquipmentAccess[] {
  if (items.length === 0) return ['bodyweight'];
  const t = availableTypes(items);
  if (t.has('machine') || t.has('cable') || t.has('smith')) return ['commercial-gym'];
  if (t.has('barbell')) return ['home-gym'];
  if (t.has('dumbbell')) return ['dumbbells-only'];
  if (t.has('kettlebell')) return ['bodyweight-kettlebells'];
  if (t.has('band')) return ['bodyweight-bands'];
  return ['bodyweight'];
}

/** Seed a granular list from the profile's coarse equipment access (migration). */
export function inferEquipmentItems(access: EquipmentAccess[]): string[] {
  const out = new Set<string>();
  const add = (...xs: string[]) => xs.forEach((x) => out.add(x));
  for (const a of access) {
    switch (a) {
      case 'commercial-gym': ALL_EQUIPMENT.forEach((x) => out.add(x)); break;
      case 'home-gym': add('Barbell & Plates', 'Power / Squat Rack', 'Dumbbells — Adjustable', 'Bench — Adjustable', 'Pull-Up Bar'); break;
      case 'dumbbells-only':
      case 'bodyweight-dumbbells': add('Dumbbells — Adjustable', 'Bench — Adjustable'); break;
      case 'bodyweight': break;
      case 'bodyweight-bands':
      case 'bands': add('Resistance Bands'); break;
      case 'bodyweight-kettlebells': add('Kettlebells'); break;
      case 'limited-hotel': add('Dumbbells — Adjustable', 'Resistance Bands'); break;
    }
  }
  // Sensible default if we couldn't infer anything: assume a commercial gym.
  return out.size > 0 ? ALL_EQUIPMENT.filter((x) => out.has(x)) : ALL_EQUIPMENT.slice();
}
