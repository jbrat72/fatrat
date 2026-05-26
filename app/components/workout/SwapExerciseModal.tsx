'use client';
import { useEffect, useState } from 'react';
import { MuscleBadge, Button } from '@/components/ui';
import { useUser } from '@/components/app';
import { getRepository } from '@/lib/firestore';
import { findSimilar } from '@/lib/exercise/findSimilar';
import { EMPTY_EXERCISE_PREFS, personalizeLibrary, isFavorite } from '@/lib/exercise/personalize';
import type { ExerciseDefinition, UserExercisePrefs } from '@/types';

interface Props {
  open: boolean;
  fromExerciseId: string;
  onClose: () => void;
  onPick: (next: ExerciseDefinition) => void;
}

export function SwapExerciseModal({ open, fromExerciseId, onClose, onPick }: Props) {
  const { user } = useUser();
  const [library, setLibrary] = useState<ExerciseDefinition[]>([]);
  const [prefs, setPrefs] = useState<UserExercisePrefs>(EMPTY_EXERCISE_PREFS);

  useEffect(() => {
    if (!open || !user) return;
    const load = async () => {
      const repo = getRepository();
      const [g, c, p] = await Promise.all([
        repo.listGlobalExercises(),
        repo.listUserExercises(user.userId),
        repo.getExercisePrefs(user.userId),
      ]);
      setLibrary([...c, ...g]);
      setPrefs(p);
    };
    load();
  }, [open, user]);

  if (!open || !user) return null;

  const original = library.find((e) => e.id === fromExerciseId);
  // findSimilar searches the full library (so the current exercise resolves);
  // personalizeLibrary then drops hidden exercises and lifts favorites first.
  const candidates = personalizeLibrary(
    findSimilar({
      exerciseId: fromExerciseId,
      library,
      userEquipment: user.equipment,
      excludedNames: user.constraints?.excludedLifts ?? [],
    }),
    prefs,
  );

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={onClose}>
      <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-bg-card border-b border-ink-line px-4 py-3 flex items-center justify-between">
          <div>
            <div className="section-head">REPLACE EXERCISE</div>
            {original && <div className="text-xs text-ink-dim mt-0.5">Same muscle group as <span className="text-ink">{original.name}</span></div>}
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink" aria-label="Close">✕</button>
        </div>

        <div className="px-4 py-3 space-y-2">
          {candidates.length === 0 && <p className="text-sm text-ink-dim py-4">No alternatives available with your equipment.</p>}
          {candidates.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => onPick(ex)}
              className="w-full text-left card hover:border-accent transition flex items-center gap-3 p-3"
            >
              <MuscleBadge muscle={ex.primaryMuscle} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{ex.name}</div>
                <div className="text-xs text-ink-dim capitalize">{ex.equipment}{ex.isCustom ? ' · custom' : ''}</div>
              </div>
              {isFavorite(prefs, ex.id) && <span className="text-accent text-sm shrink-0" aria-label="Favorite">★</span>}
              <span className="text-ink-mute">›</span>
            </button>
          ))}
        </div>

        <div className="px-4 pb-4 pt-2">
          <Button variant="ghost" block onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
