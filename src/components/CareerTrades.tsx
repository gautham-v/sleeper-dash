'use client';

import { ArrowLeftRight, TrendingUp, TrendingDown, Users, BarChart2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CrossLeagueTradeStats } from '@/hooks/useCrossLeagueAnalytics';
import type { AnalyzedTrade, TradeDraftPickAsset } from '@/types/trade';

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

function formatDate(ms: number): string {
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
          <span className={`text-xs font-semibold ${POSITION_COLORS[p.draftedPlayerPosition] ?? 'text-gray-400'}`}>
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

function TradeSnippet({ trade, userId, leagueName }: { trade: AnalyzedTrade; userId: string; leagueName: string }) {
  const mySide = trade.sides.find((s) => s.userId === userId) ?? trade.sides[0];
  const theirSide = trade.sides.find((s) => s.userId !== userId) ?? trade.sides[1];

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4 space-y-3">
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <ArrowLeftRight size={11} />
          {leagueName} · {trade.season} Wk{trade.week}
        </span>
        <span>{formatDate(trade.timestamp)}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
        <div>
          <div className="text-[11px] text-gray-500 mb-1">You received</div>
          <div className="space-y-0.5">
            {mySide.assetsReceived.map((a) => (
              <div key={a.playerId} className="flex items-center gap-1 text-sm">
                <span className={`text-xs font-semibold ${POSITION_COLORS[a.position] ?? 'text-gray-400'}`}>{a.position}</span>
                <span className="text-gray-200 truncate">{a.playerName}</span>
              </div>
            ))}
            {mySide.picksReceived.map((p, i) => (
              <PickDisplay key={i} p={p} />
            ))}
            {mySide.assetsReceived.length === 0 && mySide.picksReceived.length === 0 && (
              <div className="text-xs text-gray-600">—</div>
            )}
          </div>
        </div>
        <div className="self-center text-gray-700"><ArrowLeftRight size={13} /></div>
        <div className="text-right">
          <div className="text-[11px] text-gray-500 mb-1">{theirSide?.displayName ?? '?'} received</div>
          <div className="space-y-0.5">
            {theirSide?.assetsReceived.map((a) => (
              <div key={a.playerId} className="flex items-center gap-1 text-sm justify-end">
                <span className="text-gray-200 truncate">{a.playerName}</span>
                <span className={`text-xs font-semibold ${POSITION_COLORS[a.position] ?? 'text-gray-400'}`}>{a.position}</span>
              </div>
            ))}
            {theirSide?.picksReceived.map((p, i) => (
              <div key={i}><PickDisplay p={p} rtl /></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GradeBadge({ grade, gradeColor }: { grade: string; gradeColor: string }) {
  return (
    <span className={`text-lg font-bold tabular-nums ${gradeColor}`}>{grade}</span>
  );
}

interface CareerTradesProps {
  stats: CrossLeagueTradeStats;
  userId: string;
}

export function CareerTrades({ stats, userId }: CareerTradesProps) {
  if (stats.isLoading) {
    return (
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-3 text-sm text-gray-500 px-1">
          <Loader2 size={14} className="animate-spin text-brand-cyan flex-shrink-0" />
          Computing trade history across all leagues…
        </div>
        <Skeleton className="h-24 w-full rounded-xl bg-card-bg/60" />
        <Skeleton className="h-48 w-full rounded-xl bg-card-bg/60" />
      </div>
    );
  }

  if (!stats.hasData) {
    return (
      <div className="py-16 text-center space-y-2">
        <ArrowLeftRight size={28} className="mx-auto text-gray-700" />
        <p className="text-sm text-gray-500">No trade data available yet.</p>
        <p className="text-xs text-gray-700">Trade analysis requires completed trades in at least one league.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Summary stat cards */}
      <Card className="border-card-border bg-card-bg overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-card-border/60">
            <div className="flex flex-col gap-1 px-4 py-4">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium uppercase tracking-wider">
                <BarChart2 size={11} className="text-gray-600" />
                Overall Grade
              </div>
              <GradeBadge grade={stats.overallGrade} gradeColor={stats.overallGradeColor} />
              <div className="text-[11px] text-gray-600">across all leagues</div>
            </div>
            <div className="flex flex-col gap-1 px-4 py-4">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium uppercase tracking-wider">
                <ArrowLeftRight size={11} className="text-gray-600" />
                Total Trades
              </div>
              <div className="text-xl font-bold text-white">{stats.totalTrades}</div>
              <div className="text-[11px] text-gray-600">completed trades</div>
            </div>
            <div className="flex flex-col gap-1 px-4 py-4">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium uppercase tracking-wider">
                <TrendingUp size={11} className="text-gray-600" />
                Net Value
              </div>
              <div className={`text-xl font-bold tabular-nums ${valueColor(stats.totalNetValue)}`}>
                {stats.totalNetValue >= 0 ? '+' : ''}{stats.totalNetValue.toFixed(1)}
              </div>
              <div className="text-[11px] text-gray-600">fantasy points gained</div>
            </div>
            <div className="flex flex-col gap-1 px-4 py-4">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium uppercase tracking-wider">
                <TrendingUp size={11} className="text-gray-600" />
                Win Rate
              </div>
              <div className="text-xl font-bold text-white">
                {(stats.overallWinRate * 100).toFixed(0)}%
              </div>
              <div className="text-[11px] text-gray-600">trades won</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best / Worst trade all-time */}
      {(stats.bestTradeAllTime || stats.worstTradeAllTime) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.bestTradeAllTime && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1">
                <TrendingUp size={12} className="text-green-400" />
                <span className="text-[11px] font-semibold text-green-400 uppercase tracking-wider">Best Trade</span>
                <span className={`ml-auto text-sm font-bold ${valueColor(stats.bestTradeAllTime.netValue)}`}>
                  +{stats.bestTradeAllTime.netValue.toFixed(1)} pts
                </span>
              </div>
              <TradeSnippet
                trade={stats.bestTradeAllTime.trade}
                userId={userId}
                leagueName={stats.bestTradeAllTime.leagueName}
              />
            </div>
          )}
          {stats.worstTradeAllTime && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1">
                <TrendingDown size={12} className="text-red-400" />
                <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider">Worst Trade</span>
                <span className={`ml-auto text-sm font-bold ${valueColor(stats.worstTradeAllTime.netValue)}`}>
                  {stats.worstTradeAllTime.netValue.toFixed(1)} pts
                </span>
              </div>
              <TradeSnippet
                trade={stats.worstTradeAllTime.trade}
                userId={userId}
                leagueName={stats.worstTradeAllTime.leagueName}
              />
            </div>
          )}
        </div>
      )}

      {/* Per-league trade breakdown table */}
      {stats.perLeague.length > 0 && (
        <Card className="border-card-border bg-card-bg overflow-hidden">
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300">By League</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-card-border/50 hover:bg-transparent">
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider pl-4">League</TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center">Grade</TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center">Trades</TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center">Net Value</TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center pr-4">Top Partner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.perLeague.map((league) => (
                    <TableRow key={league.leagueId} className="border-card-border/50 hover:bg-white/3">
                      <TableCell className="pl-4 py-3">
                        <span className="text-sm text-white font-medium truncate max-w-[120px] block">{league.leagueName}</span>
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <GradeBadge grade={league.grade} gradeColor={league.gradeColor} />
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <span className="text-sm text-gray-300 tabular-nums">{league.tradeCount}</span>
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <span className={`text-sm font-semibold tabular-nums ${valueColor(league.netValue)}`}>
                          {league.netValue >= 0 ? '+' : ''}{league.netValue.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-3 pr-4">
                        {league.mostFrequentPartner ? (
                          <span className="text-xs text-gray-400">
                            {league.mostFrequentPartner.displayName}
                            <span className="text-gray-600 ml-1">({league.mostFrequentPartner.count}x)</span>
                          </span>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top trading partners */}
      {stats.topTradingPartners.length > 0 && (
        <Card className="border-card-border bg-card-bg">
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Users size={13} />
              Most Frequent Trading Partners
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {stats.topTradingPartners.map((partner, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-white/4 border border-card-border rounded-lg px-3 py-2"
                >
                  <span className="text-sm font-medium text-white">{partner.displayName}</span>
                  <Badge variant="outline" className="border-card-border text-gray-500 text-[11px] h-5">
                    {partner.count}x
                  </Badge>
                  <span className="text-[11px] text-gray-600">{partner.leagueName}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
