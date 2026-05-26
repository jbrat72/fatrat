'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/components/app';
import { Button, Card, ChoicePill, MuscleBadge, PageTitle, TextField } from '@/components/ui';
import { cn } from '@/lib/ui/cn';
import { getRepository } from '@/lib/firestore';
import { EMPTY_EXERCISE_PREFS, isFavorite, isHidden, toggleFavorite, toggleHidden } from '@/lib/exercise/personalize';
import type { ExerciseDefinition, MuscleGroup, EquipmentType, MovementPattern, UserExercisePrefs } from '@/types';

const MUSCLES: MuscleGroup[] = ['chest','back','shoulders','biceps','triceps','forearms','quads','hamstrings','glutes','calves','core','neck'];
const EQUIPMENT: EquipmentType[] = ['barbell','dumbbell','machine','cable','bodyweight','kettlebell','band','smith'];
const PATTERNS: MovementPattern[] = ['compound','isolation','push','pull','hinge','squat','carry','lunge'];

type View = 'all' | 'favorites' | 'custom' | 'hidden';
const VIEWS: { value: View; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'custom', label: 'Custom' },
  { value: 'hidden', label: 'Hidden' },
];

function emptyDraft(): Partial<ExerciseDefinition> {
  return { name: '', primaryMuscle: 'chest', equipment: 'barbell', secondaryMuscles: [], patterns: [] };
}

function toggleIn<T>(arr: T[] | undefined, v: T): T[] {
  const a = arr ?? [];
  return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
}

