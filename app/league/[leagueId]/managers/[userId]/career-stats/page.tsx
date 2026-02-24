'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useUserById, useUserLeaguesAllSeasons, useCrossLeagueStats } from '@/hooks/useLeagueData';
import { CrossLeagueStats } from '@/components/CrossLeagueStats';
import type { SleeperLeague } from '@/types/sleeper';

export default function ManagerCareerStatsPage() {
  const { leagueId, userId } = useParams<{ leagueId: string; userId: string }>();
  const router = useRouter();

  const { data: managerUser, isLoading: userLoading } = useUserById(userId);
  const leagues = useUserLeaguesAllSeasons(managerUser?.user_id);

  const grouped = leagues.data?.reduce<Record<string, SleeperLeague[]>>((acc, league) => {
    (acc[league.name] ??= []).push(league);
    return acc;
  }, {}) ?? {};

  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) => {
    const maxA = Math.max(...a.map((l) => Number(l.season)));
    const maxB = Math.max(...b.map((l) => Number(l.season)));
    return maxB - maxA;
  });

  const rootLeagueIds = useMemo(
    () => sortedGroups.map(([, group]) => {
      const sorted = [...group].sort((a, b) => Number(b.season) - Number(a.season));
      return sorted[0].league_id;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leagues.data],
  );

  const crossStats = useCrossLeagueStats(
    leagues.isLoading ? undefined : managerUser?.user_id,
    rootLeagueIds,
  );

  const displayName = managerUser?.display_name ?? managerUser?.username ?? '';

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-brand-cyan">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push(`/league/${leagueId}/managers/${userId}`)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ChevronLeft size={16} />
        Back to {displayName || 'Manager'}
      </button>

      <div>
        <h2 className="text-xl font-bold text-white">
          {displayName ? `${displayName} Career Stats` : 'Career Stats'}
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">Stats across all leagues</p>
      </div>

      <CrossLeagueStats
        stats={crossStats.data}
        isLoading={crossStats.isLoading || leagues.isLoading}
        leagueCount={sortedGroups.length}
        displayName={displayName || undefined}
      />
    </div>
  );
}
