'use client';
import { useQuery } from '@tanstack/react-query';
import { sleeperApi } from '../api/sleeper';
import { computePlayerSeasonPoints } from '../utils/draftCalculations';
import { computeFranchiseOutlook, computeAllTeamWeightedAges } from '../utils/franchiseOutlook';
import type { FranchiseOutlookResult, FutureDraftPick, SleeperPlayer } from '../types/sleeper';

const CURVE_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);
const POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;

/**
 * Compute replacement level per position using league roster settings.
 * The replacement player is the first player outside each position's starter pool
 * (numTeams × startersPerPos slots).
 */
function computeLeagueAwareReplacementLevel(
  playerSeasonPoints: Map<string, number>,
  allPlayers: Record<string, SleeperPlayer>,
  rosterPositions: string[],
  numTeams: number,
): Map<string, number> {
  // Count starter slots per position from roster_positions
  const startersPerPos = new Map<string, number>();
  for (const pos of rosterPositions) {
    if (CURVE_POSITIONS.has(pos)) {
      startersPerPos.set(pos, (startersPerPos.get(pos) ?? 0) + 1);
    } else if (pos === 'FLEX') {
      // FLEX fills from RB/WR/TE pool — add 1 to each threshold
      for (const p of ['RB', 'WR', 'TE']) startersPerPos.set(p, (startersPerPos.get(p) ?? 0) + 1);
    } else if (pos === 'SUPER_FLEX') {
      // SUPER_FLEX fills from QB/RB/WR/TE pool
      for (const p of ['QB', 'RB', 'WR', 'TE']) startersPerPos.set(p, (startersPerPos.get(p) ?? 0) + 1);
    }
  }

  // Group players by position, sort descending
  const byPosition = new Map<string, number[]>();
  for (const [playerId, pts] of playerSeasonPoints) {
    const pos = allPlayers[playerId]?.position ?? '';
    if (!CURVE_POSITIONS.has(pos)) continue;
    const arr = byPosition.get(pos) ?? [];
    arr.push(pts);
    byPosition.set(pos, arr);
  }

  const result = new Map<string, number>();
  for (const [pos, values] of byPosition) {
    const sorted = [...values].sort((a, b) => b - a); // descending
    const slots = startersPerPos.get(pos) ?? 0;
    const idx = numTeams * slots; // first player outside starter pool
    result.set(pos, idx < sorted.length ? sorted[idx] : sorted[Math.floor(sorted.length / 2)]);
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

      // 2. Fetch all regular-season matchups + FantasyCalc values in parallel
      const weekNums = Array.from({ length: regularSeasonWeeks }, (_, i) => i + 1);
      const [weekMatchups, fcMap] = await Promise.all([
        Promise.all(weekNums.map((w) => sleeperApi.getMatchups(leagueId!, w))),
        (async () => {
          const map = new Map<string, number>();
          try {
            const fcRes = await fetch('/api/fantasycalc?numQbs=1');
            if (fcRes.ok) {
              const fcData: { player: { sleeperPlayerId?: string; name: string; position: string }; value: number }[] = await fcRes.json();
              const normalize = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
              for (const entry of fcData) {
                if (entry.player.sleeperPlayerId) {
                  map.set(entry.player.sleeperPlayerId, entry.value);
                } else {
                  const key = `${normalize(entry.player.name)}:${entry.player.position}`;
                  map.set(key, entry.value);
                }
              }
            }
          } catch { /* silently degrade */ }
          return map;
        })(),
      ]);

      // 3. Determine season completeness and pace factor
      const weeksWithData = weekMatchups.filter(
        (week) => week.some((m) => Object.keys(m.players_points ?? {}).length > 0)
      ).length;
      const isSeasonComplete = weeksWithData === regularSeasonWeeks;
      const seasonFactor = weeksWithData > 0 ? regularSeasonWeeks / weeksWithData : 1;

      // 4. Compute per-player season points, normalized to full-season pace
      const rawPoints = computePlayerSeasonPoints(weekMatchups);
      const playerSeasonPoints = new Map<string, number>();
      for (const [pid, pts] of rawPoints) {
        playerSeasonPoints.set(pid, pts * seasonFactor);
      }

      // 5. Compute replacement level per position (league-aware)
      const replacementLevels = computeLeagueAwareReplacementLevel(
        playerSeasonPoints,
        allPlayers,
        league.roster_positions,
        league.settings.num_teams,
      );

      // 6. Build WAR map: WAR = seasonPoints - replacementLevel for each player
      const playerWARMap = new Map<string, number>();
      for (const [playerId, pts] of playerSeasonPoints) {
        const pos = allPlayers[playerId]?.position ?? '';
        if (!CURVE_POSITIONS.has(pos)) continue;
        const repLevel = replacementLevels.get(pos) ?? 0;
        playerWARMap.set(playerId, pts - repLevel);
      }

      // 7. Compute each team's total WAR for league-wide percentile calculations
      const validRosters = rosters.filter((r) => r.owner_id);
      const allTeamWARs = validRosters.map((r) =>
        (r.players ?? []).reduce((sum, pid) => sum + (playerWARMap.get(pid) ?? 0), 0),
      );

      // 8. Compute all teams' weighted ages for age percentile ranking
      const allTeamWeightedAges = computeAllTeamWeightedAges(
        validRosters,
        allPlayers,
        playerWARMap,
      );

      // 9. Build a per-roster map of future draft picks owned by each team.
      const picksByRosterId = new Map<number, FutureDraftPick[]>();
      for (const pick of tradedPicks) {
        if (pick.owner_id == null) continue;
        const arr = picksByRosterId.get(pick.owner_id) ?? [];
        arr.push(pick);
        picksByRosterId.set(pick.owner_id, arr);
      }

      // 10. Cross-team metrics: WAR by position per roster
      const teamPositionWAR = new Map<number, Map<string, number>>();
      for (const roster of validRosters) {
        const posWAR = new Map<string, number>(POSITIONS.map((p) => [p, 0]));
        for (const pid of roster.players ?? []) {
          const pos = allPlayers[pid]?.position ?? '';
          if (!CURVE_POSITIONS.has(pos)) continue;
          posWAR.set(pos, (posWAR.get(pos) ?? 0) + (playerWARMap.get(pid) ?? 0));
        }
        teamPositionWAR.set(roster.roster_id, posWAR);
      }

      // League average WAR per position
      const leagueAvgWARByPosition = new Map(
        POSITIONS.map((pos) => [
          pos,
          [...teamPositionWAR.values()].reduce((s, m) => s + (m.get(pos) ?? 0), 0) / validRosters.length,
        ])
      );

      // Position ranks per team (rosterId -> pos -> rank)
      const positionRanksByRoster = new Map<number, Map<string, number>>();
      for (const pos of POSITIONS) {
        const sorted = [...validRosters].sort(
          (a, b) => (teamPositionWAR.get(b.roster_id)?.get(pos) ?? 0) - (teamPositionWAR.get(a.roster_id)?.get(pos) ?? 0)
        );
        sorted.forEach((r, i) => {
          const m = positionRanksByRoster.get(r.roster_id) ?? new Map();
          m.set(pos, i + 1);
          positionRanksByRoster.set(r.roster_id, m);
        });
      }

      // WAR rank per team (1 = best)
      const warRankByRoster = new Map(
        [...validRosters]
          .map((r, i) => ({ rosterId: r.roster_id, war: allTeamWARs[i] }))
          .sort((a, b) => b.war - a.war)
          .map((r, i) => [r.rosterId, i + 1])
      );

      // Wins rank per team (1 = most wins)
      const winsRankByRoster = new Map(
        [...validRosters]
          .sort((a, b) => b.settings.wins - a.settings.wins)
          .map((r, i) => [r.roster_id, i + 1])
      );

      // 11. Compute franchise outlook for each manager
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
          isSeasonComplete,
          leagueAvgWARByPosition,
          positionRanksByRoster.get(roster.roster_id) ?? new Map(),
          warRankByRoster.get(roster.roster_id) ?? 1,
          winsRankByRoster.get(roster.roster_id) ?? 1,
          fcMap,
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
