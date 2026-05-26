import { cn } from '@/lib/ui/cn';
import type { UserMode } from '@/types';

const STYLE: Record<UserMode, string> = {
  BASIC:        'bg-ok/20 text-ok',
  INTERMEDIATE: 'bg-warn/20 text-warn',
  ADVANCED:     'bg-accent/25 text-accent',
};

export function ModeChip({ mode, className }: { mode: UserMode; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-widest2',
      STYLE[mode],
      className,
    )}>
      {mode}
    </span>
  );
}
