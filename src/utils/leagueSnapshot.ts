import type { FranchiseOutlookRawContext, FranchiseOutlookResult } from '../types/sleeper';

export interface TeamStateSnapshot {
  userId: string;
  rosterId: number;
  teamName: string;
  displayName: string;
  war: number;
  warByPosition: { position: string; war: number; leagueAvgWAR: number; rank: number }[];
  tier: string;
  windowLength: number;
  strategyMode: string;
  positionalNeeds: string[];
  draftPicksOwned: { season: string; round: number; slot?: number }[];
}

export function buildTeamStatesFromContext(
  rawContext: FranchiseOutlookRawContext,
  outlookMap: Map<string, FranchiseOutlookResult>,
): TeamStateSnapshot[] {
  const teamStates: TeamStateSnapshot[] = [];

  for (const roster of rawContext.allRosters) {
    const userId = roster.owner_id;
    if (!userId) continue;

    const outlook = outlookMap.get(userId);
    if (!outlook) continue;

    const displayName = rawContext.userDisplayNames.get(userId) ?? userId;
    const teamName = displayName;

    const positionalNeeds = outlook.warByPosition
      .filter((entry) => entry.war < entry.leagueAvgWAR)
      .map((entry) => entry.position);

    const draftPicksOwned = (rawContext.picksByRosterId.get(roster.roster_id) ?? []).map((pick) => ({
      season: pick.season,
      round: pick.round,
      ...(pick.slot != null ? { slot: pick.slot } : {}),
    }));

    teamStates.push({
      userId,
      rosterId: roster.roster_id,
      teamName,
      displayName,
      war: outlook.currentWAR,
      warByPosition: outlook.warByPosition.map(({ position, war, leagueAvgWAR, rank }) => ({
        position,
        war,
        leagueAvgWAR,
        rank,
      })),
      tier: outlook.tier,
      windowLength: outlook.windowLength,
      strategyMode: outlook.strategyRecommendation.mode,
      positionalNeeds,
      draftPicksOwned,
    });
  }

  return teamStates;
}
