'use client';

import { useState, useEffect } from 'react';
import type { SleeperLeague } from '@/types/sleeper';

export interface SessionUser {
  username: string;
  userId: string;
  displayName: string;
  avatar: string | null;
  leagueGroups: [string, SleeperLeague[]][];
}

const SESSION_KEY = 'recordbook-user';

export function useSessionUser(): SessionUser | null {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSessionUser(JSON.parse(stored));
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  return sessionUser;
}

export function saveSessionUser(user: SessionUser): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSessionUser(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
