'use client';
import { BottomNav } from './BottomNav';
import { DemoUserPicker } from './DemoUserPicker';
import { ThemeToggle } from './ThemeToggle';
import { APP_VERSION } from '@/lib/version';
import type { ReactNode } from 'react';

/**
 * Wraps every authenticated route. Provides the top bar (logo + theme toggle +
 * demo-user picker) and the bottom nav, with a content area that has room for both.
 */
export function AppShell({ children }: { children: ReactNode }) {
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
            <DemoUserPicker />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
