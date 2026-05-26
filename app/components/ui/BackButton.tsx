'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/ui/cn';

interface Props {
  /** If provided, navigates to this href. Otherwise uses router.back(). */
  href?: string;
  label?: string;
  className?: string;
}

/** Compact back-arrow header chip. Render at the top of a drill-in page. */
export function BackButton({ href, label, className }: Props) {
  const router = useRouter();

  const inner = (
    <span className={cn(
      'inline-flex items-center gap-1.5 h-9 pl-2 pr-3 rounded-lg',
      'border border-ink-line text-ink-dim hover:text-ink hover:bg-bg-card',
      'transition text-sm font-medium',
      className,
    )}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label && <span>{label}</span>}
    </span>
  );

  if (href) return <Link href={href} aria-label={label ?? 'Back'}>{inner}</Link>;
  return (
    <button type="button" onClick={() => router.back()} aria-label={label ?? 'Back'}>
      {inner}
    </button>
  );
}
