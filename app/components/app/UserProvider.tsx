'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getRepository } from '@/lib/firestore';
import type { UserProfile } from '@/types';
import { DEMO_USER_IDS } from '@/lib/firestore/seed/users';

const ACTIVE_USER_KEY = 'fatrat:activeUser:v1';

interface UserContextValue {
  user: UserProfile | null;
  loading: boolean;
  setActiveUserId: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

function defaultUserId(): string {
  if (typeof window === 'undefined') return DEMO_USER_IDS.BRIAN;
  return window.localStorage.getItem(ACTIVE_USER_KEY) ?? DEMO_USER_IDS.BRIAN;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveIdState] = useState<string>(() => defaultUserId());

  const load = async (id: string) => {
    setLoading(true);
    const repo = getRepository();
    const profile = await repo.getProfile(id);
    setUser(profile);
    setLoading(false);
  };

  useEffect(() => { load(activeId); }, [activeId]);

  const setActiveUserId = async (id: string) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(ACTIVE_USER_KEY, id);
    setActiveIdState(id);
  };

  const refresh = async () => { await load(activeId); };

  return (
    <UserContext.Provider value={{ user, loading, setActiveUserId, refresh }}>
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
