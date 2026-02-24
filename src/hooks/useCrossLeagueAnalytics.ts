'use client';
import { useQueries, useQuery } from '@tanstack/react-query';
import { sleeperApi } from '../api/sleeper';
import { fetchLeagueTradeAnalysis } from './useLeagueTradeHistory';
import { fetchLeagueDraftAnalysis } from './useLeagueDraftHistory';
import type { AnalyzedTrade, ManagerTradeSummary } from '../types/trade';
import type { AnalyzedPick, ManagerDraftSummary } from '../types/sleeper';
import { assignGrade } from '../utils/draftCalculations';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface LeagueRef {
  leagueId: string;
  leagueName: string;
}

export interface PerLeagueTradeSummary {
  leagueId: string;
  leagueName: string;
  tradeCount: number;
  netValue: number;
  grade: string;
  gradeColor: string;
  biggestWin: { trade: AnalyzedTrade; netValue: number } | null;
  biggestLoss: { trade: AnalyzedTrade; netValue: number } | null;
  mostFrequentPartner: { displayName: string; count: number } | null;
}

export interface CrossLeagueTradeStats {
  totalTrades: number;
  totalNetValue: number;
  overallGrade: string;
  overallGradeColor: string;
  overallWinRate: number;
  perLeague: PerLeagueTradeSummary[];
  bestTradeAllTime: { trade: AnalyzedTrade; netValue: number; leagueName: string } | null;
  worstTradeAllTime: { trade: AnalyzedTrade; netValue: number; leagueName: string } | null;
  topTradingPartners: { displayName: string; count: number; leagueName: string }[];
  isLoading: boolean;
  hasData: boolean;
}

export interface PerLeagueDraftSummary {
  leagueId: string;
  leagueName: string;
  grade: string;
  gradeColor: string;
  totalWAR: number;
  totalSurplus: number;
  hitRate: number;
  bustRate: number;
  bestPick: AnalyzedPick | null;
  worstPick: AnalyzedPick | null;
}

export interface CrossLeagueDraftStats {
  totalPicks: number;
  totalWAR: number;
  totalSurplus: number;
  overallGrade: string;
  overallGradeColor: string;
  hitRate: number;
  bustRate: number;
  perLeague: PerLeagueDraftSummary[];
  bestPickAllTime: { pick: AnalyzedPick; leagueName: string } | null;
  worstPickAllTime: { pick: AnalyzedPick; leagueName: string } | null;
  isLoading: boolean;
  hasData: boolean;
}

export interface PlayerHolding {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  leagueIds: string[];
  leagueNames: string[];
  shares: number;
}

