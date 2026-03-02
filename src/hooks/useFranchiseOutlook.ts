'use client';
import { useQuery } from '@tanstack/react-query';
import { sleeperApi } from '../api/sleeper';
import { computePlayerSeasonPoints } from '../utils/draftCalculations';
import { computeFranchiseOutlook, computeAllTeamWeightedAges } from '../utils/franchiseOutlook';
import type {
  FranchiseOutlookResult,
  FutureDraftPick,
  SleeperPlayer,
  FCPlayerEntry,
} from '../types/sleeper';

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
  const startersPerPos = new Map<string, number>();
  for (const pos of rosterPositions) {
    if (CURVE_POSITIONS.has(pos)) {
      startersPerPos.set(pos, (startersPerPos.get(pos) ?? 0) + 1);
    } else if (pos === 'FLEX') {
      for (const p of ['RB', 'WR', 'TE']) startersPerPos.set(p, (startersPerPos.get(p) ?? 0) + 1);
    } else if (pos === 'SUPER_FLEX') {
      for (const p of ['QB', 'RB', 'WR', 'TE']) startersPerPos.set(p, (startersPerPos.get(p) ?? 0) + 1);
    }
  }

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
    const sorted = [...values].sort((a, b) => b - a);
    const slots = startersPerPos.get(pos) ?? 0;
    const idx = numTeams * slots;
    result.set(pos, idx < sorted.length ? sorted[idx] : sorted[Math.floor(sorted.length / 2)]);
  }
  return result;
}

