'use client';

import { useMemo } from 'react';
import { ArrowLeftRight, TrendingUp, TrendingDown, Target } from 'lucide-react';
import type { LeagueTradeAnalysis, AnalyzedTrade, TradeSide } from '../types/trade';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';

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

function resultBadge(netValue: number, hasUnresolved: boolean): { text: string; className: string } {
  if (hasUnresolved) return { text: 'Pending', className: 'bg-yellow-900/30 text-yellow-400 border-yellow-700/40' };
  if (netValue > 0) return { text: 'Win', className: 'bg-green-900/30 text-green-400 border-green-700/40' };
  if (netValue < 0) return { text: 'Loss', className: 'bg-red-900/30 text-red-400 border-red-700/40' };
  return { text: 'Even', className: 'bg-gray-800/50 text-gray-400 border-gray-700/40' };
}

function TradeDetailCard({ trade, side, label, icon: Icon, borderClass }: {
  trade: AnalyzedTrade;
  side: TradeSide;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  borderClass: string;
}) {
  const otherSide = trade.sides.find((s) => s.userId !== side.userId);

  return (
    <div className={`rounded-2xl p-4 border ${borderClass}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} className="opacity-70" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground mb-1">
            vs {otherSide?.displayName ?? '?'} · {trade.season} Wk{trade.week}
          </div>
          <div className="space-y-0.5">
            {side.assetsReceived.slice(0, 2).map((a) => (
              <div key={a.playerId} className="flex items-center gap-1 text-sm">
                <span className={`text-xs font-semibold ${POSITION_COLORS[a.position] ?? 'text-gray-400'}`}>{a.position}</span>
                <span className="text-gray-200 truncate">{a.playerName}</span>
              </div>
            ))}
            {side.picksReceived.slice(0, 1).map((p, i) => (
              <div key={i} className="text-sm text-yellow-400">{p.season} Rd{p.round} Pick</div>
            ))}
            {side.assetsReceived.length + side.picksReceived.length > 3 && (
              <div className="text-xs text-gray-500">+{side.assetsReceived.length + side.picksReceived.length - 3} more</div>
            )}
          </div>
        </div>
        <div className={`text-lg font-bold tabular-nums flex-shrink-0 ${valueColor(side.netValue)}`}>
          {valueLabel(side.netValue)}
        </div>
      </div>
    </div>
  );
}

interface TradingTabProps {
  userId: string;
  analysis: LeagueTradeAnalysis;
}

export function TradingTab({ userId, analysis }: TradingTabProps) {
  const summary = analysis.managerSummaries.get(userId);

  const tradeRows = useMemo(() => {
    if (!summary) return [];
    return summary.trades.map((trade) => {
      const side = trade.sides.find((s) => s.userId === userId)!;
      return { trade, side };
    });
  }, [summary, userId]);

  if (!analysis.hasData || !summary) {
    return (
      <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
        <div className="text-2xl mb-3"><ArrowLeftRight size={28} className="mx-auto text-gray-600" /></div>
        <div className="text-sm font-medium text-gray-300">No trade data available</div>
        <div className="text-xs text-gray-500 mt-1">
          Trade analysis requires completed trades in this league&apos;s history.
        </div>
      </div>
    );
  }

  const totalManagers = analysis.managerSummaries.size;

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="bg-card-bg border border-card-border rounded-2xl p-5">
        <div className="flex items-start gap-4">
          {/* Grade badge */}
          <div className="flex-shrink-0 text-center">
            <div className={`text-5xl font-black leading-none ${summary.gradeColor}`}>
              {summary.grade}
            </div>
            <div className="text-xs text-gray-500 mt-1">Trade Grade</div>
          </div>

          {/* Stats grid */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
            <div>
              <div className={`text-xl font-bold tabular-nums ${valueColor(summary.totalNetValue)}`}>
                {valueLabel(summary.totalNetValue)}
              </div>
              <div className="text-xs text-gray-500">Total Net Value</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white tabular-nums">
                {(summary.tradeWinRate * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500">Win Rate</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white tabular-nums">
                #{summary.leagueRank} <span className="text-sm font-normal text-gray-500">/ {totalManagers}</span>
              </div>
              <div className="text-xs text-gray-500">League Rank</div>
            </div>
            <div>
              <div className={`text-base font-bold tabular-nums ${valueColor(summary.avgValuePerTrade)}`}>
                {valueLabel(summary.avgValuePerTrade)}
              </div>
              <div className="text-xs text-gray-500">Avg/Trade</div>
            </div>
            <div>
              <div className="text-base font-bold text-white tabular-nums">
                {summary.totalTrades}
              </div>
              <div className="text-xs text-gray-500">Total Trades</div>
            </div>
            {summary.mostFrequentPartner && (
              <div>
                <div className="text-base font-bold text-white truncate">
                  {summary.mostFrequentPartner.displayName}
                </div>
                <div className="text-xs text-gray-500">Favorite Partner ({summary.mostFrequentPartner.count})</div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-600">
          Net value = post-trade fantasy points of assets received minus assets sent. Picks are resolved to drafted player season points.
        </div>
      </div>

      {/* Biggest Win / Biggest Loss */}
      {(summary.biggestWin || summary.biggestLoss) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {summary.biggestWin && (() => {
            const side = summary.biggestWin!.trade.sides.find((s) => s.userId === userId)!;
            return (
              <TradeDetailCard
                trade={summary.biggestWin!.trade}
                side={side}
                label="Best Trade"
                icon={TrendingUp}
                borderClass="bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              />
            );
          })()}
          {summary.biggestLoss && summary.biggestLoss.trade.transactionId !== summary.biggestWin?.trade.transactionId && (() => {
            const side = summary.biggestLoss!.trade.sides.find((s) => s.userId === userId)!;
            return (
              <TradeDetailCard
                trade={summary.biggestLoss!.trade}
                side={side}
                label="Worst Trade"
                icon={TrendingDown}
                borderClass="bg-red-500/10 border-red-500/30 text-red-400"
              />
            );
          })()}
        </div>
      )}

      {/* Trade History Table */}
      {tradeRows.length > 0 && (
        <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
          <div className="px-5 pt-4 pb-3 flex items-center gap-2">
            <Target size={15} className="text-gray-400" />
            <span className="font-semibold text-white text-sm">Trade History</span>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
                  <TableHead className="text-left py-2.5 px-5">Season</TableHead>
                  <TableHead className="text-left py-2.5 px-3">Received</TableHead>
                  <TableHead className="text-left py-2.5 px-3">Sent</TableHead>
                  <TableHead className="text-right py-2.5 px-3">Net Value</TableHead>
                  <TableHead className="text-center py-2.5 px-3">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tradeRows.map(({ trade, side }) => {
                  const badge = resultBadge(side.netValue, trade.hasUnresolved);
                  return (
                    <TableRow key={trade.transactionId} className="border-b border-gray-800/60 hover:bg-gray-800/20">
                      <TableCell className="py-3 px-5 font-medium text-white whitespace-nowrap">
                        {trade.season} <span className="text-gray-500 font-normal">Wk{trade.week}</span>
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        <div className="space-y-0.5">
                          {side.assetsReceived.map((a) => (
                            <div key={a.playerId} className="flex items-center gap-1">
                              <span className={`text-xs font-semibold ${POSITION_COLORS[a.position] ?? 'text-gray-400'}`}>{a.position}</span>
                              <span className="text-sm text-gray-200 truncate">{a.playerName}</span>
                            </div>
                          ))}
                          {side.picksReceived.map((p, i) => (
                            <div key={i} className="text-sm text-yellow-400">{p.season} Rd{p.round}</div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        <div className="space-y-0.5">
                          {side.assetsSent.map((a) => (
                            <div key={a.playerId} className="flex items-center gap-1">
                              <span className={`text-xs font-semibold ${POSITION_COLORS[a.position] ?? 'text-gray-400'}`}>{a.position}</span>
                              <span className="text-sm text-gray-200 truncate">{a.playerName}</span>
                            </div>
                          ))}
                          {side.picksSent.map((p, i) => (
                            <div key={i} className="text-sm text-yellow-400">{p.season} Rd{p.round}</div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className={`py-3 px-3 text-right font-bold tabular-nums ${valueColor(side.netValue)}`}>
                        {valueLabel(side.netValue)}
                      </TableCell>
                      <TableCell className="py-3 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${badge.className}`}>
                          {badge.text}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-800">
            {tradeRows.map(({ trade, side }) => {
              const badge = resultBadge(side.netValue, trade.hasUnresolved);
              const otherSide = trade.sides.find((s) => s.userId !== userId);
              return (
                <div key={trade.transactionId} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">
                      {trade.season} Wk{trade.week}
                    </span>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${badge.className}`}>
                      {badge.text}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">vs {otherSide?.displayName ?? '?'}</div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Received</div>
                      {side.assetsReceived.map((a) => (
                        <div key={a.playerId} className="flex items-center gap-1">
                          <span className={`text-xs font-semibold ${POSITION_COLORS[a.position] ?? 'text-gray-400'}`}>{a.position}</span>
                          <span className="text-xs text-gray-200 truncate">{a.playerName}</span>
                        </div>
                      ))}
                      {side.picksReceived.map((p, i) => (
                        <div key={i} className="text-xs text-yellow-400">{p.season} Rd{p.round}</div>
                      ))}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Sent</div>
                      {side.assetsSent.map((a) => (
                        <div key={a.playerId} className="flex items-center gap-1">
                          <span className={`text-xs font-semibold ${POSITION_COLORS[a.position] ?? 'text-gray-400'}`}>{a.position}</span>
                          <span className="text-xs text-gray-200 truncate">{a.playerName}</span>
                        </div>
                      ))}
                      {side.picksSent.map((p, i) => (
                        <div key={i} className="text-xs text-yellow-400">{p.season} Rd{p.round}</div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <span className={`text-sm font-bold tabular-nums ${valueColor(side.netValue)}`}>
                      {valueLabel(side.netValue)} pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
