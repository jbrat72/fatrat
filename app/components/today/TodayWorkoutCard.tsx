'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Card, Button, MuscleBadge } from '@/components/ui';
import { cn } from '@/lib/ui/cn';
import { kgToDisplay, weightLabel } from '@/lib/ui/units';
import { applyStyleAt, pairSuperset, unlinkGroup, setSetCount, groupLetters } from '@/lib/workout/structure';
import type { ExerciseEntry, Mesocycle, Microcycle, SetStyle, Units, WorkoutSession, MuscleGroup } from '@/types';

const STYLE_LABEL: Record<SetStyle, string> = { straight: 'Straight', superset: 'Superset', pyramid: 'Pyramid', drop: 'Drop' };

function prescription(ex: ExerciseEntry, units: Units): string {
  const m = ex.metric ?? 'weight-reps';
  const w = kgToDisplay(ex.sets[0]?.weightKg, units);
  const wl = weightLabel(units);
  const reps = `${ex.prescribedRepsLow ?? '?'}–${ex.prescribedRepsHigh ?? '?'} reps`;
  if (m === 'time') return `${ex.prescribedTimeLow ?? '?'}–${ex.prescribedTimeHigh ?? '?'}s`;
  if (m === 'weight-time') return `${w != null ? `${w} ${wl} × ` : ''}${ex.prescribedTimeLow ?? '?'}–${ex.prescribedTimeHigh ?? '?'}s`;
  if (m === 'reps') return `× ${reps}`;
  return `${w != null ? `${w} ${wl} × ` : '× '}${reps}`;
}

interface Props {
  session: WorkoutSession;
  meso: Mesocycle | null;
  micro: Microcycle | null;
  dayOrdinal: number | null;
  units: Units;
  allowed: SetStyle[];
  onPersist: (exercises: ExerciseEntry[]) => void;
}

