import { useQuery } from '@tanstack/react-query';
import { sleeperApi } from '../api/sleeper';
import type { SleeperMatchup, SleeperTransaction, SleeperDraft } from '../types/sleeper';
import type { LeagueTradeAnalysis, ManagerTradeSummary, AnalyzedTrade, TaggedTransaction, SeasonTradeInput } from '../types/trade';
import { computePlayerSeasonPoints } from '../utils/draftCalculations';
import { buildDraftPickResolution, computeLeagueTradeAnalysis } from '../utils/tradeCalculations';

// ---------- localStorage cache ----------

const CACHE_VERSION = 'v11';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedEntry {
  cachedAt: number;
  managerSummaries: [string, ManagerTradeSummary][];
  allTrades: AnalyzedTrade[];
  biggestWinAllTime: LeagueTradeAnalysis['biggestWinAllTime'];
  biggestLossAllTime: LeagueTradeAnalysis['biggestLossAllTime'];
  mostActiveTrader: LeagueTradeAnalysis['mostActiveTrader'];
  hasData: boolean;
}

function loadFromCache(leagueId: string): LeagueTradeAnalysis | null {
  try {
    const raw = localStorage.getItem(`trade-analysis-${CACHE_VERSION}-${leagueId}`);
    if (!raw) return null;
    const parsed: CachedEntry = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return {
      managerSummaries: new Map(parsed.managerSummaries),
      allTrades: parsed.allTrades,
      biggestWinAllTime: parsed.biggestWinAllTime,
      biggestLossAllTime: parsed.biggestLossAllTime,
      mostActiveTrader: parsed.mostActiveTrader,
      hasData: parsed.hasData,
    };
  } catch {
    return null;
  }
}

function saveToCache(leagueId: string, data: LeagueTradeAnalysis): void {
  try {
    const entry: CachedEntry = {
      cachedAt: Date.now(),
      managerSummaries: Array.from(data.managerSummaries.entries()),
      allTrades: data.allTrades,
      biggestWinAllTime: data.biggestWinAllTime,
      biggestLossAllTime: data.biggestLossAllTime,
      mostActiveTrader: data.mostActiveTrader,
      hasData: data.hasData,
    };
    localStorage.setItem(
      `trade-analysis-${CACHE_VERSION}-${leagueId}`,
      JSON.stringify(entry),
    );
  } catch {
    // localStorage can be unavailable (private mode, quota) — fail silently
  }
}

// ---------- Core fetch function (exported for use with useQueries) ----------

const TOTAL_SEASON_WEEKS = 18;
const REGULAR_SEASON_WEEKS = 14;

