'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import { getRepository } from '@/lib/firestore';
import { getFirebaseAuth, isFirebaseEnabled } from '@/lib/firebase/client';
import type { UserProfile } from '@/types';
import { DEMO_USER_IDS } from '@/lib/firestore/seed/users';
import { migrateMacrocyclesForUser } from '@/lib/firestore/migrations/dropMacrocycle';
import { migrateSessionsToDaysForUser } from '@/lib/firestore/migrations/relabelSessionsToDays';
import { migrateFixedExercises } from '@/lib/firestore/migrations/fixedExercises';
import { migrateWeekStatusRepair } from '@/lib/firestore/migrations/repairWeekStatus';
import { migrateDedupeExerciseNames } from '@/lib/firestore/migrations/dedupeExerciseNames';

const ACTIVE_USER_KEY = 'fatrat:activeUser:v1';

interface UserContextValue {
  user: UserProfile | null;
  loading: boolean;
  /** Set when the profile load (or a migration) threw — AppShell shows a retry
   *  screen instead of blanking forever or bouncing to /onboarding (which
   *  could re-onboard an existing user over their data). */
  loadError: string | null;
  /** The Firebase auth user when Firebase is enabled; null in mock mode or signed out. */
  firebaseUser: FirebaseUser | null;
  setActiveUserId: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

function defaultUserId(): string {
  if (typeof window === 'undefined') return DEMO_USER_IDS.BRIAN;
  return window.localStorage.getItem(ACTIVE_USER_KEY) ?? DEMO_USER_IDS.BRIAN;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  // Only used in mock mode (no Firebase env config).
  const [activeId, setActiveIdState] = useState<string>(() => defaultUserId());

  // `silent` reloads the profile without flipping the global loading flag —
  // AppShell blanks the whole app while loading, which would unmount the
  // current page (losing scroll position and local UI state). Background
  // refreshes after an edit must stay silent.
  const load = async (id: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const repo = getRepository();
      let profile = await repo.getProfile(id);
      // One-shot v0.61 migration — drop Macrocycle for real Firestore users.
      // Mock mode does not need it (seed key bump re-seeds).
      if (profile && isFirebaseEnabled() && !profile.migratedMacroDrop) {
        profile = await migrateMacrocyclesForUser(profile);
      }
      // One-shot v0.62 migration — copy sessions/* to days/* with planName denorm.
      if (profile && isFirebaseEnabled() && !profile.migratedSessionsToDays) {
        profile = await migrateSessionsToDaysForUser(profile);
      }
      // One-shot — default existing plans to fixed exercises (mock + Firebase).
      if (profile && !profile.migratedFixedExercises) {
        profile = await migrateFixedExercises(profile);
      }
      // One-shot — repair week statuses / weekIndex broken by the unsorted-
      // microcycle advance bug (mock + Firebase).
      if (profile && !profile.migratedWeekStatusRepair) {
        profile = await migrateWeekStatusRepair(profile);
      }
      // One-shot — merge duplicate exercise names to a single canonical exercise.
      if (profile && !profile.migratedDedupeExercisesV2) {
        profile = await migrateDedupeExerciseNames(profile);
      }
      setUser(profile);
      setLoadError(null);
    } catch (e) {
      // Without this path a transient read error left loading=true forever
      // (AppShell blanks the app) — and a null user would have bounced an
      // EXISTING account to /onboarding.
      console.warn('profile load failed', e);
      setLoadError(e instanceof Error ? e.message : 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFirebaseEnabled()) {
      const auth = getFirebaseAuth();
      if (!auth) { setLoading(false); return; }
      const unsub = onAuthStateChanged(auth, async (fbUser) => {
        setFirebaseUser(fbUser);
        if (fbUser) {
          await load(fbUser.uid);
        } else {
          setUser(null);
          setLoading(false);
        }
      });
      return () => unsub();
    }
    // Mock mode — load by the active demo user id.
    load(activeId);
  }, [activeId]);

  const setActiveUserId = async (id: string) => {
    if (isFirebaseEnabled()) return; // DemoUserPicker is hidden in Firebase mode
    if (typeof window !== 'undefined') window.localStorage.setItem(ACTIVE_USER_KEY, id);
    setActiveIdState(id);
  };

  const refresh = async () => {
    if (isFirebaseEnabled()) {
      if (firebaseUser) await load(firebaseUser.uid, { silent: true });
    } else {
      await load(activeId, { silent: true });
    }
  };

  const signOut = async () => {
    if (isFirebaseEnabled()) {
      const auth = getFirebaseAuth();
      if (auth) await firebaseSignOut(auth);
    } else {
      setUser(null);
    }
  };

  return (
    <UserContext.Provider value={{ user, loading, loadError, firebaseUser, setActiveUserId, refresh, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside <UserProvider>');
  return ctx;
}

/** Helper: returns the current profile or throws — for callers that require one. */
export function useRequiredUser(): UserProfile {
  const { user } = useUser();
  if (!user) throw new Error('No active user');
  return user;
}
