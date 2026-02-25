'use client';
import { useQuery } from '@tanstack/react-query';
import { sleeperApi } from '../api/sleeper';
import type { ManagerRosterStatsResult, PlayerRosterStat, SleeperPlayer } from '../types/sleeper';

const CACHE_VERSION = 'v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PLAYERS_CACHE_KEY = 'sleeper-all-players-v1';
const PLAYERS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for player DB

function loadRosterCache(leagueId: string, userId: string): ManagerRosterStatsResult | null {
  try {
    const raw = localStorage.getItem(`manager-roster-stats-${CACHE_VERSION}-${leagueId}-${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return { players: parsed.players, hasData: parsed.hasData };
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
      if (Date.now() - parsed.cachedAt < PLAYERS_CACHE_TTL_MS) {
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
        weeksOnRoster: number;
        seasonSet: Set<string>;
      }>();

      for (const { league_id, season, playoff_week_start } of leagueChain) {
        const regularSeasonWeeks = Math.max(1, playoff_week_start - 1);
        const weekNums = Array.from({ length: regularSeasonWeeks }, (_, i) => i + 1);

        const [rosters, ...weekMatchupResults] = await Promise.all([
          sleeperApi.getRosters(league_id),
          ...weekNums.map((w) => sleeperApi.getMatchups(league_id, w)),
        ]);

        // Find this user's roster_id for this season
        const userRoster = rosters.find(r => r.owner_id === userId);
        if (!userRoster) continue;
        const userRosterId = userRoster.roster_id;

        for (const weekMatchups of weekMatchupResults) {
          const userMatchup = weekMatchups.find(m => m.roster_id === userRosterId);
          if (!userMatchup || !userMatchup.players) continue;

          const starters = new Set(userMatchup.starters ?? []);
          const playerPts = userMatchup.players_points ?? {};

          for (const playerId of userMatchup.players) {
            if (!statsMap.has(playerId)) {
              statsMap.set(playerId, { totalPoints: 0, totalStarts: 0, weeksOnRoster: 0, seasonSet: new Set() });
            }
            const stat = statsMap.get(playerId)!;
            stat.weeksOnRoster += 1;
            stat.seasonSet.add(season);
            if (starters.has(playerId)) {
              stat.totalStarts += 1;
              stat.totalPoints += playerPts[playerId] ?? 0;
            }
          }
        }
      }

      // Build result array
      const players: PlayerRosterStat[] = [];
      for (const [playerId, stat] of statsMap) {
        const dbPlayer = playerDb[playerId];
        const playerName = dbPlayer
          ? `${dbPlayer.first_name} ${dbPlayer.last_name}`.trim()
          : playerId;
        const position = dbPlayer?.position ?? 'UNK';
        const sortedSeasons = Array.from(stat.seasonSet).sort();
        players.push({
          playerId,
          playerName,
          position,
          totalPoints: Math.round(stat.totalPoints * 10) / 10,
          totalStarts: stat.totalStarts,
          weeksOnRoster: stat.weeksOnRoster,
          seasons: stat.seasonSet.size,
          firstSeason: sortedSeasons[0] ?? '',
          lastSeason: sortedSeasons[sortedSeasons.length - 1] ?? '',
        });
      }

      // Sort by totalPoints descending
      players.sort((a, b) => b.totalPoints - a.totalPoints);

      const result: ManagerRosterStatsResult = { players, hasData: players.length > 0 };
      saveRosterCache(leagueId, userId, result);
      return result;
    },
    enabled: !!leagueId && !!userId,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });
}
