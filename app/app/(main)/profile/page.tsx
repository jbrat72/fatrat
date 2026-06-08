'use client';
import Link from 'next/link';
import { PageTitle, Card, Button } from '@/components/ui';
import { useUser } from '@/components/app';
import { EquipmentManager, ProfileInfoCard } from '@/components/settings';

export default function ProfilePage() {
  const { user } = useUser();
  if (!user) return null;

  return (
    <div>
      <PageTitle title="Profile" />
      <div className="px-4 space-y-3">
        <ProfileInfoCard />

        <EquipmentManager />

        <Link href="/exercises" className="block">
          <Card className="hover:border-ink-dim transition-colors">
            <div className="flex items-center justify-between">
              <span className="font-medium">Exercise library</span>
              <span className="text-ink-mute text-xl">›</span>
            </div>
          </Card>
        </Link>

        <Card>
          <div className="section-head mb-2">SETTINGS</div>
          <div className="flex flex-col gap-2">
            <Link href="/settings"><Button block variant="ghost">Settings & data</Button></Link>
            <Link href="/onboarding"><Button block variant="ghost">Replay onboarding</Button></Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
