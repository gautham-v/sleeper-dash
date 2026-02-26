'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, ArrowDown, Crown, Trophy } from 'lucide-react';
import { MetricTooltip } from '@/components/MetricTooltip';
import { useLeagueTradeHistory } from '../hooks/useLeagueTradeHistory';
import { assignGrade } from '../utils/draftCalculations';
import { Avatar } from './Avatar';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import type { AnalyzedTrade, TradeDraftPickAsset } from '../types/trade';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { SegmentedControl } from '@/components/ui/segmented-control';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const POSITION_COLORS: Record<string, string> = {
  QB: 'text-red-400',
  RB: 'text-green-400',
  WR: 'text-blue-400',
  TE: 'text-yellow-400',
  K: 'text-gray-400',
  DEF: 'text-purple-400',
  DST: 'text-purple-400',
};

function valueColor(v: number): string {
  if (v > 0) return 'text-green-400';
  if (v < 0) return 'text-red-400';
  return 'text-gray-400';
}

function valueLabel(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(1);
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PickDisplay({ p, rtl }: { p: TradeDraftPickAsset; rtl?: boolean }) {
  const pickLabel = p.pickInRound !== null
    ? `${p.season} ${p.round}.${String(p.pickInRound).padStart(2, '0')}`
    : `${p.season} Rd${p.round}`;
  if (p.status === 'resolved' && p.draftedPlayerName) {
    return (
      <div className={`flex items-center gap-1 text-sm flex-wrap ${rtl ? 'justify-end' : ''}`}>
        {p.draftedPlayerPosition && (
          <span className={`text-[10px] font-bold ${POSITION_COLORS[p.draftedPlayerPosition] ?? 'text-gray-400'}`}>
            {p.draftedPlayerPosition}
          </span>
        )}
        <span className="text-yellow-400 text-xs shrink-0">{pickLabel}</span>
        <span className="text-gray-500 text-xs">({p.draftedPlayerName})</span>
      </div>
    );
  }
  return <div className="text-sm text-yellow-400">{pickLabel}</div>;
}

function TradeCard({ trade, highlightUserId }: { trade: AnalyzedTrade; highlightUserId?: string }) {
  const side = highlightUserId
    ? trade.sides.find((s) => s.userId === highlightUserId) ?? trade.sides[0]
    : trade.sides[0];
  const otherSide = trade.sides.find((s) => s.userId !== side.userId) ?? trade.sides[1];

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <ArrowLeftRight size={12} />
        <span>{trade.season} Wk{trade.week} · {formatTimestamp(trade.timestamp)}</span>
        {trade.hasUnresolved ? (
          <span className="text-yellow-500 ml-auto">Pending</span>
        ) : (() => {
          const winner = trade.sides.reduce((a, b) => a.netValue > b.netValue ? a : b);
          return winner.netValue > 0 ? (
            <span className="ml-auto flex items-center gap-1 text-emerald-400">
              <Crown size={10} />
              {winner.displayName}
            </span>
          ) : null;
        })()}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
        <div>
          <div className="text-xs text-gray-500 mb-1">{side.displayName} receives</div>
          <div className="space-y-0.5">
            {side.assetsReceived.map((a) => (
              <div key={a.playerId} className="flex items-center gap-1 text-sm">
                <span className={`text-xs font-semibold ${POSITION_COLORS[a.position] ?? 'text-gray-400'}`}>{a.position}</span>
                <span className="text-gray-200 truncate">{a.playerName}</span>
              </div>
            ))}
            {side.picksReceived.map((p, i) => (
              <div key={i}><PickDisplay p={p} /></div>
            ))}
            {side.assetsReceived.length === 0 && side.picksReceived.length === 0 && (
              <div className="text-xs text-gray-600">—</div>
            )}
          </div>
        </div>
        <div className="self-center text-gray-600"><ArrowLeftRight size={14} /></div>
        <div className="text-right">
          <div className="text-xs text-gray-500 mb-1">{otherSide?.displayName ?? '?'} receives</div>
          <div className="space-y-0.5">
            {otherSide?.assetsReceived.map((a) => (
              <div key={a.playerId} className="flex items-center gap-1 text-sm justify-end">
                <span className="text-gray-200 truncate">{a.playerName}</span>
                <span className={`text-xs font-semibold ${POSITION_COLORS[a.position] ?? 'text-gray-400'}`}>{a.position}</span>
              </div>
            ))}
            {otherSide?.picksReceived.map((p, i) => (
              <div key={i}><PickDisplay p={p} rtl /></div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-800 flex justify-between items-center">
        <span className="text-xs text-gray-500">Net value for {side.displayName}</span>
        <span className={`text-sm font-bold tabular-nums ${valueColor(side.netValue)}`}>
          {valueLabel(side.netValue)} pts
        </span>
      </div>
    </div>
  );
}

function ImpactfulTradeCard({
  trade,
  winnerSide,
  loserSide,
  maxVal,
  rank,
}: {
  trade: AnalyzedTrade;
  winnerSide: AnalyzedTrade['sides'][number];
  loserSide: AnalyzedTrade['sides'][number];
  maxVal: number;
  rank: number;
}) {
  const rankEmoji = rank === 0 ? '🥇' : rank === 1 ? '🥈' : '🥉';
  return (
    <div className="bg-card-bg border border-card-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span>{rankEmoji}</span>
          {trade.season} Wk{trade.week}
        </span>
        <span>{formatTimestamp(trade.timestamp)}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
        <div>
          <div className="flex items-center gap-1 mb-1">
            <Crown size={10} className="text-yellow-400 shrink-0" />
            <span className="text-[11px] font-semibold text-emerald-400 truncate">{winnerSide.displayName}</span>
          </div>
          <div className="text-[11px] text-gray-500 mb-0.5">received</div>
          <div className="space-y-0.5">
            {winnerSide.assetsReceived.map((a) => (
              <div key={a.playerId} className="flex items-center gap-0.5 text-xs">
                <span className={`font-bold ${POSITION_COLORS[a.position] ?? 'text-gray-400'}`}>{a.position}</span>
                <span className="text-gray-300">{a.playerName}</span>
              </div>
            ))}
            {winnerSide.picksReceived.map((p, i) => (
              <div key={i}><PickDisplay p={p} /></div>
            ))}
            {winnerSide.assetsReceived.length === 0 && winnerSide.picksReceived.length === 0 && (
              <div className="text-xs text-gray-600">—</div>
            )}
          </div>
        </div>
        <div className="self-center text-gray-700"><ArrowLeftRight size={13} /></div>
        <div className="text-right">
          <div className="flex items-center gap-1 mb-1 justify-end">
            <ArrowDown size={10} className="text-red-400 shrink-0" />
            <span className="text-[11px] font-semibold text-red-400 truncate">{loserSide.displayName}</span>
          </div>
          <div className="text-[11px] text-gray-500 mb-0.5">received</div>
          <div className="space-y-0.5">
            {loserSide.assetsReceived.map((a) => (
              <div key={a.playerId} className="flex items-center gap-0.5 text-xs justify-end">
                <span className="text-gray-300">{a.playerName}</span>
                <span className={`font-bold ${POSITION_COLORS[a.position] ?? 'text-gray-400'}`}>{a.position}</span>
              </div>
            ))}
            {loserSide.picksReceived.map((p, i) => (
              <div key={i} className="flex justify-end"><PickDisplay p={p} rtl /></div>
            ))}
            {loserSide.assetsReceived.length === 0 && loserSide.picksReceived.length === 0 && (
              <div className="text-xs text-gray-600 text-right">—</div>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-card-border/50 pt-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">Net Impact</span>
        <span className="text-sm font-bold text-emerald-400 tabular-nums">+{maxVal.toFixed(1)} pts</span>
      </div>
    </div>
  );
}

const TRADES_PER_PAGE = 10;

type SortOption = 'recent' | 'most-impactful' | 'least-impactful';

const TAB_ITEMS = [
  { value: 'leaderboard', label: 'Leaderboard' },
  { value: 'all-trades', label: 'All Trades' },
];

export function LeagueTrades({ leagueId }: { leagueId: string }) {
  const { data: analysis, isLoading } = useLeagueTradeHistory(leagueId);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'all-trades'>('leaderboard');
  const [leaderboardSeason, setLeaderboardSeason] = useState<string>('all');
  const [seasonFilter, setSeasonFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const seasonFilterInitialized = useRef(false);

  const availableSeasons = useMemo(() => {
    if (!analysis) return [];
    const seasons = [...new Set(analysis.allTrades.map(t => t.season))];
    return seasons.sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  }, [analysis]);

  // Default All Trades filter to most recent season on first load
  useEffect(() => {
    if (!seasonFilterInitialized.current && availableSeasons.length > 0) {
      seasonFilterInitialized.current = true;
      setSeasonFilter(availableSeasons[0]);
    }
  }, [availableSeasons]);

  const leaderboardSeasonTrades = useMemo(() => {
    if (!analysis) return [];
    if (leaderboardSeason === 'all') return analysis.allTrades;
    return analysis.allTrades.filter(t => t.season === leaderboardSeason);
  }, [analysis, leaderboardSeason]);

  const leaderboard = useMemo(() => {
    if (!analysis) return [];
    if (leaderboardSeason === 'all') {
      return [...analysis.managerSummaries.values()].sort((a, b) => b.totalNetValue - a.totalNetValue);
    }
    // Derive per-manager stats from season-filtered trades
    const managerMap = new Map<string, {
      userId: string; displayName: string; avatar: string | null;
      totalNetValue: number; wins: number; totalTrades: number;
    }>();
    for (const trade of leaderboardSeasonTrades) {
      for (const side of trade.sides) {
        let entry = managerMap.get(side.userId);
        if (!entry) {
          entry = {
            userId: side.userId,
            displayName: side.displayName,
            avatar: analysis.managerSummaries.get(side.userId)?.avatar ?? null,
            totalNetValue: 0, wins: 0, totalTrades: 0,
          };
          managerMap.set(side.userId, entry);
        }
        entry.totalNetValue += side.netValue;
        entry.totalTrades += 1;
        if (side.netValue > 0) entry.wins += 1;
      }
    }
    const entries = [...managerMap.values()];
    const sortedValues = entries.map(e => e.totalNetValue).sort((a, b) => a - b);
    return entries.map(entry => {
      const rank = sortedValues.filter(v => v < entry.totalNetValue).length;
      const netValuePercentile = sortedValues.length > 1 ? (rank / (sortedValues.length - 1)) * 100 : 50;
      const { grade, gradeColor } = assignGrade(netValuePercentile);
      return {
        ...entry,
        tradeWinRate: entry.totalTrades > 0 ? entry.wins / entry.totalTrades : 0,
        avgValuePerTrade: entry.totalTrades > 0 ? entry.totalNetValue / entry.totalTrades : 0,
        grade,
        gradeColor,
      };
    }).sort((a, b) => b.totalNetValue - a.totalNetValue);
  }, [analysis, leaderboardSeason, leaderboardSeasonTrades]);

  const top3ActiveTraders = useMemo(() => {
    if (!analysis) return [];
    if (leaderboardSeason === 'all') {
      return [...analysis.managerSummaries.values()]
        .sort((a, b) => b.totalTrades - a.totalTrades)
        .slice(0, 3);
    }
    const tradeCountMap = new Map<string, { userId: string; displayName: string; avatar: string | null; totalTrades: number }>();
    for (const trade of leaderboardSeasonTrades) {
      for (const side of trade.sides) {
        const entry = tradeCountMap.get(side.userId) ?? {
          userId: side.userId,
          displayName: side.displayName,
          avatar: analysis.managerSummaries.get(side.userId)?.avatar ?? null,
          totalTrades: 0,
        };
        entry.totalTrades += 1;
        tradeCountMap.set(side.userId, entry);
      }
    }
    return [...tradeCountMap.values()]
      .sort((a, b) => b.totalTrades - a.totalTrades)
      .slice(0, 3);
  }, [analysis, leaderboardSeason, leaderboardSeasonTrades]);

  const top3ImpactfulTrades = useMemo(() => {
    if (!analysis) return [];
    return [...leaderboardSeasonTrades]
      .map(trade => {
        const maxVal = Math.max(...trade.sides.map(s => Math.abs(s.netValue)));
        const winnerSide = trade.sides.find(s => s.netValue >= 0) ?? trade.sides[0];
        const loserSide = trade.sides.find(s => s !== winnerSide) ?? trade.sides[1];
        return { trade, winnerSide, loserSide, maxVal };
      })
      .sort((a, b) => b.maxVal - a.maxVal)
      .slice(0, 3);
  }, [analysis, leaderboardSeasonTrades]);

  const filteredTrades = useMemo(() => {
    if (!analysis) return [];
    const trades = seasonFilter === 'all'
      ? analysis.allTrades
      : analysis.allTrades.filter(t => t.season === seasonFilter);
    if (sortOption === 'most-impactful') {
      return [...trades].sort((a, b) => {
        const aMax = Math.max(...a.sides.map(s => Math.abs(s.netValue)));
        const bMax = Math.max(...b.sides.map(s => Math.abs(s.netValue)));
        return bMax - aMax;
      });
    }
    if (sortOption === 'least-impactful') {
      return [...trades].sort((a, b) => {
        const aMax = Math.max(...a.sides.map(s => Math.abs(s.netValue)));
        const bMax = Math.max(...b.sides.map(s => Math.abs(s.netValue)));
        return aMax - bMax;
      });
    }
    // 'recent' — preserve original order (already sorted by timestamp desc from the hook)
    return trades;
  }, [analysis, seasonFilter, sortOption]);

  const handleSelectManager = (userId: string) => {
    router.push(`/league/${leagueId}/managers/${userId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-card-bg border border-card-border rounded-2xl h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!analysis?.hasData) {
    return (
      <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
        <div className="text-2xl mb-3"><ArrowLeftRight size={32} className="mx-auto text-gray-600" /></div>
        <div className="text-sm font-medium text-gray-300">No trades found</div>
        <div className="text-xs text-gray-500 mt-1">
          Trade analysis requires completed trades in your league history.
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(filteredTrades.length / TRADES_PER_PAGE);
  const pagedTrades = filteredTrades.slice(
    (currentPage - 1) * TRADES_PER_PAGE,
    currentPage * TRADES_PER_PAGE,
  );

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | 'ellipsis')[] = [1];
    if (currentPage > 3) pages.push('ellipsis');
    for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) {
      pages.push(p);
    }
    if (currentPage < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="space-y-6">
      {/* Controls row: tab strip + optional filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SegmentedControl
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'leaderboard' | 'all-trades')}
          items={TAB_ITEMS}
        />
        {activeTab === 'leaderboard' && availableSeasons.length > 0 && (
          <Select value={leaderboardSeason} onValueChange={setLeaderboardSeason}>
            <SelectTrigger className="h-8 text-xs w-[120px]">
              <SelectValue placeholder="Season" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All-Time</SelectItem>
              {availableSeasons.map(season => (
                <SelectItem key={season} value={season}>{season}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {activeTab === 'all-trades' && (
          <div className="flex items-center gap-2">
            {availableSeasons.length > 0 && (
              <Select value={seasonFilter} onValueChange={(v) => { setSeasonFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="h-8 text-xs w-[120px]">
                  <SelectValue placeholder="Season" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All-Time</SelectItem>
                  {availableSeasons.map(season => (
                    <SelectItem key={season} value={season}>{season}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={sortOption} onValueChange={(v) => { setSortOption(v as SortOption); setCurrentPage(1); }}>
              <SelectTrigger className="h-8 text-xs w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="most-impactful">Most Impactful</SelectItem>
                <SelectItem value="least-impactful">Least Impactful</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ── Leaderboard tab ── */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-6">
          {/* Most Active Traders */}
          {top3ActiveTraders.length > 0 && (
            <div className="bg-card-bg border border-card-border rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Crown size={13} className="text-gray-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Most Active Traders</span>
              </div>
              <div className="flex flex-wrap gap-4">
                {top3ActiveTraders.map((manager, idx) => {
                  const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
                  return (
                    <div key={manager.userId} className="flex items-center gap-2 flex-1 min-w-[160px]">
                      <span className="text-sm w-5 shrink-0">{rankEmoji}</span>
                      <Avatar avatar={manager.avatar} name={manager.displayName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{manager.displayName}</div>
                      </div>
                      <div className="text-sm text-gray-400 shrink-0 tabular-nums">{manager.totalTrades} trades</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top 3 Most Impactful Trades (all-time) */}
          {top3ImpactfulTrades.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <ArrowLeftRight size={13} className="text-gray-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Top 3 Most Impactful Trades</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {top3ImpactfulTrades.map(({ trade, winnerSide, loserSide, maxVal }, idx) => (
                  <ImpactfulTradeCard
                    key={trade.transactionId}
                    trade={trade}
                    winnerSide={winnerSide}
                    loserSide={loserSide}
                    maxVal={maxVal}
                    rank={idx}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Trade Intelligence Leaderboard */}
          <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
            <div className="px-5 pt-4 pb-3 flex items-center gap-2">
              <Trophy size={15} className="text-gray-400" />
              <span className="font-semibold text-white text-sm">Trade Intelligence Leaderboard</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
                  <TableHead className="text-left py-2.5 px-2 sm:px-4 w-6 sm:w-8 shrink-0">#</TableHead>
                  <TableHead className="text-left py-2.5 px-2 sm:px-3 w-full">Manager</TableHead>
                  <TableHead className="text-center py-2.5 px-2 sm:px-3 shrink-0"><span className="flex items-center gap-1 justify-center">Grade <MetricTooltip metricKey="grade" side="bottom" /></span></TableHead>
                  <TableHead className="text-right py-2.5 px-2 sm:px-3 shrink-0 whitespace-nowrap"><span className="flex items-center gap-1 justify-end"><span className="hidden xs:inline">Net </span>Value <MetricTooltip metricKey="netValue" side="bottom" /></span></TableHead>
                  <TableHead className="text-center py-2.5 px-3 hidden sm:table-cell"><span className="flex items-center gap-1 justify-center">Win Rate <MetricTooltip metricKey="winRate" side="bottom" /></span></TableHead>
                  <TableHead className="text-center py-2.5 px-3 hidden sm:table-cell">Trades</TableHead>
                  <TableHead className="text-right py-2.5 px-3 hidden md:table-cell">Avg/Trade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((summary, idx) => (
                  <TableRow key={summary.userId} className="border-b border-gray-800/60 hover:bg-gray-800/20">
                    <TableCell className="py-3 px-2 sm:px-4 text-gray-500 tabular-nums shrink-0">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </TableCell>
                    <TableCell className="py-3 px-2 sm:px-3 w-full min-w-0">
                      <button
                        className="flex items-center gap-2 text-left group min-w-0 w-full"
                        onClick={() => handleSelectManager(summary.userId)}
                      >
                        <Avatar avatar={summary.avatar} name={summary.displayName} size="sm" />
                        <span className="font-medium text-white text-sm group-hover:text-brand-cyan transition-colors truncate min-w-0">
                          {summary.displayName}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="py-3 px-2 sm:px-3 text-center shrink-0">
                      <span className={`text-lg font-black ${summary.gradeColor}`}>{summary.grade}</span>
                    </TableCell>
                    <TableCell className={`py-3 px-2 sm:px-3 text-right font-bold tabular-nums shrink-0 ${valueColor(summary.totalNetValue)}`}>
                      {valueLabel(summary.totalNetValue)}
                    </TableCell>
                    <TableCell className="py-3 px-3 text-center tabular-nums text-gray-400 hidden sm:table-cell">
                      {(summary.tradeWinRate * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="py-3 px-3 text-center tabular-nums text-gray-400 hidden sm:table-cell">
                      {summary.totalTrades}
                    </TableCell>
                    <TableCell className={`py-3 px-3 text-right tabular-nums hidden md:table-cell ${valueColor(summary.avgValuePerTrade)}`}>
                      {valueLabel(summary.avgValuePerTrade)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-600">
              Net value = post-trade fantasy points received minus sent. Grade based on total net value percentile.
            </div>
          </div>
        </div>
      )}

      {/* ── All Trades tab ── */}
      {activeTab === 'all-trades' && (
        <div className="space-y-6">
          {/* Paginated All Trades list */}
          {filteredTrades.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ArrowLeftRight size={15} className="text-gray-400" />
                <span className="font-semibold text-white text-sm">All Trades</span>
                <span className="text-xs text-gray-500">({filteredTrades.length})</span>
              </div>
              <div className="space-y-3">
                {pagedTrades.map((trade) => (
                  <TradeCard key={trade.transactionId} trade={trade} />
                ))}
              </div>
              {totalPages > 1 && (
                <Pagination className="mt-4">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      />
                    </PaginationItem>
                    {getPageNumbers().map((p, i) =>
                      p === 'ellipsis' ? (
                        <PaginationItem key={`ellipsis-${i}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink
                            isActive={p === currentPage}
                            onClick={() => setCurrentPage(p)}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}

          {filteredTrades.length === 0 && (
            <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
              <div className="text-sm font-medium text-gray-300">No trades for this season</div>
              <div className="text-xs text-gray-500 mt-1">Try selecting a different season filter.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
