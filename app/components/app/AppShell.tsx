'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BottomNav } from './BottomNav';
import { DemoUserPicker } from './DemoUserPicker';
import { ThemeToggle } from './ThemeToggle';
import { UpdateChecker } from './UpdateChecker';
import { useUser } from './UserProvider';
import { isFirebaseEnabled } from '@/lib/firebase/client';
import { APP_VERSION } from '@/lib/version';
import type { ReactNode } from 'react';

/**
 * Wraps every authenticated route. Provides the top bar (logo + theme toggle +
 * demo-user picker or sign-out) and the bottom nav.
 *
 * In Firebase mode the DemoUserPicker is replaced with a sign-out button, and
 * the shell redirects unauthenticated visitors to /login. Visitors who are
 * signed in but haven't completed onboarding go to /onboarding.
 *
 * Also mounts UpdateChecker — polls /api/version and shows a toast when a
 * newer deployment is live.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { firebaseUser, user, loading, signOut } = useUser();
  const firebase = isFirebaseEnabled();

  // Auth gate — only meaningful when Firebase is wired up.
  useEffect(() => {
    if (!firebase) return;
    if (loading) return;
    if (!firebaseUser) {
      router.replace('/login');
      return;
    }
    // Signed in but no profile yet — send them to finish setup.
    if (!user && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
  }, [firebase, loading, firebaseUser, user, pathname, router]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  // In Firebase mode, don't flash protected content before the redirect resolves.
  if (firebase && (loading || !firebaseUser)) {
    return <div className="min-h-screen bg-bg" />;
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-ink-line">
        <div className="mx-auto max-w-md flex items-center justify-between px-4 h-12">
          <div className="flex flex-col leading-none">
            <div className="font-semibold tracking-widest2 text-base">
              FAT<span className="text-accent">RAT</span>
            </div>
            <div className="font-mono text-[10px] text-ink-mute mt-0.5">v{APP_VERSION}</div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {firebase ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="h-8 px-2.5 rounded-md border border-ink-line text-ink-dim hover:text-ink text-xs font-medium"
                aria-label="Sign out"
              >
                Sign out
              </button>
            ) : (
              <DemoUserPicker />
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md pb-24">{children}</main>
      <BottomNav />
      <UpdateChecker />
    </div>
  );
}
