'use client';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, MuscleBadge } from '@/components/ui';
import { adjustFromSoreness } from '@/lib/periodization';
import type { MuscleGroup, SorenessRating, MuscleTier } from '@/types';

/** What the user chose to do about the soreness reading.
 *  Canonical definition lives with the transform in lib/workout/sessionOps;
 *  re-exported here for existing importers. */
import type { SorenessAction } from '@/lib/workout/sessionOps';
export type { SorenessAction };

interface Props {
  open: boolean;
  muscle: MuscleGroup | null;
  /** Volume priority of this muscle in the active program — drives the
   *  recovered-easily suggestion (emphasize +2, grow +1, maintain holds). */
  tier: MuscleTier;
  onResolve: (rating: SorenessRating, action: SorenessAction, sets: number) => void;
  onSkip: () => void;
}

const CATEGORIES: { rating: SorenessRating; label: string; hint: string }[] = [
  { rating: 1, label: 'Never got sore', hint: 'Recovered easily — likely room for more volume.' },
  { rating: 2, label: 'Healed a while ago', hint: 'Recovered well before today.' },
  { rating: 3, label: 'Healed just on time', hint: 'The sweet spot for a muscle you are growing.' },
  { rating: 4, label: "I'm still sore", hint: 'Too much — time to ease the volume back.' },
];

function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={onClose}>
      <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Header({ muscle, title, onClose }: { muscle: MuscleGroup; title: string; onClose: () => void }) {
  return (
    <div className="px-4 py-3 border-b border-ink-line flex items-center justify-between">
      <div className="flex items-center gap-2">
        <MuscleBadge muscle={muscle} />
        <div className="section-head">{title}</div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Pre-session recovery check (template_notes Page 2). Shown when the user
 * reaches the first exercise for a muscle trained in an earlier session.
 * The volume offer is tier-aware: "never got sore" adds two sets on an
 * emphasized muscle, one on a grow muscle, and nothing on a maintain muscle
 * (which closes silently like the healthy ratings). "Still sore" always
 * offers to ease a set back or skip the muscle for today.
 */
export function SorenessCheckIn({ open, muscle, tier, onResolve, onSkip }: Props) {
  const [picked, setPicked] = useState<SorenessRating | null>(null);
  if (!open || !muscle) return null;

  const pickCategory = (r: SorenessRating) => {
    const sug = adjustFromSoreness(r, tier);
    // Nothing to decide (healed on time, or recovered easily on a maintain
    // muscle) — record the reading and move on, no follow-up sheet.
    if (sug.action === 'hold') { onResolve(r, 'none', 0); return; }
    setPicked(r);
  };

  if (picked === 1) {
    const sug = adjustFromSoreness(1, tier);
    const n = sug.setsDelta;
    return (
      <Sheet onClose={onSkip}>
        <Header muscle={muscle} title="RECOVERED EASILY" onClose={onSkip} />
        <div className="px-4 py-4 space-y-2 pb-8">
          <p className="text-sm text-ink-dim">
            Your <span className="text-ink font-medium capitalize">{muscle}</span> never got sore — {sug.note.toLowerCase()}
          </p>
          <Button block size="lg" onClick={() => onResolve(1, 'add', n)}>
            Add {n === 1 ? 'a set' : `${n} sets`} this week
          </Button>
          <Button block variant="ghost" size="lg" onClick={() => onResolve(1, 'none', 0)}>Keep as planned</Button>
        </div>
      </Sheet>
    );
  }

  if (picked === 4) {
    return (
      <Sheet onClose={onSkip}>
        <Header muscle={muscle} title="STILL SORE" onClose={onSkip} />
        <div className="px-4 py-4 space-y-2 pb-8">
          <p className="text-sm text-ink-dim">
            Your <span className="text-ink font-medium capitalize">{muscle}</span> is still sore. Ease the
            volume back this week, or skip it today to recover.
          </p>
          <Button block size="lg" onClick={() => onResolve(4, 'reduce', 1)}>Drop a set this week</Button>
          <Button block variant="ghost" size="lg" onClick={() => onResolve(4, 'skip', 0)}>
            Skip <span className="capitalize">{muscle}</span> today
          </Button>
          <Button block variant="ghost" size="lg" onClick={() => onResolve(4, 'none', 0)}>Keep as planned</Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onSkip}>
      <Header muscle={muscle} title="SORENESS CHECK" onClose={onSkip} />
      <div className="px-4 py-4 space-y-3 pb-8">
        <p className="text-sm text-ink-dim">
          How sore did your <span className="text-ink font-medium capitalize">{muscle}</span> get after
          your last session that trained it?
        </p>
        <div className="space-y-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.rating}
              type="button"
              onClick={() => pickCategory(c.rating)}
              className="w-full text-left card p-3 hover:border-accent transition"
            >
              <div className="font-medium text-sm">{c.label}</div>
              <div className="text-xs text-ink-dim mt-0.5">{c.hint}</div>
            </button>
          ))}
        </div>
        <Button block variant="ghost" onClick={onSkip}>Skip</Button>
      </div>
    </Sheet>
  );
}
