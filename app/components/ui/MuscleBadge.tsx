import { cn } from '@/lib/ui/cn';
import type { MuscleGroup } from '@/types';

/** Per-muscle accent color (matches tailwind.config `muscle.*`). Used for the
 *  soft-outline pill: colored border + matching text + a faint tinted fill. */
export const MUSCLE_COLOR: Record<MuscleGroup, string> = {
  chest:      '#a855f7',
  back:       '#3b82f6',
  shoulders:  '#ec4899',
  biceps:     '#f97316',
  triceps:    '#ef4444',
  forearms:   '#8b5cf6',
  quads:      '#22c55e',
  hamstrings: '#16a34a',
  glutes:     '#10b981',
  calves:     '#84cc16',
  core:       '#eab308',
  neck:       '#64748b',
};

export function MuscleBadge({ muscle, className }: { muscle: MuscleGroup; className?: string }) {
  const c = MUSCLE_COLOR[muscle] ?? '#64748b';
  return (
    <span
      className={cn('badge-muscle', className)}
      style={{ color: c, borderColor: c, backgroundColor: `${c}1f` }}
    >
      {muscle.toUpperCase()}
    </span>
  );
}
