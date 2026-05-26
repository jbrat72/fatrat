'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/components/app';
import { Card } from '@/components/ui';
import { getRepository } from '@/lib/firestore';
import { streakStats, type StreakStats } from '@/lib/progress';

export function StreakCard() {
  const { user } = useUser();
  const [stats, setStats] = useState<StreakStats | null>(null);

  useEffect(() => {
    if (!user) return;
    getRepository().listSessions(user.userId, { limit: 200 }).then((sessions) => {
      const s = streakStats(sessions, user);
      setStats(s);
    });
  }, [user]);

  if (!user || !stats) return null;

  const { consecutiveWeeks, cardioMinutesThisWeek, liftingDaysThisWeek, thisWeek } = stats;
  const pct = thisWeek.planned > 0 ? Math.min(100, (liftingDaysThisWeek / thisWeek.planned) * 100) : 0;

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <div className="section-head">YOUR STREAK</div>
        {consecutiveWeeks > 0 && (
          <span className="text-[11px] font-semibold text-accent tracking-wider2">
            🔥 {consecutiveWeeks}-WEEK STREAK
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Streak" value={`${consecutiveWeeks}`} suffix={consecutiveWeeks === 1 ? 'wk' : 'wks'} />
        <Stat label="Lifting" value={`${liftingDaysThisWeek}`} suffix={liftingDaysThisWeek === 1 ? 'day' : 'days'} />
        <Stat label="Cardio" value={`${cardioMinutesThisWeek}`} suffix="min" />
      </div>
      <div className="mt-3 h-1.5 rounded bg-ink-line">
        <div className="h-1.5 rounded bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
    </Card>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <div className="text-[10px] tracking-wider2 text-ink-mute uppercase">{label}</div>
      <div className="mt-0.5 font-semibold numeric text-xl">
        {value}
        {suffix && <span className="text-ink-dim text-xs font-normal ml-1">{suffix}</span>}
      </div>
    </div>
  );
}