export default function ExercisesPage() {
  const { user } = useUser();
  const [global, setGlobal] = useState<ExerciseDefinition[]>([]);
  const [custom, setCustom] = useState<ExerciseDefinition[]>([]);
  const [prefs, setPrefs] = useState<UserExercisePrefs>(EMPTY_EXERCISE_PREFS);
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all');
  const [equip, setEquip] = useState<EquipmentType | 'all'>('all');
  const [view, setView] = useState<View>('all');
  const [manageId, setManageId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<ExerciseDefinition>>(emptyDraft());

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const repo = getRepository();
      const [g, c, p] = await Promise.all([
        repo.listGlobalExercises(),
        repo.listUserExercises(user.userId),
        repo.getExercisePrefs(user.userId),
      ]);
      setGlobal(g); setCustom(c); setPrefs(p);
    };
    load();
  }, [user]);

  const all = useMemo(() => [...custom, ...global], [custom, global]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = all;
    if (view === 'favorites') list = list.filter((e) => isFavorite(prefs, e.id));
    else if (view === 'custom') list = list.filter((e) => e.isCustom);
    else if (view === 'hidden') list = list.filter((e) => isHidden(prefs, e.id));
    else list = list.filter((e) => !isHidden(prefs, e.id));
    list = list.filter((e) => {
      if (muscle !== 'all' && e.primaryMuscle !== muscle) return false;
      if (equip !== 'all' && e.equipment !== equip) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
    if (view !== 'hidden') {
      list = [
        ...list.filter((e) => isFavorite(prefs, e.id)),
        ...list.filter((e) => !isFavorite(prefs, e.id)),
      ];
    }
    return list;
  }, [all, prefs, view, muscle, equip, search]);

  if (!user) return null;

  const persistPrefs = async (next: UserExercisePrefs) => {
    setPrefs(next);
    await getRepository().upsertExercisePrefs(user.userId, next);
  };
  const onToggleFavorite = (id: string) => persistPrefs(toggleFavorite(prefs, id));
  const onToggleHidden = (id: string) => persistPrefs(toggleHidden(prefs, id));

  const openCreate = () => { setEditingId(null); setDraft(emptyDraft()); setFormOpen(true); };
  const openEdit = (ex: ExerciseDefinition) => {
    setEditingId(ex.id);
    setDraft({ ...ex, secondaryMuscles: ex.secondaryMuscles ?? [], patterns: ex.patterns ?? [] });
    setManageId(null);
    setFormOpen(true);
  };
  const closeForm = () => { setFormOpen(false); setEditingId(null); setDraft(emptyDraft()); };

  const saveExercise = async () => {
    if (!draft.name?.trim()) return;
    const repo = getRepository();
    const ex: ExerciseDefinition = {
      id: editingId ?? 'custom-' + Math.random().toString(36).slice(2, 9),
      name: draft.name.trim(),
      primaryMuscle: (draft.primaryMuscle ?? 'chest') as MuscleGroup,
      equipment: (draft.equipment ?? 'barbell') as EquipmentType,
      secondaryMuscles: (draft.secondaryMuscles ?? []).filter((m) => m !== draft.primaryMuscle),
      patterns: draft.patterns ?? [],
      isCustom: true,
      ownerUserId: user.userId,
    };
    const saved = await repo.upsertUserExercise(user.userId, ex);
    setCustom((cs) => [...cs.filter((c) => c.id !== saved.id), saved]);
    closeForm();
  };

  const deleteExercise = async (id: string) => {
    await getRepository().deleteUserExercise(user.userId, id);
    setCustom((cs) => cs.filter((c) => c.id !== id));
    setPrefs((p) => ({
      favorites: p.favorites.filter((x) => x !== id),
      hidden: p.hidden.filter((x) => x !== id),
    }));
    setManageId(null);
  };

  const manageEx = manageId ? all.find((e) => e.id === manageId) ?? null : null;

  return (
    <div>
      <PageTitle
        title="Exercises"
        subtitle={`${all.length} exercises · ${prefs.favorites.length} favorited`}
        trailing={<Button size="sm" onClick={openCreate}>+ New</Button>}
      />
      <div className="px-4 space-y-3">
        <Card>
          <TextField label="Search" placeholder="bench, row, squat…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="mt-3">
            <div className="text-[10px] tracking-wider2 text-ink-mute uppercase mb-1.5">Show</div>
            <div className="flex gap-1.5 flex-wrap">
              {VIEWS.map((v) => (
                <ChoicePill key={v.value} value={v.value} label={v.label} selected={view === v.value} onSelect={() => setView(v.value)} />
              ))}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[10px] tracking-wider2 text-ink-mute uppercase mb-1.5">Muscle</div>
            <div className="flex gap-1.5 flex-wrap">
              <ChoicePill value="all" label="All" selected={muscle === 'all'} onSelect={() => setMuscle('all')} />
              {MUSCLES.map((m) => (
                <ChoicePill key={m} value={m} label={m} selected={muscle === m} onSelect={() => setMuscle(m)} />
              ))}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[10px] tracking-wider2 text-ink-mute uppercase mb-1.5">Equipment</div>
            <div className="flex gap-1.5 flex-wrap">
              <ChoicePill value="all" label="All" selected={equip === 'all'} onSelect={() => setEquip('all')} />
              {EQUIPMENT.map((e) => (
                <ChoicePill key={e} value={e} label={e} selected={equip === e} onSelect={() => setEquip(e)} />
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-1.5">
          {filtered.map((ex) => {
            const fav = isFavorite(prefs, ex.id);
            const hidden = isHidden(prefs, ex.id);
            return (
              <Card key={ex.id} className={cn('p-3', hidden && 'opacity-60')}>
                <div className="flex items-center gap-3">
                  <MuscleBadge muscle={ex.primaryMuscle} />
                  <button
                    type="button"
                    onClick={() => setManageId(ex.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="font-medium truncate">{ex.name}</div>
                    <div className="text-xs text-ink-dim capitalize">
                      {ex.equipment}
                      {ex.isCustom ? ' · custom' : ''}
                      {hidden ? ' · hidden' : ''}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(ex.id)}
                    aria-label={fav ? 'Unfavorite' : 'Favorite'}
                    aria-pressed={fav}
                    className={cn(
                      'w-9 h-9 rounded-md border flex items-center justify-center text-lg transition',
                      fav
                        ? 'border-accent text-accent'
                        : 'border-ink-line text-ink-mute hover:text-ink',
                    )}
                  >
                    {fav ? '★' : '☆'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleHidden(ex.id)}
                    aria-label={hidden ? 'Unhide exercise' : 'Hide exercise'}
                    aria-pressed={hidden}
                    className={cn(
                      'w-9 h-9 rounded-md border flex items-center justify-center transition shrink-0',
                      hidden
                        ? 'border-accent text-accent'
                        : 'border-ink-line text-ink-mute hover:text-ink',
                    )}
                  >
                    {hidden ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <path d="M6.61 6.61A18.45 18.45 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
                        <line x1="2" y1="2" x2="22" y2="22" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <Card><p className="text-sm text-ink-dim">No exercises match those filters.</p></Card>
          )}
        </div>
      </div>

      {/* ----- Manage sheet ----- */}
      {manageEx && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={() => setManageId(null)}>
          <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-ink-line flex items-center gap-2">
              <MuscleBadge muscle={manageEx.primaryMuscle} />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{manageEx.name}</div>
                <div className="text-xs text-ink-dim capitalize">
                  {manageEx.equipment}{manageEx.isCustom ? ' · custom' : ''}
                </div>
              </div>
              <button type="button" onClick={() => setManageId(null)} className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink" aria-label="Close">✕</button>
            </div>
            <div className="px-4 py-3 space-y-2 pb-8">
              <Button block variant="ghost" onClick={() => onToggleFavorite(manageEx.id)}>
                {isFavorite(prefs, manageEx.id) ? '★ Remove from favorites' : '☆ Add to favorites'}
              </Button>
              <Button block variant="ghost" onClick={() => onToggleHidden(manageEx.id)}>
                {isHidden(prefs, manageEx.id) ? 'Unhide exercise' : 'Hide exercise'}
              </Button>
              <Link href={`/history/exercise/${manageEx.id}`} className="block">
                <Button block variant="ghost">View history</Button>
              </Link>
              {manageEx.isCustom && (
                <>
                  <Button block variant="ghost" onClick={() => openEdit(manageEx)}>Edit exercise</Button>
                  <Button block variant="ghost" className="!text-danger" onClick={() => deleteExercise(manageEx.id)}>
                    Delete exercise
                  </Button>
                </>
              )}
              <p className="text-xs text-ink-mute text-center pt-1">
                Hidden exercises drop out of lists and won&apos;t be picked when generating programs.
                Favorites are surfaced first.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ----- Create / edit form ----- */}
      {formOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={closeForm}>
          <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-bg-card border-b border-ink-line px-4 py-3 flex items-center justify-between">
              <div className="section-head">{editingId ? 'EDIT EXERCISE' : 'NEW EXERCISE'}</div>
              <button type="button" onClick={closeForm} className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink" aria-label="Close">✕</button>
            </div>
            <div className="px-4 py-3 space-y-4">
              <TextField label="Name" placeholder="e.g. Cable Y-Raise" value={draft.name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
              <div>
                <div className="text-[10px] tracking-wider2 text-ink-mute uppercase mb-1.5">Primary muscle</div>
                <div className="flex gap-1.5 flex-wrap">
                  {MUSCLES.map((m) => (
                    <ChoicePill key={m} value={m} label={m} selected={draft.primaryMuscle === m} onSelect={() => setDraft((d) => ({ ...d, primaryMuscle: m }))} />
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] tracking-wider2 text-ink-mute uppercase mb-1.5">Equipment</div>
                <div className="flex gap-1.5 flex-wrap">
                  {EQUIPMENT.map((e) => (
                    <ChoicePill key={e} value={e} label={e} selected={draft.equipment === e} onSelect={() => setDraft((d) => ({ ...d, equipment: e }))} />
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] tracking-wider2 text-ink-mute uppercase mb-1.5">Secondary muscles <span className="text-ink-mute normal-case">(optional)</span></div>
                <div className="flex gap-1.5 flex-wrap">
                  {MUSCLES.filter((m) => m !== draft.primaryMuscle).map((m) => (
                    <ChoicePill
                      key={m}
                      value={m}
                      label={m}
                      selected={(draft.secondaryMuscles ?? []).includes(m)}
                      onSelect={() => setDraft((d) => ({ ...d, secondaryMuscles: toggleIn(d.secondaryMuscles, m) }))}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] tracking-wider2 text-ink-mute uppercase mb-1.5">Movement patterns <span className="text-ink-mute normal-case">(optional)</span></div>
                <div className="flex gap-1.5 flex-wrap">
                  {PATTERNS.map((p) => (
                    <ChoicePill
                      key={p}
                      value={p}
                      label={p}
                      selected={(draft.patterns ?? []).includes(p)}
                      onSelect={() => setDraft((d) => ({ ...d, patterns: toggleIn(d.patterns, p) }))}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1 pb-6">
                <Button variant="ghost" onClick={closeForm}>Cancel</Button>
                <div className="flex-1" />
                <Button onClick={saveExercise} disabled={!draft.name?.trim()}>
                  {editingId ? 'Save changes' : 'Create exercise'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
