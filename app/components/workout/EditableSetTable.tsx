'use client';
import { InlineNumber } from '@/components/ui';
import { kgToDisplay, displayToKg, weightLabel } from '@/lib/ui/units';
import type { SetEntry, ExerciseEntry, Units } from '@/types';

interface Props {
  sets: SetEntry[];
  metric: NonNullable<ExerciseEntry['metric']>;
  units: Units;
  onChange: (next: SetEntry[]) => void;
}

/**
 * Per-exercise set editor. Renders one row per set with weight / reps / time
 * InlineNumbers appropriate to the exercise's metric. Skipped sets stay
 * marked Skipped and are not editable.
 *
 * Used by the History session detail page and the Plan day detail page so
 * users can correct or fill in any set after the fact.
 */
export function EditableSetTable({ sets, metric, units, onChange }: Props) {
  const showWeight = metric === 'weight-reps' || metric === 'weight-time';
  const showReps   = metric === 'weight-reps' || metric === 'reps';
  const showTime   = metric === 'time' || metric === 'weight-time';
  const wLabel = weightLabel(units);
  const wStep = units === 'imperial' ? 5 : 2.5;
  const updateAt = (idx: number, patch: Partial<SetEntry>) => {
    onChange(sets.map((s, j) => (j === idx ? { ...s, ...patch } : s)));
  };
  const cols = [showWeight ? '1fr' : '', showReps ? '1fr' : '', showTime ? '1fr' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className="mt-1 space-y-2">
      {sets.map((s, idx) => {
        if (s.setType === 'skip') {
          return (
            <div key={idx} className="rounded-md border border-ink-line bg-bg-card/50 px-2 py-1.5 text-xs flex items-center justify-between">
              <span className="text-ink-mute">Set {idx + 1} · Skipped</span>
              <button type="button" onClick={() => updateAt(idx, { setType: undefined })} className="text-accent font-medium">Un-skip to edit</button>
            </div>
          );
        }
        return (
          <div key={idx} className="rounded-md border border-ink-line bg-bg-card/50 px-2 py-2">
            <div className="text-[10px] tracking-wider2 font-semibold text-ink-mute mb-1">SET {idx + 1}</div>
            <div className="grid gap-2" style={{ gridTemplateColumns: cols }}>
              {showWeight && (
                <div>
                  <div className="text-[10px] tracking-wider2 text-ink-mute mb-1">WEIGHT</div>
                  <InlineNumber
                    value={kgToDisplay(s.weightKg, units)}
                    onChange={(n) => updateAt(idx, { weightKg: displayToKg(n, units) })}
                    step={wStep}
                    decimals={1}
                    unit={wLabel}
                    ariaLabel={`Set ${idx + 1} weight`}
                  />
                </div>
              )}
              {showReps && (
                <div>
                  <div className="text-[10px] tracking-wider2 text-ink-mute mb-1">REPS</div>
                  <InlineNumber
                    value={s.reps}
                    onChange={(n) => updateAt(idx, { reps: n })}
                    step={1}
                    decimals={0}
                    ariaLabel={`Set ${idx + 1} reps`}
                  />
                </div>
              )}
              {showTime && (
                <div>
                  <div className="text-[10px] tracking-wider2 text-ink-mute mb-1">TIME</div>
                  <InlineNumber
                    value={s.timeSec}
                    onChange={(n) => updateAt(idx, { timeSec: n })}
                    step={5}
                    min={1}
                    time
                    ariaLabel={`Set ${idx + 1} time`}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
