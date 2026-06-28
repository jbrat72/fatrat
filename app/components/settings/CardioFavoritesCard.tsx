'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/components/app';
import { Card, ChoicePill } from '@/components/ui';
import { getRepository } from '@/lib/firestore';
import { CARDIO_ACTIVITIES } from '@/lib/cardio/activities';
import type { CardioActivity } from '@/types';

/**
 * Collapsible "Cardio favorites" card for the Profile page. Favorites are the
 * activities surfaced first in the Log Cardio picker. Local state is the source
 * of truth once mounted (avoids races on rapid toggles) and persists in the
 * background; it re-seeds only when the active user changes.
 */
export function CardioFavoritesCard() {
  const { user, refresh } = useUser();
  const [open, setOpen] = useState(false);
  const [favs, setFavs] = useState<CardioActivity[]>([]);

  useEffect(() => {
    if (user) setFavs(user.cardioFavorites ?? []);
  }, [user?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const toggle = (a: CardioActivity) => {
    const next = favs.includes(a) ? favs.filter((x) => x !== a) : [...favs, a];
    setFavs(next);
    getRepository()
      .upsertProfile({ ...user, cardioFavorites: next, updatedAt: new Date().toISOString() })
      .then(() => refresh())
      .catch(() => { /* best-effort; local state already reflects the change */ });
  };

  return (
    <Card>
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-left">
        <span className="font-medium">Cardio favorites</span>
        <span className="text-ink-mute text-2xl leading-none transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
      </button>
      {open && (
        <div className="mt-3">
          <p className="text-xs text-ink-dim mb-3">Pick the activities you do most. When you log cardio, your favorites show first — tap &ldquo;Show all&rdquo; in the picker for the rest.</p>
          <div className="flex gap-1.5 flex-wrap">
            {CARDIO_ACTIVITIES.filter((a) => a.value !== 'other').map((a) => (
              <ChoicePill key={a.value} value={a.value} label={a.label} selected={favs.includes(a.value)} onSelect={() => toggle(a.value as CardioActivity)} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
