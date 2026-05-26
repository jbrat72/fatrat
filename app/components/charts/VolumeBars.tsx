import type { WeeklyVolumeEntry } from '@/lib/progress';
import { cn } from '@/lib/ui/cn';

/**
 * ADVANCED — per-muscle weekly volume bars with MEV/MAV/MRV markers.
 */
export function VolumeBars({ entries }: { entries: WeeklyVolumeEntry[] }) {
  const items = entries.filter((e) => e.landmarks.mrv > 0);
  return (
    <div className="space-y-2">
      {items.map((e) => {
        const max = e.landmarks.mrv + 4;
        const pctMev = (e.landmarks.mev / max) * 100;
        const pctMav = (e.landmarks.mav / max) * 100;
        const pctMrv = (e.landmarks.mrv / max) * 100;
        const pct = Math.min(100, (e.sets / max) * 100);
        const fill =
          e.status === 'over-mrv' ? 'bg-danger' :
          e.status === 'near-mrv' ? 'bg-warn' :
          e.status === 'below-mev' ? 'bg-ink-mute' :
          'bg-ok';
        return (
          <div key={e.muscle}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="capitalize text-ink">{e.muscle}</span>
              <span className="text-ink-dim tnum">
                {e.sets}{' '}<span className="text-ink-mute">/ MRV {e.landmarks.mrv}</span>
              </span>
            </div>
            <div className="relative h-3 rounded bg-bg-input border border-ink-line overflow-hidden">
              <div className={cn('absolute inset-y-0 left-0 transition-all', fill)} style={{ width: `${pct}%` }} />
              <span className="absolute inset-y-0 w-px bg-ink-line/80" style={{ left: `${pctMev}%` }} title={`MEV ${e.landmarks.mev}`} />
              <span className="absolute inset-y-0 w-px bg-ink-dim/70" style={{ left: `${pctMav}%` }} title={`MAV ${e.landmarks.mav}`} />
              <span className="absolute inset-y-0 w-px bg-accent/80" style={{ left: `${pctMrv}%` }} title={`MRV ${e.landmarks.mrv}`} />
            </div>
          </div>
        );
      })}
      <div className="mt-2 flex items-center gap-3 text-[10px] tracking-wider2 text-ink-mute">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-ink-line" /> MEV</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-ink-dim" /> MAV</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-accent" /> MRV</span>
      </div>
    </div>
  );
}

/** Plain-English status word for a traffic-light entry. */
function statusLabel(status: WeeklyVolumeEntry['status'], sets: number): string {
  if (sets === 0)              return 'Not trained';
  if (status === 'below-mev')  return 'Could do more';
  if (status === 'in-range')   return 'Just right';
  if (status === 'near-mrv')   return 'Pushing limit';
  return 'Too much';
}

/**
 * INTERMEDIATE — clear muscle list with a dot AND a short status label.
 * Hides muscles you haven't trained this week so the grid doesn't look "broken".
 */
export function VolumeTrafficLights({ entries }: { entries: WeeklyVolumeEntry[] }) {
  // Hide muscles with no sets — they'd otherwise all show "could do more" / yellow.
  const items = entries.filter((e) => e.landmarks.mrv > 0 && e.sets > 0);
  if (items.length === 0) {
    return (
      <p className="text-sm text-ink-dim">
        No completed sets yet this week — start a workout and we&apos;ll start tracking volume.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-ink-line">
      {items.map((e) => {
        const dot =
          e.light === 'red'    ? 'bg-danger' :
          e.light === 'yellow' ? 'bg-warn'   :
          'bg-ok';
        return (
          <li key={e.muscle} className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
              <span className="capitalize text-sm font-medium">{e.muscle}</span>
            </div>
            <span className="text-xs text-ink-dim">{statusLabel(e.status, e.sets)}</span>
          </li>
        );
      })}
    </ul>
  );
}
