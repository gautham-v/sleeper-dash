'use client';
import { useMemo } from 'react';
import { useFranchiseOutlook } from './useFranchiseOutlook';
import { useManagerRosterStats } from './useManagerRosterStats';
import { useLeague } from './useLeagueData';
import { computePlayerRecommendations } from '../utils/playerRecommendations';
import { extractLeagueFormat } from '../utils/leagueFormat';
import type { RosterRecommendations } from '../types/recommendations';

interface UsePlayerRecommendationsResult {
  data: RosterRecommendations | null;
  isLoading: boolean;
  isError: boolean;
}

export function usePlayerRecommendations(
  leagueId: string | null,
  userId: string | null,
): UsePlayerRecommendationsResult {
  const franchiseOutlook = useFranchiseOutlook(leagueId);
  const league = useLeague(leagueId);
  const rosterStats = useManagerRosterStats(leagueId ?? '', userId ?? '');

  const data = useMemo(() => {
    if (!franchiseOutlook.data || !league.data || !rosterStats.data || !userId) {
      return null;
    }

    const { outlookMap, rawContext } = franchiseOutlook.data;
    const outlook = outlookMap.get(userId);
    if (!outlook) return null;

    // Find the user's roster
    const roster = rawContext.allRosters.find((r) => r.owner_id === userId);
    if (!roster) return null;

    const leagueFormat = extractLeagueFormat(league.data);

    return computePlayerRecommendations(
      userId,
      outlook,
      rawContext,
      rosterStats.data.players,
      leagueFormat,
      roster,
    );
  }, [franchiseOutlook.data, league.data, rosterStats.data, userId]);

  return {
    data,
    isLoading: franchiseOutlook.isLoading || league.isLoading || rosterStats.isLoading,
    isError: franchiseOutlook.isError || league.isError || rosterStats.isError,
  };
}