export interface CrossLeagueRosterData {
  players: PlayerHolding[];
  isLoading: boolean;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function computeOverallGrade(percentiles: number[]): { grade: string; gradeColor: string } {
  if (percentiles.length === 0) return { grade: '—', gradeColor: 'text-gray-500' };
  const avg = percentiles.reduce((a, b) => a + b, 0) / percentiles.length;
  return assignGrade(avg);
}

// ────────────────────────────────────────────────────────────
// useCrossLeagueTradeStats
// ────────────────────────────────────────────────────────────

export function useCrossLeagueTradeStats(
  userId: string | undefined,
  leagues: LeagueRef[],
): CrossLeagueTradeStats {
  const queries = useQueries({
    queries: leagues.map(({ leagueId }) => ({
      queryKey: ['league-trade-history', leagueId],
      queryFn: () => fetchLeagueTradeAnalysis(leagueId),
      enabled: !!userId && leagues.length > 0,
      staleTime: 1000 * 60 * 30,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);

  if (!userId || leagues.length === 0) {
    return { totalTrades: 0, totalNetValue: 0, overallGrade: '—', overallGradeColor: 'text-gray-500', overallWinRate: 0, perLeague: [], bestTradeAllTime: null, worstTradeAllTime: null, topTradingPartners: [], isLoading: false, hasData: false };
  }

  if (isLoading) {
    return { totalTrades: 0, totalNetValue: 0, overallGrade: '—', overallGradeColor: 'text-gray-500', overallWinRate: 0, perLeague: [], bestTradeAllTime: null, worstTradeAllTime: null, topTradingPartners: [], isLoading: true, hasData: false };
  }

  const perLeague: PerLeagueTradeSummary[] = [];
  let totalTrades = 0;
  let totalNetValue = 0;
  let totalWins = 0;
  let totalTradesForWinRate = 0;
  const percentiles: number[] = [];
  let bestTrade: { trade: AnalyzedTrade; netValue: number; leagueName: string } | null = null;
  let worstTrade: { trade: AnalyzedTrade; netValue: number; leagueName: string } | null = null;
  const partnerCounts = new Map<string, { displayName: string; count: number; leagueName: string }>();

  for (let i = 0; i < leagues.length; i++) {
    const { leagueId, leagueName } = leagues[i];
    const data = queries[i]?.data;
    if (!data) continue;

    const summary: ManagerTradeSummary | undefined = data.managerSummaries.get(userId);
    if (!summary) continue;

    totalTrades += summary.totalTrades;
    totalNetValue += summary.totalNetValue;
    totalTradesForWinRate += summary.totalTrades;
    totalWins += Math.round(summary.tradeWinRate * summary.totalTrades);
    percentiles.push(summary.netValuePercentile);

    perLeague.push({
      leagueId,
      leagueName,
      tradeCount: summary.totalTrades,
      netValue: summary.totalNetValue,
      grade: summary.grade,
      gradeColor: summary.gradeColor,
      biggestWin: summary.biggestWin,
      biggestLoss: summary.biggestLoss,
      mostFrequentPartner: summary.mostFrequentPartner
        ? { displayName: summary.mostFrequentPartner.displayName, count: summary.mostFrequentPartner.count }
        : null,
    });

    // Track best/worst trade across all leagues
    if (summary.biggestWin) {
      if (!bestTrade || summary.biggestWin.netValue > bestTrade.netValue) {
        bestTrade = { ...summary.biggestWin, leagueName };
      }
    }
    if (summary.biggestLoss) {
      if (!worstTrade || summary.biggestLoss.netValue < worstTrade.netValue) {
        worstTrade = { ...summary.biggestLoss, leagueName };
      }
    }

    // Aggregate trade partners
    if (summary.mostFrequentPartner) {
      const key = summary.mostFrequentPartner.displayName;
      const existing = partnerCounts.get(key);
      if (existing) {
        existing.count += summary.mostFrequentPartner.count;
      } else {
        partnerCounts.set(key, {
          displayName: summary.mostFrequentPartner.displayName,
          count: summary.mostFrequentPartner.count,
          leagueName,
        });
      }
    }
  }

  const { grade: overallGrade, gradeColor: overallGradeColor } = computeOverallGrade(percentiles);
  const overallWinRate = totalTradesForWinRate > 0 ? totalWins / totalTradesForWinRate : 0;
  const topTradingPartners = [...partnerCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalTrades,
    totalNetValue,
    overallGrade,
    overallGradeColor,
    overallWinRate,
    perLeague: perLeague.sort((a, b) => b.tradeCount - a.tradeCount),
    bestTradeAllTime: bestTrade,
    worstTradeAllTime: worstTrade,
    topTradingPartners,
    isLoading: false,
    hasData: perLeague.length > 0,
  };
}

// ────────────────────────────────────────────────────────────
// useCrossLeagueDraftStats
// ────────────────────────────────────────────────────────────

export function useCrossLeagueDraftStats(
  userId: string | undefined,
  leagues: LeagueRef[],
): CrossLeagueDraftStats {
  const queries = useQueries({
    queries: leagues.map(({ leagueId }) => ({
      queryKey: ['league-draft-history', leagueId],
      queryFn: () => fetchLeagueDraftAnalysis(leagueId),
      enabled: !!userId && leagues.length > 0,
      staleTime: 1000 * 60 * 30,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);

  if (!userId || leagues.length === 0) {
    return { totalPicks: 0, totalWAR: 0, totalSurplus: 0, overallGrade: '—', overallGradeColor: 'text-gray-500', hitRate: 0, bustRate: 0, perLeague: [], bestPickAllTime: null, worstPickAllTime: null, isLoading: false, hasData: false };
  }

  if (isLoading) {
    return { totalPicks: 0, totalWAR: 0, totalSurplus: 0, overallGrade: '—', overallGradeColor: 'text-gray-500', hitRate: 0, bustRate: 0, perLeague: [], bestPickAllTime: null, worstPickAllTime: null, isLoading: true, hasData: false };
  }

  const perLeague: PerLeagueDraftSummary[] = [];
  let totalPicks = 0;
  let totalWAR = 0;
  let totalSurplus = 0;
  let totalHits = 0;
  let totalBusts = 0;
  let totalPicksForRates = 0;
  const percentiles: number[] = [];
  let bestPick: { pick: AnalyzedPick; leagueName: string } | null = null;
  let worstPick: { pick: AnalyzedPick; leagueName: string } | null = null;

  for (let i = 0; i < leagues.length; i++) {
    const { leagueId, leagueName } = leagues[i];
    const data = queries[i]?.data;
    if (!data) continue;

    const summary: ManagerDraftSummary | undefined = data.managerSummaries.get(userId);
    if (!summary) continue;

    const picks = summary.draftClasses.flatMap((dc) => dc.picks);
    totalPicks += picks.length;
    totalWAR += summary.totalWAR;
    totalSurplus += summary.totalSurplus;
    totalHits += Math.round(summary.hitRate * picks.length);
    totalBusts += Math.round(summary.bustRate * picks.length);
    totalPicksForRates += picks.length;
    percentiles.push(summary.surplusPercentile);

    perLeague.push({
      leagueId,
      leagueName,
      grade: summary.grade,
      gradeColor: summary.gradeColor,
      totalWAR: summary.totalWAR,
      totalSurplus: summary.totalSurplus,
      hitRate: summary.hitRate,
      bustRate: summary.bustRate,
      bestPick: summary.bestPick,
      worstPick: summary.worstPick,
    });

    if (summary.bestPick) {
      if (!bestPick || summary.bestPick.surplus > bestPick.pick.surplus) {
        bestPick = { pick: summary.bestPick, leagueName };
      }
    }
    if (summary.worstPick) {
      if (!worstPick || summary.worstPick.surplus < worstPick.pick.surplus) {
        worstPick = { pick: summary.worstPick, leagueName };
      }
    }
  }

  const { grade: overallGrade, gradeColor: overallGradeColor } = computeOverallGrade(percentiles);
  const hitRate = totalPicksForRates > 0 ? totalHits / totalPicksForRates : 0;
  const bustRate = totalPicksForRates > 0 ? totalBusts / totalPicksForRates : 0;

  return {
    totalPicks,
    totalWAR,
    totalSurplus,
    overallGrade,
    overallGradeColor,
    hitRate,
    bustRate,
    perLeague: perLeague.sort((a, b) => b.totalWAR - a.totalWAR),
    bestPickAllTime: bestPick,
    worstPickAllTime: worstPick,
    isLoading: false,
    hasData: perLeague.length > 0,
  };
}

// ────────────────────────────────────────────────────────────
// useCrossLeagueRosters
// ────────────────────────────────────────────────────────────

export function useCrossLeagueRosters(
  userId: string | undefined,
  leagues: LeagueRef[],
): CrossLeagueRosterData {
  const stableKey = leagues.map((l) => l.leagueId).sort().join(',');

  const result = useQuery({
    queryKey: ['cross-league-rosters', userId, stableKey],
    queryFn: async (): Promise<PlayerHolding[]> => {
      if (!userId || leagues.length === 0) return [];

      // Fetch rosters and player data in parallel
      const [allPlayersRaw, ...rosterResults] = await Promise.all([
        sleeperApi.getAllPlayers(),
        ...leagues.map(({ leagueId }) => sleeperApi.getRosters(leagueId)),
      ]);

      const playerMap = new Map<string, { name: string; position: string; team: string | null }>();
      for (const [id, p] of Object.entries(allPlayersRaw)) {
        if (p.first_name && p.last_name) {
          playerMap.set(id, {
            name: `${p.first_name} ${p.last_name}`,
            position: p.position ?? 'N/A',
            team: p.team ?? null,
          });
        }
      }

      // Aggregate player holdings across leagues
      const holdingsMap = new Map<string, PlayerHolding>();

      for (let i = 0; i < leagues.length; i++) {
        const { leagueId, leagueName } = leagues[i];
        const rosters = rosterResults[i] as Awaited<ReturnType<typeof sleeperApi.getRosters>>;
        const userRoster = rosters.find((r) => r.owner_id === userId);
        if (!userRoster || !userRoster.players) continue;

        for (const playerId of userRoster.players) {
          const info = playerMap.get(playerId);
          if (!info) continue;

          const existing = holdingsMap.get(playerId);
          if (existing) {
            existing.leagueIds.push(leagueId);
            existing.leagueNames.push(leagueName);
            existing.shares++;
          } else {
            holdingsMap.set(playerId, {
              playerId,
              playerName: info.name,
              position: info.position,
              team: info.team,
              leagueIds: [leagueId],
              leagueNames: [leagueName],
              shares: 1,
            });
          }
        }
      }

      // Sort: multi-league first, then by position group, then alphabetically
      const posOrder: Record<string, number> = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5, DST: 5 };
      return [...holdingsMap.values()].sort((a, b) => {
        if (b.shares !== a.shares) return b.shares - a.shares;
        const posA = posOrder[a.position] ?? 6;
        const posB = posOrder[b.position] ?? 6;
        if (posA !== posB) return posA - posB;
        return a.playerName.localeCompare(b.playerName);
      });
    },
    enabled: !!userId && leagues.length > 0,
    staleTime: 1000 * 60 * 15,
  });

  return {
    players: result.data ?? [],
    isLoading: result.isLoading,
  };
}
