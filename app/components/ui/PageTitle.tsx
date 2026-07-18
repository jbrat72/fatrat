import type { ReactNode } from 'react';

interface PageTitleProps {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}

/** Standard page heading. (Previously lived in SectionHeader.tsx next to an
 *  unused SectionHeader component — file renamed for its real export.) */
export function PageTitle({ title, subtitle, trailing }: PageTitleProps) {
  return (
    <div className="flex items-end justify-between px-4 pt-6 pb-3">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-ink-dim text-sm mt-1">{subtitle}</p> : null}
      </div>
      {trailing}
    </div>
  );
}
