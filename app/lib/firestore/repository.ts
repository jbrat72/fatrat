/**
 * DataRepository — the only interface the UI ever talks to for persistence.
 *
 * The mock implementation (./mock.ts) is in-memory + localStorage-backed.
 * The Firebase implementation (./firestoreRepository.ts) satisfies the same
 * interface.
 *
 * Keep this file free of Firestore imports so /lib/firestore can be swapped wholesale.
 */
import type {
  UserProfile,
  BodyWeightEntry,
  Mesocycle,
  Microcycle,
  WorkoutSession,
  ExerciseDefinition,
  UserExercisePrefs,
  ProgramTemplate,
} from '@/types';

export interface DataRepository {
  /* ---------- Profile ---------- */
  getProfile(userId: string): Promise<UserProfile | null>;
  upsertProfile(profile: UserProfile): Promise<UserProfile>;
  listUsers(): Promise<UserProfile[]>;

  /* ---------- Body weight ---------- */
  listBodyWeight(userId: string): Promise<BodyWeightEntry[]>;
  addBodyWeight(userId: string, entry: BodyWeightEntry): Promise<void>;

  /* ---------- Plans (Mesocycle) / Microcycles ---------- */
  /** All training plans (mesos) the user has ever created. */
  listMesocycles(userId: string): Promise<Mesocycle[]>;
  /** The user's currently-active training plan, or null. */
  getActivePlan(userId: string): Promise<Mesocycle | null>;
  getMesocycle(mesoId: string): Promise<Mesocycle | null>;
  upsertMesocycle(m: Mesocycle): Promise<Mesocycle>;

  listMicrocycles(mesoId: string): Promise<Microcycle[]>;
  getMicrocycle(microId: string): Promise<Microcycle | null>;
  upsertMicrocycle(m: Microcycle): Promise<Microcycle>;

  /* ---------- Sessions ---------- */
  listSessions(userId: string, opts?: { limit?: number }): Promise<WorkoutSession[]>;
  /** Every session whose `date` matches `isoDate` for the given user. */
  listSessionsOnDate(userId: string, isoDate: string): Promise<WorkoutSession[]>;
  listSessionsInMicrocycle(microId: string): Promise<WorkoutSession[]>;
  getSession(sessionId: string): Promise<WorkoutSession | null>;
  upsertSession(s: WorkoutSession): Promise<WorkoutSession>;
  /** Hard-delete a session (used when cancelling a plan to clear pending sessions). */
  deleteSession(sessionId: string): Promise<void>;
  /** Convenience: today's session for the active microcycle, or null. */
  getTodaySession(userId: string, isoDate: string): Promise<WorkoutSession | null>;

  /* ---------- Exercise library ---------- */
  listGlobalExercises(): Promise<ExerciseDefinition[]>;
  listUserExercises(userId: string): Promise<ExerciseDefinition[]>;
  upsertUserExercise(userId: string, e: ExerciseDefinition): Promise<ExerciseDefinition>;
  /** Remove a user-created custom exercise. */
  deleteUserExercise(userId: string, exerciseId: string): Promise<void>;
  /** Per-user favorites + hidden over the exercise library. */
  getExercisePrefs(userId: string): Promise<UserExercisePrefs>;
  upsertExercisePrefs(userId: string, prefs: UserExercisePrefs): Promise<UserExercisePrefs>;

  /* ---------- Templates ---------- */
  listTemplates(): Promise<ProgramTemplate[]>;
  getTemplate(id: string): Promise<ProgramTemplate | null>;
  /** Save a custom template (created by the Template Wizard). */
  upsertTemplate(t: ProgramTemplate): Promise<ProgramTemplate>;
  deleteTemplate(id: string): Promise<void>;
}
