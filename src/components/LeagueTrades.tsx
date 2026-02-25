'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Crown, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { useLeagueTradeHistory } from '../hooks/useLeagueTradeHistory';
import { Avatar } from './Avatar';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import type { AnalyzedTrade } from '../types/trade';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';

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
        {trade.hasUnresolved && (
          <span className="text-yellow-500 ml-auto">Pending</span>
        )}
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
              <div key={i} className="text-sm text-yellow-400">{p.season} Rd{p.round} Pick</div>
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
              <div key={i} className="text-sm text-yellow-400">{p.season} Rd{p.round} Pick</div>
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

const TRADES_PER_PAGE = 10;

export function LeagueTrades({ leagueId }: { leagueId: string }) {
  const { data: analysis, isLoading } = useLeagueTradeHistory(leagueId);
  const router = useRouter();
  const [tradePage, setTradePage] = useState(1);

  const leaderboard = useMemo(() => {
    if (!analysis) return [];
    return [...analysis.managerSummaries.values()].sort((a, b) => b.totalNetValue - a.totalNetValue);
  }, [analysis]);

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

  return (
    <div className="space-y-6">
      {/* ── Top highlights ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Most Active Trader */}
        {analysis.mostActiveTrader && (() => {
          const summary = analysis.managerSummaries.get(analysis.mostActiveTrader!.userId);
          return (
            <div className="bg-card-bg border border-card-border rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Crown size={13} className="text-gray-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Most Active Trader</span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <Avatar avatar={summary?.avatar ?? null} name={analysis.mostActiveTrader!.displayName} size="md" />
                <div>
                  <div className="font-semibold text-white text-sm">{analysis.mostActiveTrader!.displayName}</div>
                  <div className="text-sm text-gray-400">{analysis.mostActiveTrader!.count} trades</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Biggest Win All-Time */}
        {analysis.biggestWinAllTime && (() => {
          const winSide = analysis.biggestWinAllTime.trade.sides.find(
            (s) => s.userId === analysis.biggestWinAllTime!.userId,
          );
          return (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={13} className="text-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Biggest Win All-Time</span>
              </div>
              <div className="font-semibold text-white text-sm">{analysis.biggestWinAllTime.displayName}</div>
              <div className="text-lg font-bold tabular-nums text-emerald-400">
                {valueLabel(analysis.biggestWinAllTime.netValue)} pts
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {analysis.biggestWinAllTime.trade.season} Week {analysis.biggestWinAllTime.trade.week}
              </div>
              {winSide && (winSide.assetsReceived.length > 0 || winSide.picksReceived.length > 0) && (
                <div className="mt-2 pt-2 border-t border-emerald-500/20 space-y-0.5">
                  <div className="text-xs text-gray-500 mb-1">Received</div>
                  {winSide.assetsReceived.slice(0, 3).map((a) => (
                    <div key={a.playerId} className="flex items-center gap-1 text-xs">
                      <span className={`font-semibold ${POSITION_COLORS[a.position] ?? 'text-gray-400'}`}>{a.position}</span>
                      <span className="text-gray-300 truncate">{a.playerName}</span>
                    </div>
                  ))}
                  {winSide.picksReceived.slice(0, 2).map((p, i) => (
                    <div key={i} className="text-xs text-yellow-400">{p.season} Rd{p.round} Pick</div>
                  ))}
                  {(winSide.assetsReceived.length + winSide.picksReceived.length) > 3 && (
                    <div className="text-xs text-gray-600">+{winSide.assetsReceived.length + winSide.picksReceived.length - 3} more</div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Biggest Loss All-Time */}
        {analysis.biggestLossAllTime && (() => {
          const lossSide = analysis.biggestLossAllTime.trade.sides.find(
            (s) => s.userId === analysis.biggestLossAllTime!.userId,
          );
          return (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown size={13} className="text-red-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-red-400">Biggest Loss All-Time</span>
              </div>
              <div className="font-semibold text-white text-sm">{analysis.biggestLossAllTime.displayName}</div>
              <div className="text-lg font-bold tabular-nums text-red-400">
                {valueLabel(analysis.biggestLossAllTime.netValue)} pts
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {analysis.biggestLossAllTime.trade.season} Week {analysis.biggestLossAllTime.trade.week}
              </div>
              {lossSide && (lossSide.assetsSent.length > 0 || lossSide.picksSent.length > 0) && (
                <div className="mt-2 pt-2 border-t border-red-500/20 space-y-0.5">
                  <div className="text-xs text-gray-500 mb-1">Gave away</div>
                  {lossSide.assetsSent.slice(0, 3).map((a) => (
                    <div key={a.playerId} className="flex items-center gap-1 text-xs">
                      <span className={`font-semibold ${POSITION_COLORS[a.position] ?? 'text-gray-400'}`}>{a.position}</span>
                      <span className="text-gray-300 truncate">{a.playerName}</span>
                    </div>
                  ))}
                  {lossSide.picksSent.slice(0, 2).map((p, i) => (
                    <div key={i} className="text-xs text-yellow-400">{p.season} Rd{p.round} Pick</div>
                  ))}
                  {(lossSide.assetsSent.length + lossSide.picksSent.length) > 3 && (
                    <div className="text-xs text-gray-600">+{lossSide.assetsSent.length + lossSide.picksSent.length - 3} more</div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Jump to All Trades anchor */}
      {analysis.allTrades.length > 0 && (
        <div className="flex justify-end">
          <a
            href="#all-trades"
            className="text-xs text-brand-cyan hover:underline flex items-center gap-1"
          >
            <ArrowLeftRight size={11} />
            Jump to All Trades ({analysis.allTrades.length})
          </a>
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
              <TableHead className="text-left py-2.5 px-5 w-8">#</TableHead>
              <TableHead className="text-left py-2.5 px-3">Manager</TableHead>
              <TableHead className="text-center py-2.5 px-3">Grade</TableHead>
              <TableHead className="text-right py-2.5 px-3">Net Value</TableHead>
              <TableHead className="text-center py-2.5 px-3 hidden sm:table-cell">Win Rate</TableHead>
              <TableHead className="text-center py-2.5 px-3 hidden sm:table-cell">Trades</TableHead>
              <TableHead className="text-right py-2.5 px-3 hidden md:table-cell">Avg/Trade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((summary, idx) => (
              <TableRow key={summary.userId} className="border-b border-gray-800/60 hover:bg-gray-800/20">
                <TableCell className="py-3 px-5 text-gray-500 tabular-nums">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                </TableCell>
                <TableCell className="py-3 px-3">
                  <button
                    className="flex items-center gap-2 text-left group"
                    onClick={() => handleSelectManager(summary.userId)}
                  >
                    <Avatar avatar={summary.avatar} name={summary.displayName} size="sm" />
                    <span className="font-medium text-white text-sm group-hover:text-brand-cyan transition-colors truncate">
                      {summary.displayName}
                    </span>
                  </button>
                </TableCell>
                <TableCell className="py-3 px-3 text-center">
                  <span className={`text-lg font-black ${summary.gradeColor}`}>{summary.grade}</span>
                </TableCell>
                <TableCell className={`py-3 px-3 text-right font-bold tabular-nums ${valueColor(summary.totalNetValue)}`}>
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

      {/* All Trades (paginated) */}
      {analysis.allTrades.length > 0 && (() => {
        const totalPages = Math.ceil(analysis.allTrades.length / TRADES_PER_PAGE);
        const pagedTrades = analysis.allTrades.slice(
          (tradePage - 1) * TRADES_PER_PAGE,
          tradePage * TRADES_PER_PAGE,
        );

        // Build page numbers with ellipsis for large sets
        const getPageNumbers = () => {
          if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
          const pages: (number | 'ellipsis')[] = [1];
          if (tradePage > 3) pages.push('ellipsis');
          for (let p = Math.max(2, tradePage - 1); p <= Math.min(totalPages - 1, tradePage + 1); p++) {
            pages.push(p);
          }
          if (tradePage < totalPages - 2) pages.push('ellipsis');
          pages.push(totalPages);
          return pages;
        };

        return (
          <div id="all-trades">
            <div className="flex items-center gap-2 mb-3">
              <ArrowLeftRight size={15} className="text-gray-400" />
              <span className="font-semibold text-white text-sm">All Trades</span>
              <span className="text-xs text-gray-500">({analysis.allTrades.length})</span>
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
                      onClick={() => setTradePage((p) => Math.max(1, p - 1))}
                      disabled={tradePage === 1}
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
                          isActive={p === tradePage}
                          onClick={() => setTradePage(p)}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setTradePage((p) => Math.min(totalPages, p + 1))}
                      disabled={tradePage === totalPages}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        );
      })()}
    </div>
  );
}