export function useFranchiseOutlook(leagueId: string | null) {
  return useQuery({
    queryKey: ['franchise-outlook', leagueId],
    queryFn: async (): Promise<Map<string, FranchiseOutlookResult>> => {
      // 1. Fetch league metadata, rosters, users, all players, traded picks in parallel
      const [league, rosters, leagueUsers, allPlayers, tradedPicks] = await Promise.all([
        sleeperApi.getLeague(leagueId!),
        sleeperApi.getRosters(leagueId!),
        sleeperApi.getLeagueUsers(leagueId!),
        sleeperApi.getAllPlayers(),
        sleeperApi.getTradedPicks(leagueId!),
      ]);

      const playoffStart = league.settings.playoff_week_start || 15;
      const regularSeasonWeeks = playoffStart - 1;
      const weekNums = Array.from({ length: regularSeasonWeeks }, (_, i) => i + 1);

      // 2. Fetch matchups + FantasyCalc values in parallel
      const [weekMatchups, { fcMap, rookiePool }] = await Promise.all([
        Promise.all(weekNums.map((w) => sleeperApi.getMatchups(leagueId!, w))),
        (async () => {
          const map = new Map<string, number>();
          const pool: FCPlayerEntry[] = [];
          try {
            const fcRes = await fetch('/api/fantasycalc?numQbs=1');
            if (fcRes.ok) {
              // API field is "sleeperId", not "sleeperPlayerId"
              const fcData: FCPlayerEntry[] = await fcRes.json();
              const normalize = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
              for (const entry of fcData) {
                // Primary: direct sleeperId match
                if (entry.player.sleeperId) {
                  map.set(entry.player.sleeperId, entry.value);
                } else {
                  // Fallback: normalized name:position key
                  const key = `${normalize(entry.player.name)}:${entry.player.position}`;
                  map.set(key, entry.value);
                }
                // Collect incoming rookies (maybeYoe === 0)
                if (entry.player.maybeYoe === 0) {
                  pool.push(entry);
                }
              }
            }
          } catch { /* silently degrade */ }
          return { fcMap: map, rookiePool: pool };
        })(),
      ]);

      // 3. Season completeness + pace normalization
      const weeksWithData = weekMatchups.filter(
        (week) => week.some((m) => Object.keys(m.players_points ?? {}).length > 0),
      ).length;
      const isSeasonComplete = weeksWithData === regularSeasonWeeks;
      const seasonFactor = weeksWithData > 0 ? regularSeasonWeeks / weeksWithData : 1;

      const rawPoints = computePlayerSeasonPoints(weekMatchups);
      const playerSeasonPoints = new Map<string, number>();
      for (const [pid, pts] of rawPoints) {
        playerSeasonPoints.set(pid, pts * seasonFactor);
      }

      // 4. League-aware replacement level → WAR map
      const replacementLevels = computeLeagueAwareReplacementLevel(
        playerSeasonPoints, allPlayers,
        league.roster_positions, league.settings.num_teams,
      );
      const playerWARMap = new Map<string, number>();
      for (const [playerId, pts] of playerSeasonPoints) {
        const pos = allPlayers[playerId]?.position ?? '';
        if (!CURVE_POSITIONS.has(pos)) continue;
        playerWARMap.set(playerId, pts - (replacementLevels.get(pos) ?? 0));
      }

      // 5. Team totals and age weighted averages
      const validRosters = rosters.filter((r) => r.owner_id);
      const allTeamWARs = validRosters.map((r) =>
        (r.players ?? []).reduce((sum, pid) => sum + (playerWARMap.get(pid) ?? 0), 0),
      );
      const allTeamWeightedAges = computeAllTeamWeightedAges(validRosters, allPlayers, playerWARMap);

      // 6. Future picks by roster
      const picksByRosterId = new Map<number, FutureDraftPick[]>();
      for (const pick of tradedPicks) {
        if (pick.owner_id == null) continue;
        const arr = picksByRosterId.get(pick.owner_id) ?? [];
        arr.push(pick);
        picksByRosterId.set(pick.owner_id, arr);
      }

      // 7. User display names + avatars (previously skipped in destructuring)
      const userDisplayNames = new Map<string, string>();
      const userAvatars = new Map<string, string | null>();
      for (const u of leagueUsers) {
        userDisplayNames.set(u.user_id, u.metadata?.team_name || u.display_name);
        userAvatars.set(u.user_id, u.avatar);
      }

      // 8. Player → owner map
      const playerOwnerMap = new Map<string, string>();
      for (const roster of validRosters) {
        for (const pid of roster.players ?? []) {
          if (roster.owner_id) playerOwnerMap.set(pid, roster.owner_id);
        }
      }
      void playerOwnerMap; // available for future use; passed via allRosters

      // 9. Cross-team WAR by position + position ranks
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

      const leagueAvgWARByPosition = new Map(
        POSITIONS.map((pos) => [
          pos,
          [...teamPositionWAR.values()].reduce((s, m) => s + (m.get(pos) ?? 0), 0) / validRosters.length,
        ]),
      );

      const positionRanksByRoster = new Map<number, Map<string, number>>();
      for (const pos of POSITIONS) {
        const sorted = [...validRosters].sort(
          (a, b) => (teamPositionWAR.get(b.roster_id)?.get(pos) ?? 0) - (teamPositionWAR.get(a.roster_id)?.get(pos) ?? 0),
        );
        sorted.forEach((r, i) => {
          const m = positionRanksByRoster.get(r.roster_id) ?? new Map();
          m.set(pos, i + 1);
          positionRanksByRoster.set(r.roster_id, m);
        });
      }

      const warRankByRoster = new Map(
        [...validRosters]
          .map((r, i) => ({ rosterId: r.roster_id, war: allTeamWARs[i] }))
          .sort((a, b) => b.war - a.war)
          .map((r, i) => [r.rosterId, i + 1]),
      );
      const winsRankByRoster = new Map(
        [...validRosters]
          .sort((a, b) => b.settings.wins - a.settings.wins)
          .map((r, i) => [r.roster_id, i + 1]),
      );

      // 10. Compute per-manager outlook
      const results = new Map<string, FranchiseOutlookResult>();
      for (const roster of validRosters) {
        const result = computeFranchiseOutlook(
          roster,
          allPlayers,
          playerWARMap,
          allTeamWARs,
          allTeamWeightedAges,
          picksByRosterId.get(roster.roster_id) ?? [],
          isSeasonComplete,
          leagueAvgWARByPosition,
          positionRanksByRoster.get(roster.roster_id) ?? new Map(),
          warRankByRoster.get(roster.roster_id) ?? 1,
          winsRankByRoster.get(roster.roster_id) ?? 1,
          fcMap,
          rookiePool,
          validRosters,
          userDisplayNames,
          userAvatars,
          teamPositionWAR,
          positionRanksByRoster,
          picksByRosterId,
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
