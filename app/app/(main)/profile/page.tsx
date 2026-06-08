'use client';
import Link from 'next/link';
import { PageTitle, Card, ModeChip, Button } from '@/components/ui';
import { useUser } from '@/components/app';
import { EquipmentManager } from '@/components/settings';

export default function ProfilePage() {
  const { user } = useUser();
  if (!user) return null;

  return (
    <div>
      <PageTitle title="Profile" />
      <div className="px-4 space-y-3">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-semibold">{user.displayName}</div>
              <div className="text-ink-dim text-sm capitalize">
                {user.primaryGoal.replace('-', ' ')} · {user.daysPerWeek}d/wk
              </div>
            </div>
            <ModeChip mode={user.mode} />
          </div>
        </Card>

        <Card>
          <div className="section-head mb-2">OVERVIEW</div>
          <ul className="divide-y divide-ink-line">
            <li className="py-3 flex items-center justify-between"><span>Mode</span><ModeChip mode={user.mode} /></li>
            <li className="py-3 flex items-center justify-between"><span>Units</span><span className="text-ink-dim">{user.units}</span></li>
            <li className="py-3 flex items-center justify-between"><span>Days / week</span><span className="text-ink-dim">{user.daysPerWeek}</span></li>
            <li className="py-3 flex items-center justify-between"><span>Session length</span><span className="text-ink-dim">{user.timePerSessionMin} min</span></li>
            <li className="py-3 flex items-center justify-between"><span>Goal</span><span className="text-ink-dim capitalize">{user.primaryGoal.replace('-', ' ')}</span></li>
          </ul>
        </Card>

        <EquipmentManager />

        <Card>
          <div className="section-head mb-2">SETTINGS</div>
          <div className="flex flex-col gap-2">
            <Link href="/settings"><Button block variant="ghost">Settings & data</Button></Link>
            <Link href="/exercises"><Button block variant="ghost">Exercise library</Button></Link>
            <Link href="/onboarding"><Button block variant="ghost">Replay onboarding</Button></Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
