'use client';
import Link from 'next/link';
import { useUser } from '@/components/app';
import { PageTitle, Card, BackButton } from '@/components/ui';

/**
 * Landing page — pick whether you're browsing/creating a Program (multi-week
 * plan) or a Single Workout (one-shot routine). Each card routes to a focused
 * sub-page that handles its own list + create flow.
 */
export default function TemplatesLandingPage() {
  const { user } = useUser();
  if (!user) return null;

  return (
    <div>
      <div className="px-4 pt-4"><BackButton href="/plan" label="Plan" /></div>
      <PageTitle title="Templates" subtitle="What are you setting up?" />
      <div className="px-4 space-y-3">
        <Link href="/plan/templates/programs" className="block">
          <Card className="hover:!border-accent transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="section-head text-accent">PROGRAM</div>
                <div className="font-semibold text-base mt-1">Multi-week plan</div>
                <p className="text-sm text-ink-dim mt-1">
                  A structured training block — multiple weeks, periodization, set
                  styles, progression. Becomes your active program when you start it.
                </p>
              </div>
              <span className="text-ink-mute text-xl shrink-0">›</span>
            </div>
          </Card>
        </Link>

        <Link href="/plan/templates/workouts" className="block">
          <Card className="hover:!border-accent transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="section-head text-accent">SINGLE WORKOUT</div>
                <div className="font-semibold text-base mt-1">One-shot routine</div>
                <p className="text-sm text-ink-dim mt-1">
                  A saved workout you can run on any day. Shows up in your Ad-Hoc
                  Workout picker on Today.
                </p>
              </div>
              <span className="text-ink-mute text-xl shrink-0">›</span>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
