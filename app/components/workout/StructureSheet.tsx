'use client';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { StructureEditor } from './StructureEditor';
import type { ExerciseEntry, SetStyle } from '@/types';

interface Props {
  exercises: ExerciseEntry[];
  allowed: SetStyle[];
  onCancel: () => void;
  onStart: (exercises: ExerciseEntry[]) => void;
}

/** Modal wrapper around the shared StructureEditor — used for ad-hoc workouts,
 *  which have no Today card to structure on beforehand. */
export function StructureSheet({ exercises, allowed, onCancel, onStart }: Props) {
  const [exs, setExs] = useState<ExerciseEntry[]>(exercises);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onCancel}>
      <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-bg-card border-b border-ink-line px-4 py-3 flex items-center justify-between z-10">
          <div>
            <div className="font-bold text-[15px]">Structure your workout</div>
            <div className="text-xs text-ink-dim mt-0.5">Optional — leave as-is for straight sets.</div>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="text-ink-mute hover:text-ink text-lg leading-none px-1">✕</button>
        </div>
        <div className="px-4 py-3 pb-4">
          <StructureEditor exercises={exs} allowed={allowed} onChange={setExs} />
        </div>
        <div className="sticky bottom-0 bg-bg-card border-t border-ink-line px-4 py-3">
          <Button block onClick={() => onStart(exs)}>Start workout</Button>
        </div>
      </div>
    </div>
  );
}
