'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef } from 'react';

const SESSION_KEY = 'recordbook-user';

function getReturnUrl(): string {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      const user = JSON.parse(stored);
      const groups: [string, { league_id: string; season: string }[]][] = user.leagueGroups ?? [];
      // Find most recent league across all groups
      let best: { league_id: string; season: string } | null = null;
      for (const [, leagues] of groups) {
        for (const l of leagues) {
          if (!best || Number(l.season) > Number(best.season)) best = l;
        }
      }
      if (best) return `/league/${best.league_id}/overview`;
    }
  } catch {
    // ignore
  }
  return '/';
}

export function BackLink() {
  const router = useRouter();
  const hasHistory = useRef(false);

  useEffect(() => {
    // history.length > 2 means there's a real page to go back to
    // (1 = typed URL directly, 2 = navigated from one page)
    hasHistory.current = window.history.length > 2;
  }, []);

  const handleClick = () => {
    if (hasHistory.current) {
      router.back();
    } else {
      router.push(getReturnUrl());
    }
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
    >
      <ChevronLeft size={15} />
      leaguemate.fyi
    </button>
  );
}