export function TodayWorkoutCard({ session, meso, micro, dayOrdinal, units, allowed, onPersist }: Props) {
  const [exs, setExs] = useState<ExerciseEntry[]>(session.exercises);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [pairFrom, setPairFrom] = useState<number | null>(null);

  const apply = (next: ExerciseEntry[]) => { setExs(next); onPersist(next); };
  const toggleOpen = (i: number) => setOpen((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const extra = allowed.filter((a) => a === 'pyramid' || a === 'drop');
  const styleButtons: SetStyle[] = ['straight', ...extra, 'superset'];
  const letters = groupLetters(exs);

  const onStyle = (i: number, st: SetStyle) => {
    if (st === 'superset') {
      if (pairFrom == null) { setPairFrom(i); return; }
      if (pairFrom === i) { setPairFrom(null); return; }
      apply(pairSuperset(exs, pairFrom, i)); setPairFrom(null);
      return;
    }
    setPairFrom(null);
    apply(applyStyleAt(exs, i, st));
  };
  const onCandidate = (i: number) => { if (pairFrom != null && pairFrom !== i) { apply(pairSuperset(exs, pairFrom, i)); setPairFrom(null); } };

  const muscles = Array.from(new Set(exs.map((e) => e.muscle))) as MuscleGroup[];

  // Blocks: consecutive same-group exercises render together.
  const blocks: { idxs: number[]; group: number | null }[] = [];
  for (let i = 0; i < exs.length; ) {
    const g = exs[i]!.supersetGroup ?? null;
    if (g != null) { const idxs = [i]; let j = i + 1; while (j < exs.length && exs[j]!.supersetGroup === g) { idxs.push(j); j++; } blocks.push({ idxs, group: g }); i = j; }
    else { blocks.push({ idxs: [i], group: null }); i++; }
  }

  const renderRow = (i: number) => {
    const ex = exs[i]!;
    const expanded = open.has(i);
    const isArmed = pairFrom === i;
    const isCandidate = pairFrom != null && pairFrom !== i;
    return (
      <div key={i} className="rounded-xl border border-ink-line bg-bg-card overflow-hidden">
        <button type="button" onClick={() => (isCandidate ? onCandidate(i) : toggleOpen(i))} className="w-full text-left px-3 py-2.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium text-sm">{ex.sets.length} × {ex.name}</div>
            <div className="text-[12px] text-ink-dim font-mono mt-0.5">{prescription(ex, units)}</div>
          </div>
          {isCandidate
            ? <span className="text-[12px] font-medium text-accent shrink-0 mt-0.5">Pair ›</span>
            : <span className="text-ink-mute text-lg leading-none shrink-0 mt-0.5 transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>⌄</span>}
        </button>
        {expanded && (
          <div className="px-3 pb-3 pt-1 border-t border-ink-line">
            <div className="flex gap-1.5 flex-wrap">
              {styleButtons.map((st) => {
                const on = st === 'superset' ? (isArmed || ex.supersetGroup != null) : (ex.setStyle ?? 'straight') === st && ex.supersetGroup == null;
                return (
                  <button key={st} type="button" onClick={() => onStyle(i, st)}
                    className={cn('text-[12px] font-medium px-3 py-1.5 rounded-lg border transition',
                      on ? 'border-accent bg-accent text-white' : 'border-ink-line text-ink-dim hover:text-ink',
                      isArmed && st === 'superset' && 'bg-accent/15 !text-accent-hot border-accent/50')}>
                    {st === 'superset' && isArmed ? 'Superset · waiting' : STYLE_LABEL[st]}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="uppercase tracking-wide text-[10px] text-ink-mute">Sets</span>
              <button type="button" onClick={() => apply(setSetCount(exs, i, ex.sets.length - 1))} disabled={ex.sets.length <= 1} className="w-7 h-7 rounded-md border border-ink-line text-ink-dim disabled:opacity-30 hover:text-ink leading-none">−</button>
              <span className="w-5 text-center font-mono text-ink">{ex.sets.length}</span>
              <button type="button" onClick={() => apply(setSetCount(exs, i, ex.sets.length + 1))} className="w-7 h-7 rounded-md border border-ink-line text-ink-dim hover:text-ink leading-none">+</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <div className="text-[11px] tracking-wider2 text-ink-mute uppercase">
        {micro ? `Week ${micro.weekNumber}` : ''}{dayOrdinal ? ` · Day ${dayOrdinal}` : ''}{micro || dayOrdinal ? ' · ' : ''}Today
      </div>
      {meso?.name && <div className="text-base font-medium leading-tight mt-0.5 mb-3">{meso.name}</div>}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {muscles.map((m) => <MuscleBadge key={m} muscle={m} />)}
      </div>

      {pairFrom != null && (
        <div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 mb-3">
          <span className="text-[12px] text-accent-hot font-medium flex-1">Pick an exercise to pair with {exs[pairFrom]?.name}</span>
          <button type="button" onClick={() => setPairFrom(null)} className="text-[12px] text-ink-mute">Cancel</button>
        </div>
      )}

      <div className="section-head mb-2">{exs.length} Exercises</div>
      <div className="space-y-2">
        {blocks.map((b) => b.group != null ? (
          <div key={`g${b.group}`} className="rounded-xl border border-accent/40 bg-accent/5 p-1.5">
            <div className="flex items-center justify-between px-2 pt-1 pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-accent-hot">⛓ Superset {letters.get(b.group)}</span>
              <button type="button" onClick={() => apply(unlinkGroup(exs, b.group!))} className="text-[11px] text-ink-mute hover:text-ink">Unlink</button>
            </div>
            <div className="space-y-1.5">{b.idxs.map(renderRow)}</div>
          </div>
        ) : renderRow(b.idxs[0]!))}
      </div>

      <Link href="/today/workout" className="block mt-4">
        <Button block>{session.startedAt ? 'Continue Workout' : 'Start Workout'}</Button>
      </Link>
    </Card>
  );
}
