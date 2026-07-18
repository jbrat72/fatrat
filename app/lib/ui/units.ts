/**
 * Unit conversion helpers. The data layer always stores SI units (kg, km, km/h);
 * the UI shows imperial (lb, mi, mph) for imperial users.
 */
import type { Units } from '@/types';

/** Canonical lb↔kg factor — exported so nothing re-declares its own copy
 *  (nextSetNudge and wizard/persist had drifted to different precisions). */
export const LB_PER_KG = 2.20462;
const MI_PER_KM = 0.621371;

/* ---------- weight ---------- */
export function kgToDisplay(kg: number | undefined, units: Units): number | undefined {
  if (kg == null) return undefined;
  return units === 'imperial' ? +(kg * LB_PER_KG).toFixed(1) : +kg.toFixed(2);
}
export function displayToKg(value: number | undefined, units: Units): number | undefined {
  if (value == null) return undefined;
  return units === 'imperial' ? value / LB_PER_KG : value;
}
export function weightLabel(units: Units): 'lb' | 'kg' {
  return units === 'imperial' ? 'lb' : 'kg';
}

/* ---------- distance ---------- */
export function kmToDisplayDistance(km: number | undefined, units: Units): number | undefined {
  if (km == null) return undefined;
  return units === 'imperial' ? +(km * MI_PER_KM).toFixed(2) : +km.toFixed(2);
}
export function displayDistanceToKm(value: number | undefined, units: Units): number | undefined {
  if (value == null) return undefined;
  return units === 'imperial' ? value / MI_PER_KM : value;
}
export function distanceLabel(units: Units): 'mi' | 'km' {
  return units === 'imperial' ? 'mi' : 'km';
}

/* ---------- speed ---------- */
export function kphToDisplaySpeed(kph: number | undefined, units: Units): number | undefined {
  if (kph == null) return undefined;
  return units === 'imperial' ? +(kph * MI_PER_KM).toFixed(1) : +kph.toFixed(1);
}
export function displaySpeedToKph(value: number | undefined, units: Units): number | undefined {
  if (value == null) return undefined;
  return units === 'imperial' ? value / MI_PER_KM : value;
}
export function speedLabel(units: Units): 'mph' | 'km/h' {
  return units === 'imperial' ? 'mph' : 'km/h';
}

/* ---------- pace ---------- */
/** Format minutes per unit as mm:ss. */
export function formatPace(minPerUnit: number | undefined): string {
  if (minPerUnit == null || !isFinite(minPerUnit) || minPerUnit <= 0) return '—';
  const mm = Math.floor(minPerUnit);
  const ss = Math.round((minPerUnit - mm) * 60);
  return `${mm}:${String(ss).padStart(2, '0')}`;
}
export function paceLabel(units: Units): string {
  return units === 'imperial' ? 'min/mi' : 'min/km';
}

/* ---------- duration (mm:ss) ---------- */
/** Format decimal minutes as mm:ss (e.g. 40.5 → "40:30"). */
export function formatDuration(minutes: number | undefined): string {
  if (minutes == null || !isFinite(minutes) || minutes < 0) return '—';
  const total = Math.round(minutes * 60);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}
/** Parse "mm:ss" (or a bare minutes number) into decimal minutes. */
export function parseDurationToMinutes(str: string): number | undefined {
  const s = str.trim();
  if (!s) return undefined;
  if (s.includes(':')) {
    const [mPart, sPart = ''] = s.split(':');
    const mm = parseInt(mPart, 10);
    const ss = parseInt(sPart, 10);
    const m = isFinite(mm) ? mm : 0;
    const sec = isFinite(ss) ? ss : 0;
    return m + sec / 60;
  }
  const n = Number(s);
  return isFinite(n) ? n : undefined;
}
