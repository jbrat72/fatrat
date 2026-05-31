/**
 * Data export helpers — produce JSON and CSV from a user's full data.
 * Pure functions. The UI wraps them with Blob download.
 */
import type {
  UserProfile,
  Mesocycle,
  Microcycle,
  WorkoutSession,
  BodyWeightEntry,
} from '@/types';

export interface ExportBundle {
  profile: UserProfile;
  mesocycles: Mesocycle[];
  microcycles: Microcycle[];
  sessions: WorkoutSession[];
  bodyWeight: BodyWeightEntry[];
  exportedAt: string;
  appVersion: string;
}

export function toJSON(bundle: ExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/** A flat CSV of every logged set, one row per set, easy to load into a spreadsheet. */
export function setsCSV(bundle: ExportBundle): string {
  const rows: string[] = [
    'date,dayOfWeek,exerciseId,exerciseName,muscle,setIndex,weightKg,reps,rpe,completed,note',
  ];
  for (const s of bundle.sessions) {
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        rows.push([
          s.date,
          String(s.dayOfWeek),
          escape(ex.exerciseId),
          escape(ex.name),
          escape(ex.muscle),
          String(set.setIndex),
          set.weightKg ?? '',
          set.reps ?? '',
          set.rpe ?? '',
          set.completed ? '1' : '0',
          escape(set.note ?? ''),
        ].join(','));
      }
    }
  }
  return rows.join('\n');
}

function escape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
