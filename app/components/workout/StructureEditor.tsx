'use client';
import { useState } from 'react';
import { MuscleBadge } from '@/components/ui';
import { cn } from '@/lib/ui/cn';
import { applyStyleAt, pairSuperset, unlinkGroup, groupLetters, setSetCount } from '@/lib/workout/structure';
import type { ExerciseEntry, SetStyle } from '@/types';

const STYLE_LABEL: Record<SetStyle, string> = { straight: 'Straight', superset: 'Superset', pyramid: 'Pyramid', drop: 'Drop' };

interface Props {
  exercises: ExerciseEntry[];
  /** Optional set types beyond straight + superset (e.g. ['pyramid','drop']). */
  allowed: SetStyle[];
  onChange: (exercises: ExerciseEntry[]) => void;
}

/**
 * Controlled, inline editor for day-of set structure. Each exercise shows
 * set-type pills (straight default, superset always, plus preferenced types);
 * tapping Superset arms a pairing and the next tap on another exercise links
 * them. Used on the Today workout card before Start.
 */
export function StructureEditor({ exercises, allowed, onChange }: Props) {
  const [pairFrom, setPairFrom] = useState<number | null>(null);
  const extra = allowed.filter((a) => a === 'pyramid' || a === 'drop');
  const styleButtons: SetStyle[] = ['straight', ...extra, 'superset'];
  const letters = groupLetters(exercises);

  const setStyle = (idx: number, st: SetStyle) => { setPairFrom(null); onChange(applyStyleAt(exercises, idx, st)); };
  const bumpSets = (idx: number, delta: number) => onChange(setSetCount(exercises, idx, exercises[idx]!.sets.length + delta));
  const onSuperset = (idx: number) => {
    if (pairFrom == null) { setPairFrom(idx); return; }
    if (pairFrom === idx) { setPairFrom(null); return; }
    onChange(pairSuperset(exercises, pairFrom, idx));
    setPairFrom(null);
  };

  return (
    <div className="space-y-2">
      {pairFrom != null && (
        <div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2">
          <span className="text-[12px] text-accent-hot font-medium flex-1">Pick an exercise to pair with {exercises[pairFrom]?.name}</span>
          <button type="button" onClick={() => setPairFrom(null)} className="text-[12px] text-ink-mute">Cancel</button>
        </div>
      )}
      {exercises.map((ex, i) => {
        const grouped = ex.supersetGroup != null;
        const letter = grouped ? letters.get(ex.supersetGroup!) : null;
        const isArmed = pairFrom === i;
        const isCandidate = pairFrom != null && pairFrom !== i && !isArmed;
        return (
          <div key={i} className={cn('rounded-xl border p-3', grouped || isCandidate ? 'border-accent/45 bg-accent/5' : 'border-ink-line bg-bg-card')}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <MuscleBadge muscle={ex.muscle} />
                <span className="font-medium text-sm truncate">{ex.name}</span>
              </div>
              {grouped ? (
                <button type="button" onClick={() => unlinkGroup && onChange(unlinkGroup(exercises, ex.supersetGroup!))} className="text-[10px] font-bold uppercase tracking-wide text-accent-hot shrink-0">⛓ Superset {letter} · unlink</button>
              ) : isCandidate ? (
                <button type="button" onClick={() => onSuperset(i)} className="text-[12px] font-medium text-accent shrink-0">Pair ›</button>
              ) : null}
            </div>
            {!grouped && (
              <div className="flex gap-1.5 flex-wrap mt-2.5">
                {styleButtons.map((st) => {
                  const on = st === 'superset' ? isArmed : (ex.setStyle ?? 'straight') === st && !isArmed;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => (st === 'superset' ? onSuperset(i) : setStyle(i, st))}
                      className={cn(
                        'text-[12px] font-medium px-3 py-1.5 rounded-lg border transition',
                        on ? 'border-accent bg-accent text-white' : 'border-ink-line text-ink-dim hover:text-ink',
                        isArmed && st === 'superset' && 'bg-accent/15 !text-accent-hot border-accent/50',
                      )}
                    >
                      {st === 'superset' && isArmed ? 'Superset · waiting' : STYLE_LABEL[st]}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2 mt-2.5 text-[12px] text-ink-dim">
              <span className="uppercase tracking-wide text-[10px] text-ink-mute">Sets</span>
              <button type="button" onClick={() => bumpSets(i, -1)} disabled={ex.sets.length <= 1} className="w-7 h-7 rounded-md border border-ink-line text-ink-dim disabled:opacity-30 hover:text-ink leading-none">−</button>
              <span className="w-5 text-center font-mono text-ink">{ex.sets.length}</span>
              <button type="button" onClick={() => bumpSets(i, 1)} className="w-7 h-7 rounded-md border border-ink-line text-ink-dim hover:text-ink leading-none">+</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
