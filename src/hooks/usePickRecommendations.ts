'use client';
import { useMemo } from 'react';
import { useFranchiseOutlook } from './useFranchiseOutlook';
import { useLeague } from './useLeagueData';
import { computePickRecommendations } from '../utils/pickRecommendations';
import { extractLeagueFormat } from '../utils/leagueFormat';
import type { PickRecommendation } from '../types/recommendations';

interface UsePickRecommendationsResult {
  data: PickRecommendation[] | null;
  isLoading: boolean;
  isError: boolean;
}

export function usePickRecommendations(
  leagueId: string | null,
  userId: string | null,
): UsePickRecommendationsResult {
  const franchiseOutlook = useFranchiseOutlook(leagueId);
  const league = useLeague(leagueId);

  const data = useMemo(() => {
    if (!franchiseOutlook.data || !league.data || !userId) return null;

    const { outlookMap, rawContext } = franchiseOutlook.data;
    const outlook = outlookMap.get(userId);
    if (!outlook) return null;

    const roster = rawContext.allRosters.find(r => r.owner_id === userId);
    if (!roster) return null;

    const picks = rawContext.picksByRosterId.get(roster.roster_id) ?? [];
    if (picks.length === 0) return [];

    const leagueFormat = extractLeagueFormat(league.data);

    return computePickRecommendations('', picks, outlook, rawContext, leagueFormat);
  }, [franchiseOutlook.data, league.data, userId]);

  return {
    data,
    isLoading: franchiseOutlook.isLoading || league.isLoading,
    isError: franchiseOutlook.isError || league.isError,
  };
}