export async function fetchLeagueTradeAnalysis(leagueId: string): Promise<LeagueTradeAnalysis> {
  // 1. Check localStorage
  const cached = loadFromCache(leagueId);
  if (cached) return cached;

  // 2. Walk the league chain (oldest → newest)
  const leagueChain: { league_id: string; season: string }[] = [];
  let currentId = leagueId;
  for (let i = 0; i < 8; i++) {
    const league = await sleeperApi.getLeague(currentId);
    leagueChain.push({ league_id: league.league_id, season: league.season });
    if (!league.previous_league_id) break;
    currentId = league.previous_league_id;
  }
  leagueChain.reverse(); // chronological order

  // 3. For each season: fetch users, rosters, drafts, matchups, and transactions in parallel
  const weekNums = Array.from({ length: TOTAL_SEASON_WEEKS }, (_, i) => i + 1);
  const regularWeekNums = Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => i + 1);

  const seasonRawData = await Promise.all(
    leagueChain.map(async ({ league_id, season }) => {
      const [users, rosters, drafts, ...weekResults] = await Promise.all([
        sleeperApi.getLeagueUsers(league_id),
        sleeperApi.getRosters(league_id),
        sleeperApi.getDrafts(league_id),
        // Fetch matchups for regular season (weeks 1-14 for player stats)
        ...regularWeekNums.map((w) => sleeperApi.getMatchups(league_id, w)),
        // Fetch transactions for all weeks (weeks 1-18)
        ...weekNums.map((w) => sleeperApi.getTransactions(league_id, w)),
      ]);

      const weekMatchupResults = weekResults.slice(0, REGULAR_SEASON_WEEKS) as SleeperMatchup[][];
      const weekTransactionResults = weekResults.slice(REGULAR_SEASON_WEEKS) as SleeperTransaction[][];

      return { league_id, season, users, rosters, drafts, weekMatchupResults, weekTransactionResults };
    }),
  );

  // 4. Build player map from all players API (for name resolution)
  const allPlayers = await sleeperApi.getAllPlayers();
  const playerMap = new Map<string, { name: string; position: string }>();
  for (const [id, p] of Object.entries(allPlayers)) {
    if (p.first_name && p.last_name && p.position) {
      playerMap.set(id, { name: `${p.first_name} ${p.last_name}`, position: p.position });
    }
  }

  // 5. Fetch draft picks for pick resolution + build resolution map
  const draftInputs: Array<{
    season: string;
    picks: import('../types/sleeper').SleeperDraftPick[];
    playerSeasonPoints: Map<string, number>;
    draft: SleeperDraft;
    rosterToUser: Map<number, string>;
  }> = [];

  await Promise.all(
    seasonRawData.map(async ({ season, drafts, rosters, weekMatchupResults }) => {
      const draft = drafts.find((d) => d.status === 'complete');
      if (!draft) return;

      const picks = await sleeperApi.getDraftPicks(draft.draft_id);
      if (picks.length === 0) return;

      // Build rosterToUser for this draft season
      const seasonRosterToUser = new Map<number, string>();
      for (const roster of rosters) {
        if (roster.owner_id) seasonRosterToUser.set(roster.roster_id, roster.owner_id);
      }

      // Also add pick metadata to playerMap
      for (const p of picks) {
        playerMap.set(p.player_id, {
          name: `${p.metadata.first_name} ${p.metadata.last_name}`,
          position: p.metadata.position,
        });
      }

      const playerSeasonPoints = computePlayerSeasonPoints(weekMatchupResults);

      draftInputs.push({ season, picks, playerSeasonPoints, draft, rosterToUser: seasonRosterToUser });
    }),
  );

  let draftPickResolution: Map<string, { playerId: string; playerName: string; position: string; seasonPoints: number; pickInRound: number | null }>;
  try {
    draftPickResolution = buildDraftPickResolution(draftInputs, playerMap);
  } catch {
    draftPickResolution = new Map();
  }

  // 6. Build season trade inputs
  const seasonTradeInputs: SeasonTradeInput[] = [];

  for (const { league_id, season, users, rosters, weekMatchupResults, weekTransactionResults } of seasonRawData) {
    // Build roster → user map
    const rosterToUser = new Map<number, string>();
    for (const roster of rosters) {
      if (roster.owner_id) rosterToUser.set(roster.roster_id, roster.owner_id);
    }

    // Build user info map
    const userInfo = new Map<string, { displayName: string; avatar: string | null }>();
    for (const u of users) {
      userInfo.set(u.user_id, { displayName: u.display_name, avatar: u.avatar });
    }

    // Tag transactions with sourceWeek, filter to completed trades
    const trades: TaggedTransaction[] = [];
    for (let w = 0; w < weekNums.length; w++) {
      const weekTxns = weekTransactionResults[w] ?? [];
      for (const txn of weekTxns) {
        if (txn.type === 'trade' && txn.status === 'complete') {
          trades.push({ ...txn, sourceWeek: weekNums[w], season, leagueId: league_id });
        }
      }
    }

    if (trades.length === 0) continue;

    seasonTradeInputs.push({
      season,
      leagueId: league_id,
      trades,
      weeklyMatchups: weekMatchupResults,
      rosterToUser,
      userInfo,
      playerMap,
      draftPickResolution,
    });
  }

  // 7. Run computation
  const result = computeLeagueTradeAnalysis(seasonTradeInputs);

  // 8. Cache and return
  saveToCache(leagueId, result);
  return result;
}

// ---------- Hook ----------

export function useLeagueTradeHistory(leagueId: string | null) {
  return useQuery({
    queryKey: ['league-trade-history', leagueId],
    queryFn: () => fetchLeagueTradeAnalysis(leagueId!),
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 30,
  });
}
