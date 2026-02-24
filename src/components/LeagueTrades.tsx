'use client';

import { useMemo } from 'react';
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
import type { AnalyzedTrade, ManagerTradeSummary } from '../types/trade';

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

export function LeagueTrades({ leagueId }: { leagueId: string }) {
  const { data: analysis, isLoading } = useLeagueTradeHistory(leagueId);
  const router = useRouter();

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

      {/* Biggest Trades */}
      {(analysis.biggestWinAllTime || analysis.biggestLossAllTime) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {analysis.biggestWinAllTime && (
            <div className="bg-green-900/10 border border-green-700/30 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={13} className="text-green-400 opacity-70" />
                <span className="text-xs font-semibold uppercase tracking-wide text-green-400 opacity-70">Biggest Win All-Time</span>
              </div>
              <div className="font-semibold text-white text-sm">{analysis.biggestWinAllTime.displayName}</div>
              <div className={`text-lg font-bold tabular-nums ${valueColor(analysis.biggestWinAllTime.netValue)}`}>
                {valueLabel(analysis.biggestWinAllTime.netValue)} pts
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {analysis.biggestWinAllTime.trade.season} Week {analysis.biggestWinAllTime.trade.week}
              </div>
            </div>
          )}
          {analysis.biggestLossAllTime && (
            <div className="bg-red-900/10 border border-red-700/30 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown size={13} className="text-red-400 opacity-70" />
                <span className="text-xs font-semibold uppercase tracking-wide text-red-400 opacity-70">Biggest Loss All-Time</span>
              </div>
              <div className="font-semibold text-white text-sm">{analysis.biggestLossAllTime.displayName}</div>
              <div className={`text-lg font-bold tabular-nums ${valueColor(analysis.biggestLossAllTime.netValue)}`}>
                {valueLabel(analysis.biggestLossAllTime.netValue)} pts
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {analysis.biggestLossAllTime.trade.season} Week {analysis.biggestLossAllTime.trade.week}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Most Active Traders */}
      {analysis.mostActiveTrader && (
        <div className="bg-card-bg border border-card-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Crown size={15} className="text-gray-400" />
            <span className="font-semibold text-white text-sm">Most Active Trader</span>
          </div>
          <div className="flex items-center gap-3">
            {(() => {
              const summary = analysis.managerSummaries.get(analysis.mostActiveTrader!.userId);
              return (
                <>
                  <Avatar avatar={summary?.avatar ?? null} name={analysis.mostActiveTrader!.displayName} size="md" />
                  <div>
                    <div className="font-medium text-white">{analysis.mostActiveTrader!.displayName}</div>
                    <div className="text-sm text-gray-400">{analysis.mostActiveTrader!.count} trades</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Recent Trades */}
      {analysis.allTrades.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ArrowLeftRight size={15} className="text-gray-400" />
            <span className="font-semibold text-white text-sm">All Trades</span>
            <span className="text-xs text-gray-500">({analysis.allTrades.length})</span>
          </div>
          <div className="space-y-3">
            {analysis.allTrades.map((trade) => (
              <TradeCard key={trade.transactionId} trade={trade} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
