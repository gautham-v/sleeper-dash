'use client';
import { useQuery } from '@tanstack/react-query';
import { sleeperApi } from '../api/sleeper';
import { computePlayerSeasonPoints } from '../utils/draftCalculations';
import { computeFranchiseOutlook, computeAllTeamWeightedAges } from '../utils/franchiseOutlook';
import { computeLightweightHTC } from '../utils/playerRecommendations';
import { extractLeagueFormat } from '../utils/leagueFormat';
import type {
  FranchiseOutlookResult,
  FranchiseOutlookRawContext,
  FutureDraftPick,
  SleeperPlayer,
  FCPlayerEntry,
} from '../types/sleeper';
import type { LightweightHTCResult } from '../types/recommendations';
import { THIRTY_MIN_MS, ONE_HOUR_MS } from '@/lib/constants';

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

export interface FranchiseOutlookData {
  outlookMap: Map<string, FranchiseOutlookResult>;
  rawContext: FranchiseOutlookRawContext;
}

export function useFranchiseOutlook(leagueId: string | null) {
  return useQuery({
    queryKey: ['franchise-outlook', leagueId],
    queryFn: async (): Promise<FranchiseOutlookData> => {
      // 1. Fetch league metadata, rosters, users, all players, traded picks, drafts in parallel
      const [league, rosters, leagueUsers, allPlayers, tradedPicks, drafts] = await Promise.all([
        sleeperApi.getLeague(leagueId!),
        sleeperApi.getRosters(leagueId!),
        sleeperApi.getLeagueUsers(leagueId!),
        sleeperApi.getAllPlayers(),
        sleeperApi.getTradedPicks(leagueId!),
        sleeperApi.getDrafts(leagueId!),
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
            const isSF = league.roster_positions.includes('SUPER_FLEX');
            const recPts = league.scoring_settings?.rec ?? 1;
            const ppr = recPts >= 0.8 ? 1 : recPts >= 0.4 ? 0.5 : 0;
            const fcRes = await fetch(`/api/fantasycalc?numQbs=${isSF ? 2 : 1}&ppr=${ppr}`);
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

      // 6. Build pick slot map from upcoming drafts (roster_id → slot number per season)
      // Primary: slot_to_roster_id maps { "1": rosterId, "2": rosterId, ... } — invert it
      // Fallback: draft_order maps { userId: slot } — combine with rosters to get rosterId → slot
      const rosterIdToUserId = new Map<number, string>();
      for (const roster of rosters) {
        if (roster.owner_id) rosterIdToUserId.set(roster.roster_id, roster.owner_id);
      }
      const userIdToRosterId = new Map<string, number>();
      for (const [rid, uid] of rosterIdToUserId) userIdToRosterId.set(uid, rid);

      const rosterToSlotBySeason = new Map<string, Map<number, number>>();
      for (const draft of drafts) {
        const slotMap = new Map<number, number>();
        if (draft.slot_to_roster_id) {
          for (const [slot, rosterId] of Object.entries(draft.slot_to_roster_id)) {
            slotMap.set(rosterId as number, parseInt(slot));
          }
        } else if (draft.draft_order) {
          // draft_order: { userId: pickSlot } — map through rosters to get rosterId → slot
          for (const [userId, slot] of Object.entries(draft.draft_order)) {
            const rosterId = userIdToRosterId.get(userId);
            if (rosterId != null) slotMap.set(rosterId, slot as number);
          }
        }
        if (slotMap.size > 0) rosterToSlotBySeason.set(draft.season, slotMap);
      }

      // 7. Future picks by roster, annotated with slot number when available
      const picksByRosterId = new Map<number, FutureDraftPick[]>();
      const currentSeasonNum = parseInt(league.season ?? '0');
      for (const pick of tradedPicks) {
        if (pick.owner_id == null) continue;
        if (parseInt(pick.season) <= currentSeasonNum) continue;
        const slot = rosterToSlotBySeason.get(pick.season)?.get(pick.roster_id);
        const annotatedPick: FutureDraftPick = slot != null ? { ...pick, slot } : pick;
        const arr = picksByRosterId.get(pick.owner_id) ?? [];
        arr.push(annotatedPick);
        picksByRosterId.set(pick.owner_id, arr);
      }

      // 7b. Add each team's own picks (picks never traded — absent from tradedPicks entirely).
      // Determine future season × round combos from upcoming drafts and traded pick seasons.
      const futurePickDimensions = new Map<string, Set<number>>(); // season → rounds
      for (const pick of tradedPicks) {
        if (parseInt(pick.season) > currentSeasonNum) {
          const rounds = futurePickDimensions.get(pick.season) ?? new Set<number>();
          rounds.add(pick.round);
          futurePickDimensions.set(pick.season, rounds);
        }
      }
      for (const draft of drafts) {
        if (parseInt(draft.season) > currentSeasonNum) {
          const rounds = futurePickDimensions.get(draft.season) ?? new Set<number>();
          for (let r = 1; r <= (draft.settings.rounds ?? 3); r++) rounds.add(r);
          futurePickDimensions.set(draft.season, rounds);
        }
      }
      // Fallback: 2 future years × 3 rounds when no picks/drafts found
      if (futurePickDimensions.size === 0) {
        for (let yr = 1; yr <= 2; yr++) {
          const season = String(currentSeasonNum + yr);
          futurePickDimensions.set(season, new Set([1, 2, 3]));
        }
      }
      // Build set of traded-away pick keys (pick left the originating team)
      const tradedAwayKeys = new Set<string>();
      for (const pick of tradedPicks) {
        if (pick.owner_id !== null && pick.owner_id !== pick.roster_id) {
          tradedAwayKeys.add(`${pick.season}:${pick.round}:${pick.roster_id}`);
        }
      }
      // Add own picks for every roster × future season × round not traded away
      for (const [season, rounds] of futurePickDimensions) {
        for (const round of rounds) {
          for (const roster of rosters) {
            if (!roster.owner_id) continue;
            if (tradedAwayKeys.has(`${season}:${round}:${roster.roster_id}`)) continue;
            const slot = rosterToSlotBySeason.get(season)?.get(roster.roster_id);
            const ownPick: FutureDraftPick = {
              season,
              round,
              roster_id: roster.roster_id,
              previous_owner_id: null,
              owner_id: roster.roster_id,
              ...(slot != null ? { slot } : {}),
            };
            const arr = picksByRosterId.get(roster.roster_id) ?? [];
            arr.push(ownPick);
            picksByRosterId.set(roster.roster_id, arr);
          }
        }
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

      // 10a. First pass: compute per-manager outlook WITHOUT htc (needed to get strategy modes)
      const leagueFormat = extractLeagueFormat(league);
      const emptyHtc = new Map<string, LightweightHTCResult>();
      const outlookMap = new Map<string, FranchiseOutlookResult>();
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
          emptyHtc,
        );
        outlookMap.set(roster.owner_id!, result);
      }

      // 10b. Compute lightweight HTC for every rostered player across all teams
      const htcByPlayerId = new Map<string, LightweightHTCResult>();
      for (const roster of validRosters) {
        const ownerOutlook = outlookMap.get(roster.owner_id!);
        if (!ownerOutlook) continue;

        // Compute max dynasty value on this roster for sell-window normalization
        let maxDynastyValue = 0;
        for (const pid of roster.players ?? []) {
          const dv = fcMap.get(pid) ?? 0;
          if (dv > maxDynastyValue) maxDynastyValue = dv;
        }

        for (const pid of roster.players ?? []) {
          const player = allPlayers[pid];
          if (!player) continue;
          const pos = player.position ?? '';
          if (!['QB', 'RB', 'WR', 'TE'].includes(pos)) continue;

          const htcResult = computeLightweightHTC(
            player,
            pid,
            playerWARMap.get(pid) ?? 0,
            fcMap.get(pid) ?? null,
            maxDynastyValue,
            ownerOutlook,
            { allPlayers, playerWARMap, allTeamWARs, allTeamWeightedAges, isSeasonComplete,
              leagueAvgWARByPosition, allRosters: validRosters, userDisplayNames, userAvatars,
              teamPositionWAR, positionRanksByRoster, picksByRosterId, fcMap, rookiePool,
              warRankByRoster, winsRankByRoster, htcByPlayerId: emptyHtc },
            leagueFormat,
            roster.roster_id,
          );
          htcByPlayerId.set(pid, htcResult);
        }
      }

      // 10c. Second pass: recompute outlook with HTC data for accurate trade targets/partners
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
          htcByPlayerId,
        );
        outlookMap.set(roster.owner_id!, result);
      }

      const rawContext: FranchiseOutlookRawContext = {
        allPlayers,
        playerWARMap,
        allTeamWARs,
        allTeamWeightedAges,
        isSeasonComplete,
        leagueAvgWARByPosition,
        allRosters: validRosters,
        userDisplayNames,
        userAvatars,
        teamPositionWAR,
        positionRanksByRoster,
        picksByRosterId,
        fcMap,
        rookiePool,
        warRankByRoster,
        winsRankByRoster,
        htcByPlayerId,
      };

      return { outlookMap, rawContext };
    },
    enabled: !!leagueId,
    staleTime: THIRTY_MIN_MS,
    gcTime: ONE_HOUR_MS,
  });
}
