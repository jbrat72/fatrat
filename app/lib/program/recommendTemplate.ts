import type { UserMode, PrimaryGoal } from '@/types';

export function recommendTemplateId(opts: {
  mode: UserMode;
  primaryGoal: PrimaryGoal;
  daysPerWeek: number;
}): string {
  const { mode, primaryGoal, daysPerWeek } = opts;
  if (mode === 'BASIC') {
    if (primaryGoal === 'lose-fat' || primaryGoal === 'maintain') return 'tpl-tone-maintain';
    if (daysPerWeek <= 2) return 'tpl-get-started';
    return 'tpl-full-body-3x';
  }
  // INTERMEDIATE / ADVANCED
  if (primaryGoal === 'get-stronger') return 'tpl-531-4day';
  if (daysPerWeek >= 6)               return 'tpl-ppl-6day';
  if (daysPerWeek >= 4)               return 'tpl-upper-lower-4day';
  return 'tpl-full-body-3x';
}
