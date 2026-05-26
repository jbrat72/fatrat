'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/ui/cn';

interface Tab {
  href: string;
  label: string;
  icon: (active: boolean) => JSX.Element;
}

const TABS: Tab[] = [
  {
    href: '/today',
    label: 'Today',
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={cn(active && 'text-accent')}>
        <rect x="4" y="5" width="16" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M4 11h16" />
      </svg>
    ),
  },
  {
    href: '/plan',
    label: 'Plan',
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={cn(active && 'text-accent')}>
        <path d="M4 19V5a1 1 0 0 1 1-1h11l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
        <path d="M16 4v4h4" />
      </svg>
    ),
  },
  {
    href: '/history',
    label: 'History',
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={cn(active && 'text-accent')}>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 5v4h4" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={cn(active && 'text-accent')}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname() ?? '';
  // Hide during active workout so the workout's own footer bar isn't covered.
  if (pathname.startsWith('/today/workout')) return null;
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-bg/95 backdrop-blur border-t border-ink-line">
      <ul className="mx-auto max-w-md grid grid-cols-4">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + '/');
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-semibold tracking-wider2 uppercase',
                  active ? 'text-accent' : 'text-ink-dim hover:text-ink',
                )}
              >
                {t.icon(active)}
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
