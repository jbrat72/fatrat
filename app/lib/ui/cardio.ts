/**
 * Shared formatter for a cardio entry's stat line — unit-aware (miles/mph for
 * imperial, km/kph for metric) and treadmill-aware (time · incline · speed),
 * with duration as mm:ss. Returns the stats joined by " · " (no activity name).
 */
import type { CardioEntry, Units } from '@/types';
import { formatDuration, kmToDisplayDistance, distanceLabel, kphToDisplaySpeed, speedLabel } from './units';

export function cardioStats(c: CardioEntry, units: Units): string {
  const parts: string[] = [formatDuration(c.durationMin)];
  if (c.activityType === 'treadmill') {
    if (c.inclinePct != null) parts.push(`${c.inclinePct}% incline`);
    const sp = kphToDisplaySpeed(c.speedKph, units);
    if (sp != null) parts.push(`${sp.toFixed(1)} ${speedLabel(units)}`);
  } else {
    const d = kmToDisplayDistance(c.distanceKm, units);
    if (d != null) parts.push(`${d.toFixed(2)} ${distanceLabel(units)}`);
    if (c.resistanceLevel != null) parts.push(`L${c.resistanceLevel}`);
  }
  if (c.avgHR != null) parts.push(`${c.avgHR} bpm`);
  return parts.join(' · ');
}
