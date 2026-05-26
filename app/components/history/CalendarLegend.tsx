import { cn } from '@/lib/ui/cn';

/**
 * Shared colour key for the calendar. "Today" leads, drawn as a red circle to
 * match how today's day number is marked in the calendar itself.
 */
export function CalendarLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-x-3 gap-y-1.5 flex-wrap text-[11px] text-ink-mute', className)}>
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-accent" /> Today</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-ok/40 border border-ok/60" /> Completed</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-warn/20 border border-warn/50" /> Skipped</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-bg-card border border-ink-line" /> Scheduled</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-crosshatch border border-ink-line/60" /> Off-day</span>
    </div>
  );
}
