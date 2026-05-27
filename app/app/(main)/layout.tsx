import { AppShell } from '@/components/app';
import type { ReactNode } from 'react';

// UserProvider lives at the root layout so /login and /onboarding can
// read auth state too. (main) just renders the AppShell chrome.
export default function MainLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
