'use client';
import { useQuery } from '@tanstack/react-query';
import { sleeperApi } from '../api/sleeper';
import { computeAllTimeWAR, type SeasonWARInput } from '../utils/allTimeWAR';
import type { AllTimeWARAnalysis, ManagerAllTimeWAR } from '../types/sleeper';

// ---------- localStorage cache ----------

const CACHE_VERSION = 'v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedEntry {
  cachedAt: number;
  managerData: [string, Omit<ManagerAllTimeWAR, never>][];
  seasonBoundaries: { season: string; startIndex: number }[];
  hasData: boolean;
}

function loadFromCache(leagueId: string): AllTimeWARAnalysis | null {
  try {
    const raw = localStorage.getItem(`alltime-war-${CACHE_VERSION}-${leagueId}`);
    if (!raw) return null;
    const parsed: CachedEntry = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return {
      managerData: new Map(parsed.managerData),
      seasonBoundaries: parsed.seasonBoundaries,
      hasData: parsed.hasData,
    };
  } catch {
    return null;
  }
}

function saveToCache(leagueId: string, data: AllTimeWARAnalysis): void {
  try {
    const entry: CachedEntry = {
      cachedAt: Date.now(),
      managerData: Array.from(data.managerData.entries()),
      seasonBoundaries: data.seasonBoundaries,
      hasData: data.hasData,
    };
    localStorage.setItem(
      `alltime-war-${CACHE_VERSION}-${leagueId}`,
      JSON.stringify(entry),
    );
  } catch {
    // localStorage unavailable (private mode, quota) — fail silently
  }
}

// ---------- Hook ----------

export function useAllTimeWAR(leagueId: string | null) {
  return useQuery({
    queryKey: ['alltime-war', leagueId],
    queryFn: async (): Promise<AllTimeWARAnalysis> => {
      // 1. Check localStorage cache first
      const cached = loadFromCache(leagueId!);
      if (cached) return cached;

      // 2. Walk the league chain (oldest → newest), up to 10 seasons
      const leagueChain: { league_id: string; season: string; playoff_week_start: number }[] = [];
      let currentId = leagueId!;
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
      leagueChain.reverse(); // chronological order

      // 3. For each season, fetch rosters, users, and regular-season matchups in parallel
      const seasonRawData = await Promise.all(
        leagueChain.map(async ({ league_id, season, playoff_week_start }) => {
          const regularSeasonWeeks = Math.max(1, playoff_week_start - 1);
          const weekNums = Array.from({ length: regularSeasonWeeks }, (_, i) => i + 1);

          const [rosters, users, ...weekMatchupResults] = await Promise.all([
            sleeperApi.getRosters(league_id),
            sleeperApi.getLeagueUsers(league_id),
            ...weekNums.map((w) => sleeperApi.getMatchups(league_id, w)),
          ]);

          return { season, regularSeasonWeeks, rosters, users, weekMatchupResults };
        }),
      );

      // 4. Build SeasonWARInput[] and managerInfo map
      const managerInfo = new Map<string, { displayName: string; managerName: string; avatar: string | null }>();
      const seasonInputs: SeasonWARInput[] = [];

      for (const { season, regularSeasonWeeks, rosters, users, weekMatchupResults } of seasonRawData) {
        // Build userId → display info — always overwrite so the most recent season's name wins
        for (const user of users) {
          managerInfo.set(user.user_id, {
            displayName: user.metadata?.team_name || user.display_name,
            managerName: user.display_name,
            avatar: user.avatar,
          });
        }

        // Build rosterId → userId (skip orphan rosters with no owner)
        const userIdByRosterId = new Map<number, string>();
        for (const roster of rosters) {
          if (roster.owner_id) {
            userIdByRosterId.set(roster.roster_id, roster.owner_id);
          }
        }

        // Filter out weeks that returned empty results (future/bye weeks)
        const weeklyMatchups = weekMatchupResults.map((week) =>
          week.filter((m) => m.players !== null),
        );

        // Skip seasons with no usable matchup data
        const hasData = weeklyMatchups.some((w) => w.length > 0);
        if (!hasData) continue;

        seasonInputs.push({
          season,
          regularSeasonWeeks,
          userIdByRosterId,
          weeklyMatchups,
        });
      }

      // 5. Compute all-time WAR
      const result = computeAllTimeWAR(seasonInputs, managerInfo);

      // 6. Cache and return
      saveToCache(leagueId!, result);
      return result;
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 30, // 30 min in-memory staleness
    gcTime: 1000 * 60 * 60,    // 1 hour GC
  });
}
