'use client';
import { useQuery } from '@tanstack/react-query';
import { sleeperApi } from '../api/sleeper';
import { computePlayerSeasonPoints } from '../utils/draftCalculations';
import { computeFranchiseOutlook, computeAllTeamWeightedAges } from '../utils/franchiseOutlook';
import type { FranchiseOutlookResult, FutureDraftPick, SleeperPlayer } from '../types/sleeper';

const CURVE_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

/**
 * Compute replacement level per position: the median season points among all
 * skill-position players who appeared in matchups and have a known position.
 */
function computeCurrentSeasonReplacementLevel(
  playerSeasonPoints: Map<string, number>,
  allPlayers: Record<string, SleeperPlayer>,
): Map<string, number> {
  const byPosition = new Map<string, number[]>();
  for (const [playerId, pts] of playerSeasonPoints) {
    const player = allPlayers[playerId];
    const pos = player?.position ?? '';
    if (!CURVE_POSITIONS.has(pos)) continue;
    const arr = byPosition.get(pos) ?? [];
    arr.push(pts);
    byPosition.set(pos, arr);
  }
  const result = new Map<string, number>();
  for (const [pos, values] of byPosition) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const med =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    result.set(pos, med);
  }
  return result;
}

export function useFranchiseOutlook(leagueId: string | null) {
  return useQuery({
    queryKey: ['franchise-outlook', leagueId],
    queryFn: async (): Promise<Map<string, FranchiseOutlookResult>> => {
      // 1. Fetch league metadata, rosters, users, all players, and traded picks in parallel
      const [league, rosters, , allPlayers, tradedPicks] = await Promise.all([
        sleeperApi.getLeague(leagueId!),
        sleeperApi.getRosters(leagueId!),
        sleeperApi.getLeagueUsers(leagueId!),
        sleeperApi.getAllPlayers(),
        sleeperApi.getTradedPicks(leagueId!),
      ]);

      const playoffStart = league.settings.playoff_week_start || 15;
      const regularSeasonWeeks = playoffStart - 1;

      // 2. Fetch all regular-season matchups to compute current-season WAR
      const weekNums = Array.from({ length: regularSeasonWeeks }, (_, i) => i + 1);
      const weekMatchups = await Promise.all(
        weekNums.map((w) => sleeperApi.getMatchups(leagueId!, w)),
      );

      // 3. Compute per-player season points from players_points in matchups
      //    computePlayerSeasonPoints takes SleeperMatchup[][] (one per week)
      const playerSeasonPoints = computePlayerSeasonPoints(weekMatchups);

      // 4. Compute replacement level per position (median points among all
      //    skill-position players who appeared this season)
      const replacementLevels = computeCurrentSeasonReplacementLevel(
        playerSeasonPoints,
        allPlayers,
      );

      // 5. Build WAR map: WAR = seasonPoints - replacementLevel for each player
      const playerWARMap = new Map<string, number>();
      for (const [playerId, pts] of playerSeasonPoints) {
        const pos = allPlayers[playerId]?.position ?? '';
        if (!CURVE_POSITIONS.has(pos)) continue;
        const repLevel = replacementLevels.get(pos) ?? 0;
        playerWARMap.set(playerId, pts - repLevel);
      }

      // 6. Compute each team's total WAR for league-wide percentile calculations
      const validRosters = rosters.filter((r) => r.owner_id);
      const allTeamWARs = validRosters.map((r) =>
        (r.players ?? []).reduce((sum, pid) => sum + (playerWARMap.get(pid) ?? 0), 0),
      );

      // 7. Compute all teams' weighted ages for age percentile ranking
      const allTeamWeightedAges = computeAllTeamWeightedAges(
        validRosters,
        allPlayers,
        playerWARMap,
      );

      // 8. Build a per-roster map of future draft picks owned by each team.
      //    The traded_picks endpoint returns all picks with their current owner_id (roster_id).
      const picksByRosterId = new Map<number, FutureDraftPick[]>();
      for (const pick of tradedPicks) {
        if (pick.owner_id == null) continue;
        const arr = picksByRosterId.get(pick.owner_id) ?? [];
        arr.push(pick);
        picksByRosterId.set(pick.owner_id, arr);
      }

      // 9. Compute franchise outlook for each manager
      const results = new Map<string, FranchiseOutlookResult>();
      for (const roster of validRosters) {
        const rosterPicks = picksByRosterId.get(roster.roster_id) ?? [];
        const result = computeFranchiseOutlook(
          roster,
          allPlayers,
          playerWARMap,
          allTeamWARs,
          allTeamWeightedAges,
          rosterPicks,
        );
        results.set(roster.owner_id!, result);
      }

      return results;
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });
}
