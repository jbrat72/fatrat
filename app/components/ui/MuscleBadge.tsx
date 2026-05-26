import { cn } from '@/lib/ui/cn';
import type { MuscleGroup } from '@/types';

/** Tailwind needs literal class strings — we map muscle to a static tailwind class. */
const COLORS: Record<MuscleGroup, string> = {
  chest:      'bg-muscle-chest',
  back:       'bg-muscle-back',
  shoulders:  'bg-muscle-shoulders',
  biceps:     'bg-muscle-biceps',
  triceps:    'bg-muscle-triceps',
  forearms:   'bg-muscle-forearms',
  quads:      'bg-muscle-quads',
  hamstrings: 'bg-muscle-hamstrings',
  glutes:     'bg-muscle-glutes',
  calves:     'bg-muscle-calves',
  core:       'bg-muscle-core',
  neck:       'bg-muscle-neck',
};

export function MuscleBadge({ muscle, className }: { muscle: MuscleGroup; className?: string }) {
  return (
    <span className={cn('badge-muscle', COLORS[muscle], className)}>
      {muscle.toUpperCase()}
    </span>
  );
}
