import { cn } from '@/lib/ui/cn';
import type { Microcycle } from '@/types';

/**
 * Visual intensity ramp — bars per week, height = inverse of RIR (lower RIR = harder).
 * Active week glows red. Used in ADVANCED Plan tab.
 */
export function IntensityRamp({ microcycles }: { microcycles: Microcycle[] }) {
  if (microcycles.length === 0) return null;
  const max = 4; // RIR ramp typically 3..0; pad headroom
  return (
    <div className="flex items-end gap-1.5 h-20 mt-1">
      {microcycles.map((m) => {
        const rir = m.targetRIR ?? 2;
        const intensity = (max - Math.min(rir, max)) / max; // 0..1
        const heightPct = 25 + intensity * 75;
        return (
          <div key={m.id} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={cn(
                'w-full rounded-t transition-all',
                m.status === 'active' && 'bg-accent shadow-glow',
                m.status === 'completed' && 'bg-ok/60',
                m.status === 'draft' && 'bg-ink-line',
              )}
              style={{ height: `${heightPct}%` }}
              title={`Wk ${m.weekNumber} · ${rir} RIR`}
            />
            <div className="text-[10px] text-ink-dim tnum">{m.weekNumber}</div>
          </div>
        );
      })}
    </div>
  );
}
