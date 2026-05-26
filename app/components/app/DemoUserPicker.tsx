'use client';
import { useEffect, useState } from 'react';
import { getRepository } from '@/lib/firestore';
import type { UserProfile } from '@/types';
import { useUser } from './UserProvider';
import { ModeChip } from '@/components/ui';

/**
 * Dev-only widget: a tiny dropdown in the top-right that swaps between the
 * seeded demo users. Disappears once real auth is wired in.
 */
export function DemoUserPicker() {
  const { user, setActiveUserId } = useUser();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { getRepository().listUsers().then(setUsers); }, []);

  // Skeleton placeholder until client mount to avoid SSR/CSR text mismatch.
  if (!mounted) {
    return <div className="h-9 w-32 rounded-lg border border-ink-line" />;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg bg-bg-card border border-ink-line px-3 h-9 text-sm"
      >
        <span className="w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center font-semibold">
          {user?.displayName?.[0] ?? '?'}
        </span>
        <span className="font-semibold">{user?.displayName ?? '—'}</span>
        {user && <ModeChip mode={user.mode} />}
        <span className="text-ink-mute">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 card p-2 z-30">
          <div className="section-head px-2 pb-1">Demo users</div>
          {users.map((u) => (
            <button
              key={u.userId}
              type="button"
              onClick={() => { setActiveUserId(u.userId); setOpen(false); }}
              className="w-full text-left rounded-lg p-2 hover:bg-bg-elev flex items-center justify-between"
            >
              <div>
                <div className="font-semibold text-ink">{u.displayName}</div>
                <div className="text-xs text-ink-dim">{u.primaryGoal.replace('-', ' ')}</div>
              </div>
              <ModeChip mode={u.mode} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
