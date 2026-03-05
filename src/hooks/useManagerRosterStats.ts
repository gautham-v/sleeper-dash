'use client';
import { useQuery } from '@tanstack/react-query';
import { sleeperApi } from '../api/sleeper';
import type { ManagerRosterStatsResult, PlayerRosterStat, PlayerUsageMetrics, SleeperPlayer } from '../types/sleeper';
import { ONE_DAY_MS, SEVEN_DAYS_MS, THIRTY_MIN_MS, ONE_HOUR_MS } from '@/lib/constants';

const CACHE_VERSION = 'v4';
const PLAYERS_CACHE_KEY = 'sleeper-all-players-v1';

function loadRosterCache(leagueId: string, userId: string): ManagerRosterStatsResult | null {
  try {
    const raw = localStorage.getItem(`manager-roster-stats-${CACHE_VERSION}-${leagueId}-${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > ONE_DAY_MS) return null;
    return { players: parsed.players, hasData: parsed.hasData, currentRosterIds: parsed.currentRosterIds ?? [] };
  } catch { return null; }
}

function saveRosterCache(leagueId: string, userId: string, data: ManagerRosterStatsResult): void {
  try {
    localStorage.setItem(
      `manager-roster-stats-${CACHE_VERSION}-${leagueId}-${userId}`,
      JSON.stringify({ cachedAt: Date.now(), ...data })
    );
  // eslint-disable-next-line no-empty
  } catch {}
}

async function getPlayerDatabase(): Promise<Record<string, SleeperPlayer>> {
  try {
    const raw = localStorage.getItem(PLAYERS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.cachedAt < SEVEN_DAYS_MS) {
        return parsed.players;
      }
    }
  // eslint-disable-next-line no-empty
  } catch {}
  const players = await sleeperApi.getAllPlayers();
  try {
    localStorage.setItem(PLAYERS_CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), players }));
  // eslint-disable-next-line no-empty
  } catch {}
  return players;
}

export function useManagerRosterStats(leagueId: string, userId: string) {
  return useQuery({
    queryKey: ['manager-roster-stats', leagueId, userId],
    queryFn: async (): Promise<ManagerRosterStatsResult> => {
      const cached = loadRosterCache(leagueId, userId);
      if (cached) return cached;

      // Walk the league chain
      const leagueChain: { league_id: string; season: string; playoff_week_start: number }[] = [];
      let currentId = leagueId;
      for (let i = 0; i < 10; i++) {
        const league = await sleeperApi.getLeague(currentId);
        leagueChain.push({
          league_id: league.league_id,
          season: league.season,
          playoff_week_start: league.settings.playoff_week_start ?? 15,
        });
        if (!league.previous_league_id || league.previous_league_id === '0') break;
        currentId = league.previous_league_id;
      }
      leagueChain.reverse();

      // Fetch player database for names
      const playerDb = await getPlayerDatabase();

      // Accumulate per-player stats
      const statsMap = new Map<string, {
        totalPoints: number;
        totalStarts: number;
        totalTDs: number;
        weeksOnRoster: number;
        seasonSet: Set<string>;
      }>();

      // Track per-week usage for the most recent season (last in chain)
      const mostRecentSeason = leagueChain[leagueChain.length - 1]?.season ?? '';
      const weeklyUsage = new Map<string, {
        snapPcts: number[];
        targets: number[];
        rushAtts: number[];
        redZoneOpps: number;
        gamesPlayed: number;
      }>();
      const weekTeamTargets: number[] = [];
      const weekTeamRushAtts: number[] = [];

      for (const { league_id, season, playoff_week_start } of leagueChain) {
        const regularSeasonWeeks = Math.max(1, playoff_week_start - 1);
        const weekNums = Array.from({ length: regularSeasonWeeks }, (_, i) => i + 1);

        const [rosters, ...weekResults] = await Promise.all([
          sleeperApi.getRosters(league_id),
          ...weekNums.map((w) => Promise.all([
            sleeperApi.getMatchups(league_id, w),
            sleeperApi.getPlayerWeeklyStats(season, w),
          ])),
        ]);

        // Find this user's roster_id for this season
        const userRoster = rosters.find(r => r.owner_id === userId);
        if (!userRoster) continue;
        const userRosterId = userRoster.roster_id;
        const isMostRecent = season === mostRecentSeason;

        for (const [weekMatchups, weekStats] of weekResults) {
          const userMatchup = weekMatchups.find(m => m.roster_id === userRosterId);
          if (!userMatchup || !userMatchup.players) continue;

          const starters = new Set(userMatchup.starters ?? []);
          const playerPts = userMatchup.players_points ?? {};

          // Compute team totals for the week (for share calculations)
          let teamTargets = 0;
          let teamRushAtts = 0;
          if (isMostRecent) {
            for (const pid of userMatchup.players) {
              const ps = weekStats[pid];
              if (ps) {
                teamTargets += (ps.rec_tgt ?? 0);
                teamRushAtts += (ps.rush_att ?? 0);
              }
            }
            weekTeamTargets.push(teamTargets);
            weekTeamRushAtts.push(teamRushAtts);
          }

          for (const playerId of userMatchup.players) {
            if (!statsMap.has(playerId)) {
              statsMap.set(playerId, { totalPoints: 0, totalStarts: 0, totalTDs: 0, weeksOnRoster: 0, seasonSet: new Set() });
            }
            const stat = statsMap.get(playerId)!;
            stat.weeksOnRoster += 1;
            stat.seasonSet.add(season);
            // Accumulate TDs (count for all rostered weeks, not just starts)
            const playerStats = weekStats[playerId];
            if (playerStats) {
              stat.totalTDs += Math.round(
                (playerStats.rush_td ?? 0) +
                (playerStats.rec_td ?? 0) +
                (playerStats.pass_td ?? 0) +
                (playerStats.def_td ?? 0) +
                (playerStats.ret_td ?? 0)
              );
            }
            if (starters.has(playerId)) {
              stat.totalStarts += 1;
              stat.totalPoints += playerPts[playerId] ?? 0;
            }

            // Track usage metrics for the most recent season
            if (isMostRecent && playerStats) {
              if (!weeklyUsage.has(playerId)) {
                weeklyUsage.set(playerId, { snapPcts: [], targets: [], rushAtts: [], redZoneOpps: 0, gamesPlayed: 0 });
              }
              const usage = weeklyUsage.get(playerId)!;
              const offSnp = playerStats.off_snp ?? 0;
              const tmOffSnp = playerStats.tm_off_snp ?? 0;
              const snapPct = tmOffSnp > 0 ? offSnp / tmOffSnp : 0;
              const tgt = playerStats.rec_tgt ?? 0;
              const rushAtt = playerStats.rush_att ?? 0;
              const rzTgt = playerStats.rec_rz_tgt ?? 0;
              const rzRush = playerStats.rush_rz_att ?? 0;

              if (offSnp > 0 || tgt > 0 || rushAtt > 0) {
                usage.gamesPlayed += 1;
                usage.snapPcts.push(snapPct);
                usage.targets.push(tgt);
                usage.rushAtts.push(rushAtt);
                usage.redZoneOpps += rzTgt + rzRush;
              }
            }
          }
        }
      }

      // Helper for averages
      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const RECENT_N = 4;

      // Build result array
      const players: PlayerRosterStat[] = [];
      for (const [playerId, stat] of statsMap) {
        const dbPlayer = playerDb[playerId];
        const playerName = dbPlayer
          ? `${dbPlayer.first_name} ${dbPlayer.last_name}`.trim()
          : playerId;
        const position = dbPlayer?.position ?? 'UNK';
        const sortedSeasons = Array.from(stat.seasonSet).sort();

        // Compute usage metrics from most recent season
        let usage: PlayerUsageMetrics | undefined;
        const wu = weeklyUsage.get(playerId);
        if (wu && wu.gamesPlayed >= 2) {
          const recentSlice = <T,>(arr: T[]) => arr.slice(-RECENT_N);

          const snapPct = avg(wu.snapPcts);
          const recentSnapPct = avg(recentSlice(wu.snapPcts));

          // Snap trend: compare last 4 weeks to season average
          const snapDelta = recentSnapPct - snapPct;
          const snapTrend: 'rising' | 'stable' | 'declining' =
            snapDelta > 0.05 ? 'rising' : snapDelta < -0.05 ? 'declining' : 'stable';

          // Target share: player targets / team targets per week
          const seasonTeamTgtAvg = avg(weekTeamTargets);
          const targetShare = seasonTeamTgtAvg > 0 ? avg(wu.targets) / seasonTeamTgtAvg : 0;
          const recentTeamTgtAvg = avg(weekTeamTargets.slice(-RECENT_N));
          const recentTargetShare = recentTeamTgtAvg > 0 ? avg(recentSlice(wu.targets)) / recentTeamTgtAvg : 0;

          // Rush share: player rush atts / team rush atts per week
          const seasonTeamRushAvg = avg(weekTeamRushAtts);
          const rushShare = seasonTeamRushAvg > 0 ? avg(wu.rushAtts) / seasonTeamRushAvg : 0;
          const recentTeamRushAvg = avg(weekTeamRushAtts.slice(-RECENT_N));
          const recentRushShare = recentTeamRushAvg > 0 ? avg(recentSlice(wu.rushAtts)) / recentTeamRushAvg : 0;

          usage = {
            snapPct: Math.round(snapPct * 1000) / 1000,
            recentSnapPct: Math.round(recentSnapPct * 1000) / 1000,
            snapTrend,
            targetShare: Math.round(targetShare * 1000) / 1000,
            recentTargetShare: Math.round(recentTargetShare * 1000) / 1000,
            rushShare: Math.round(rushShare * 1000) / 1000,
            recentRushShare: Math.round(recentRushShare * 1000) / 1000,
            gamesPlayed: wu.gamesPlayed,
            redZoneOpps: wu.redZoneOpps,
          };
        }

        players.push({
          playerId,
          playerName,
          position,
          totalPoints: Math.round(stat.totalPoints * 10) / 10,
          totalStarts: stat.totalStarts,
          totalTDs: stat.totalTDs,
          weeksOnRoster: stat.weeksOnRoster,
          seasons: stat.seasonSet.size,
          firstSeason: sortedSeasons[0] ?? '',
          lastSeason: sortedSeasons[sortedSeasons.length - 1] ?? '',
          usage,
        });
      }

      // Sort by totalPoints descending
      players.sort((a, b) => b.totalPoints - a.totalPoints);

      // Fetch current roster for the most recent league
      const currentRosters = await sleeperApi.getRosters(leagueId);
      const currentUserRoster = currentRosters.find(r => r.owner_id === userId);
      const currentRosterIds = currentUserRoster?.players ?? [];

      const result: ManagerRosterStatsResult = { players, hasData: players.length > 0, currentRosterIds };
      saveRosterCache(leagueId, userId, result);
      return result;
    },
    enabled: !!leagueId && !!userId,
    staleTime: THIRTY_MIN_MS,
    gcTime: ONE_HOUR_MS,
  });
}
