'use client';
/**
 * Shared visual atoms for the two wizards (PlanWizardV2 and
 * SingleWorkoutWizard) so they read as one product: step eyebrow, section
 * heads, selectable cards, chips, notes and badges. Pure presentation — no
 * state, no data access.
 */
import type { ReactNode, MouseEvent } from 'react';

export function Eyebrow({ n, title, sub, tag }: { n: number; title: string; sub?: ReactNode; tag?: string }) {
  return (
    <div className="mb-2">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-accent">Step {n}{tag ? <span className="text-ink-mute"> · {tag}</span> : null}</div>
      <h1 className="text-2xl font-bold tracking-tight mt-1.5 mb-1">{title}</h1>
      {sub && <div className="text-[14px] text-ink-dim">{sub}</div>}
    </div>
  );
}

export function Field({ k, v }: { k: string; v: ReactNode }) {
  return <div><span className="block text-[11px] uppercase tracking-wide text-ink-mute">{k}</span>{v}</div>;
}

/** Section heading. Carries the `wz-sec` class the plan wizard's
 *  scroll-to-next-section logic anchors on. */
export function SecHead({ children }: { children: ReactNode }) {
  return <div className="wz-sec text-[11px] font-semibold uppercase tracking-wider text-ink-dim mt-5 mb-2.5">{children}</div>;
}

export function note(type: 'info' | 'warn' | 'ok', txt: ReactNode): ReactNode {
  const cls = type === 'warn' ? 'border-warn/40 bg-warn/10' : type === 'ok' ? 'border-ok/30 bg-ok/10' : 'border-info/30 bg-info/10';
  const ic = type === 'warn' ? '⚠' : type === 'ok' ? '✓' : 'ℹ';
  return <div className={`flex gap-2.5 rounded-xl border ${cls} px-3.5 py-3 text-[13px] my-3`}><span className="shrink-0">{ic}</span><span>{txt}</span></div>;
}

/** Full-width selectable card with a check bubble. */
export function cardChoice(sel: boolean, onClick: (e: MouseEvent<HTMLButtonElement>) => void, label: ReactNode, desc?: ReactNode, extra?: ReactNode): ReactNode {
  return (
    <button type="button" onClick={onClick} className={`relative w-full text-left rounded-2xl border p-4 transition ${sel ? '!border-accent !bg-accent/10' : 'border-ink-line bg-bg-card hover:border-ink-mute'}`}>
      <span className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${sel ? 'bg-accent border-accent text-white' : 'border-ink-line'}`}>{sel ? '✓' : ''}</span>
      <div className="font-semibold text-[15px] pr-7 flex items-center gap-2 flex-wrap">{label}</div>
      {desc && <div className="text-[13px] text-ink-dim mt-1">{desc}</div>}
      {extra}
    </button>
  );
}

/** Pill toggle. */
export function chip(sel: boolean, label: ReactNode, onClick: (e: MouseEvent<HTMLButtonElement>) => void, key?: string | number, disabled?: boolean): ReactNode {
  return (
    <button key={key} type="button" disabled={disabled} onClick={onClick} className={`rounded-full border px-3.5 py-2 text-[13px] font-medium transition disabled:opacity-30 ${sel ? 'border-accent bg-accent/15 text-ink' : 'border-ink-line bg-bg-card text-ink-dim hover:text-ink'}`}>{label}</button>
  );
}

export function badge(kind: 'rec' | 'fit' | 'lvl', txt: string): ReactNode {
  const c = kind === 'rec' ? 'bg-accent/15 text-accent-hot' : kind === 'fit' ? 'bg-ok/15 text-ok' : 'bg-info/15 text-info';
  return <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${c}`}>{txt}</span>;
}
