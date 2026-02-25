import { useQuery } from '@tanstack/react-query';
import { sleeperApi } from '../api/sleeper';
import type { LeagueDraftAnalysis, ManagerDraftSummary } from '../types/sleeper';
import {
  computePlayerSeasonPoints,
  computeLeagueDraftAnalysis,
  type SeasonDraftInput,
} from '../utils/draftCalculations';

// ---------- localStorage cache ----------

const CACHE_VERSION = 'v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedEntry {
  cachedAt: number;
  managerSummaries: [string, ManagerDraftSummary][];
  surplusByUserId: [string, number][];
  hasData: boolean;
}

function loadFromCache(leagueId: string): LeagueDraftAnalysis | null {
  try {
    const raw = localStorage.getItem(`draft-analysis-${CACHE_VERSION}-${leagueId}`);
    if (!raw) return null;
    const parsed: CachedEntry = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return {
      managerSummaries: new Map(parsed.managerSummaries),
      surplusByUserId: new Map(parsed.surplusByUserId),
      hasData: parsed.hasData,
    };
  } catch {
    return null;
  }
}

function saveToCache(leagueId: string, data: LeagueDraftAnalysis): void {
  try {
    const entry: CachedEntry = {
      cachedAt: Date.now(),
      managerSummaries: Array.from(data.managerSummaries.entries()),
      surplusByUserId: Array.from(data.surplusByUserId.entries()),
      hasData: data.hasData,
    };
    localStorage.setItem(
      `draft-analysis-${CACHE_VERSION}-${leagueId}`,
      JSON.stringify(entry),
    );
  } catch {
    // localStorage can be unavailable (private mode, quota) — fail silently
  }
}

// ---------- Core fetch function (exported for use with useQueries) ----------

const REGULAR_SEASON_WEEKS = 14;

export async function fetchLeagueDraftAnalysis(leagueId: string): Promise<LeagueDraftAnalysis> {
  // 1. Check localStorage
  const cached = loadFromCache(leagueId);
  if (cached) return cached;

  // 2. Walk the league chain (oldest → newest), same pattern as useLeagueHistory
  const leagueChain: { league_id: string; season: string }[] = [];
  let currentId = leagueId;
  for (let i = 0; i < 8; i++) {
    const league = await sleeperApi.getLeague(currentId);
    leagueChain.push({ league_id: league.league_id, season: league.season });
    if (!league.previous_league_id || league.previous_league_id === '0') break;
    currentId = league.previous_league_id;
  }
  leagueChain.reverse(); // chronological order

  // 3. For each season: fetch drafts, users, rosters, and all regular-season matchups in parallel
  const weekNums = Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => i + 1);

  const seasonRawData = await Promise.all(
    leagueChain.map(async ({ league_id, season }) => {
      const [drafts, users, rosters, ...weekMatchupResults] = await Promise.all([
        sleeperApi.getDrafts(league_id),
        sleeperApi.getLeagueUsers(league_id),
        sleeperApi.getRosters(league_id),
        ...weekNums.map((w) => sleeperApi.getMatchups(league_id, w)),
      ]);

      return { league_id, season, drafts, users, rosters, weekMatchupResults };
    }),
  );

  // 4. Fetch draft picks for each season with a valid snake draft
  const seasonDraftInputs: SeasonDraftInput[] = [];

  await Promise.all(
    seasonRawData.map(async ({ league_id, season, drafts, users, rosters, weekMatchupResults }) => {
      // Filter to snake drafts that have been completed or are in-progress
      const draft = drafts.find(
        (d) => d.type === 'snake' && d.status !== 'pre_draft',
      );
      if (!draft) return; // skip auction/no-draft seasons

      const picks = await sleeperApi.getDraftPicks(draft.draft_id);
      if (picks.length === 0) return;

      // Build roster → user map
      const rosterToUser = new Map<number, string>();
      for (const roster of rosters) {
        if (roster.owner_id) rosterToUser.set(roster.roster_id, roster.owner_id);
      }

      // Build userId → display info map
      const userInfo = new Map<string, { displayName: string; avatar: string | null }>();
      for (const u of users) {
        userInfo.set(u.user_id, {
          displayName: u.display_name,
          avatar: u.avatar,
        });
      }

      // Aggregate player season points from all regular-season matchups
      const playerSeasonPoints = computePlayerSeasonPoints(weekMatchupResults);

      // Suppress unused variable warning — league_id used as key above
      void league_id;

      seasonDraftInputs.push({
        season,
        picks,
        playerSeasonPoints,
        rosterToUser,
        userInfo,
      });
    }),
  );

  // 5. Run computation
  const result = computeLeagueDraftAnalysis(seasonDraftInputs);

  // 6. Cache and return
  saveToCache(leagueId, result);
  return result;
}

// ---------- Hook ----------

export function useLeagueDraftHistory(leagueId: string | null) {
  return useQuery({
    queryKey: ['league-draft-history', leagueId],
    queryFn: () => fetchLeagueDraftAnalysis(leagueId!),
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 30,
  });
}
