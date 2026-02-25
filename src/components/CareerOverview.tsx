'use client';

import { Trophy, TrendingUp, Swords, Calendar, TrendingDown, Star, ArrowLeftRight, Target } from 'lucide-react';
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
import { avatarUrl } from '@/utils/calculations';
import type { CrossLeagueUserStats, LeagueCareerBreakdown } from '@/hooks/useLeagueData';
import type { CrossLeagueTradeStats, CrossLeagueDraftStats } from '@/hooks/useCrossLeagueAnalytics';

interface CareerOverviewProps {
  stats: CrossLeagueUserStats | null | undefined;
  isLoading: boolean;
  leagueCount: number;
  tradeStats?: CrossLeagueTradeStats;
  draftStats?: CrossLeagueDraftStats;
}

function pct(wins: number, losses: number): string {
  const total = wins + losses;
  return total > 0 ? ((wins / total) * 100).toFixed(1) + '%' : '—';
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-4">
      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium uppercase tracking-wider">
        <Icon size={11} className="text-gray-600" />
        {label}
      </div>
      <div className="text-xl font-bold text-white leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-gray-600">{sub}</div>}
    </div>
  );
}

function SeasonHighlightCard({
  label,
  record,
  icon: Icon,
  accent,
  valueColor,
}: {
  label: string;
  record: { leagueName: string; wins: number; losses: number; season: string } | null;
  icon: React.ElementType;
  accent: string;
  valueColor: string;
}) {
  if (!record) return null;
  return (
    <div className={`rounded-xl border p-4 ${accent}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-2">
        <Icon size={11} className={valueColor} />
        <span className={valueColor}>{label}</span>
      </div>
      <div className={`text-2xl font-bold leading-none mb-1 ${valueColor}`}>
        {record.wins}–{record.losses}
      </div>
      <div className="text-xs text-muted-foreground">
        {record.wins + record.losses > 0
          ? `${((record.wins / (record.wins + record.losses)) * 100).toFixed(0)}% win rate`
          : '—'}
      </div>
      <div className="mt-2 text-xs text-muted-foreground truncate">
        {record.leagueName} · {record.season}
      </div>
    </div>
  );
}

function LeagueRow({ breakdown }: { breakdown: LeagueCareerBreakdown }) {
  const totalGames = breakdown.wins + breakdown.losses;
  const winPct = totalGames > 0 ? ((breakdown.wins / totalGames) * 100).toFixed(1) : '—';
  const playoffGames = breakdown.playoffWins + breakdown.playoffLosses;

  const sortedSeasons = [...breakdown.seasons].sort();
  const seasonRange =
    sortedSeasons.length === 1
      ? sortedSeasons[0]
      : `${sortedSeasons[0]}–${sortedSeasons[sortedSeasons.length - 1]}`;

  return (
    <TableRow className="border-card-border/50 hover:bg-white/3">
      <TableCell className="py-3">
        <div className="flex items-center gap-2">
          {breakdown.leagueAvatar ? (
            <img
              src={avatarUrl(breakdown.leagueAvatar) ?? ''}
              alt={breakdown.leagueName}
              className="w-7 h-7 rounded-md border border-card-border object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-7 h-7 rounded-md bg-brand-purple/15 border border-brand-purple/20 flex items-center justify-center text-brand-purple font-bold text-xs flex-shrink-0">
              {breakdown.leagueName.slice(0, 2)}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate max-w-[140px]">
              {breakdown.leagueName}
            </div>
            <div className="text-[11px] text-gray-600">{seasonRange}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center py-3">
        <span className="text-sm font-semibold text-white tabular-nums">
          {breakdown.wins}–{breakdown.losses}
        </span>
      </TableCell>
      <TableCell className="text-center py-3">
        <span className="text-sm text-gray-300 tabular-nums">{winPct}%</span>
      </TableCell>
      <TableCell className="text-center py-3">
        {breakdown.titles > 0 ? (
          <div className="flex items-center justify-center gap-1">
            <Trophy size={11} className="text-yellow-400" />
            <span className="text-sm font-bold text-yellow-400">{breakdown.titles}</span>
          </div>
        ) : (
          <span className="text-gray-600 text-sm">—</span>
        )}
      </TableCell>
      <TableCell className="text-center py-3">
        <span className="text-sm text-gray-400 tabular-nums">
          {playoffGames > 0 ? `${breakdown.playoffWins}–${breakdown.playoffLosses}` : '—'}
        </span>
      </TableCell>
      <TableCell className="text-center py-3">
        <div className="flex flex-col items-center gap-0.5">
          {breakdown.bestSeasonRecord && (
            <span className="text-[11px] text-green-400 font-medium tabular-nums">
              Best: {breakdown.bestSeasonRecord.wins}–{breakdown.bestSeasonRecord.losses}
            </span>
          )}
          {breakdown.worstSeasonRecord && breakdown.seasons.length > 1 && (
            <span className="text-[11px] text-red-400/70 tabular-nums">
              Worst: {breakdown.worstSeasonRecord.wins}–{breakdown.worstSeasonRecord.losses}
            </span>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function CareerOverview({ stats, isLoading, leagueCount, tradeStats, draftStats }: CareerOverviewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl bg-card-bg/60" />
        <Skeleton className="h-20 w-full rounded-xl bg-card-bg/60" />
        <Skeleton className="h-48 w-full rounded-xl bg-card-bg/60" />
      </div>
    );
  }

  if (!stats) return null;

  const totalGames = stats.totalWins + stats.totalLosses;
  const playoffGames = stats.playoffWins + stats.playoffLosses;
  const seasonLabel = stats.totalSeasons === 1 ? '1 season' : `${stats.totalSeasons} seasons`;
  const leagueLabel = leagueCount === 1 ? '1 league' : `${leagueCount} leagues`;

  return (
    <div className="space-y-4">
      {/* Context label */}
      <div className="flex items-baseline gap-2 px-1">
        <h2 className="text-[13px] font-semibold text-gray-300">Career Stats</h2>
        <span className="text-[11px] text-gray-600">{seasonLabel} across {leagueLabel}</span>
      </div>

      {/* Hero stat cards */}
      <Card className="border-card-border bg-card-bg overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-card-border/60">
            <StatCard
              label="Career Record"
              value={`${stats.totalWins}–${stats.totalLosses}`}
              sub={`${pct(stats.totalWins, stats.totalLosses)} win rate`}
              icon={TrendingUp}
            />
            <StatCard
              label="Championships"
              value={stats.titles.toString()}
              sub={stats.titles === 1 ? '1 title' : `${stats.titles} titles`}
              icon={Trophy}
            />
            <StatCard
              label="Playoff Record"
              value={`${stats.playoffWins}–${stats.playoffLosses}`}
              sub={playoffGames > 0 ? `${pct(stats.playoffWins, stats.playoffLosses)} win rate` : 'No playoff games'}
              icon={Swords}
            />
            <StatCard
              label="Avg Pts/Season"
              value={stats.avgPointsFor > 0 ? stats.avgPointsFor.toFixed(1) : '—'}
              sub="points per season"
              icon={Calendar}
            />
          </div>
        </CardContent>
      </Card>

      {/* Performance Grades */}
      {(tradeStats || draftStats) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card-bg border border-card-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium uppercase tracking-wider mb-2">
              <ArrowLeftRight size={11} className="text-gray-600" />
              Trade Grade
            </div>
            {tradeStats?.isLoading ? (
              <div className="text-xl font-bold text-gray-600 animate-pulse">…</div>
            ) : tradeStats?.hasData ? (
              <>
                <div className={`text-2xl font-bold ${tradeStats.overallGradeColor}`}>{tradeStats.overallGrade}</div>
                <div className="text-[11px] text-gray-600 mt-0.5">
                  {tradeStats.totalTrades} trades · {(tradeStats.overallWinRate * 100).toFixed(0)}% win rate
                </div>
              </>
            ) : (
              <div className="text-xl font-bold text-gray-600">—</div>
            )}
          </div>
          <div className="bg-card-bg border border-card-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium uppercase tracking-wider mb-2">
              <Target size={11} className="text-gray-600" />
              Draft Grade
            </div>
            {draftStats?.isLoading ? (
              <div className="text-xl font-bold text-gray-600 animate-pulse">…</div>
            ) : draftStats?.hasData ? (
              <>
                <div className={`text-2xl font-bold ${draftStats.overallGradeColor}`}>{draftStats.overallGrade}</div>
                <div className="text-[11px] text-gray-600 mt-0.5">
                  {(draftStats.hitRate * 100).toFixed(0)}% hit rate
                </div>
              </>
            ) : (
              <div className="text-xl font-bold text-gray-600">—</div>
            )}
          </div>
        </div>
      )}

      {/* Season highlights */}
      {(stats.bestSingleSeasonRecord || stats.worstSingleSeasonRecord) && stats.totalSeasons > 1 && (
        <div className="grid grid-cols-2 gap-3">
          <SeasonHighlightCard
            label="Best Season"
            record={stats.bestSingleSeasonRecord}
            icon={Star}
            accent="bg-emerald-500/10 border-emerald-500/30"
            valueColor="text-emerald-400"
          />
          <SeasonHighlightCard
            label="Worst Season"
            record={stats.worstSingleSeasonRecord}
            icon={TrendingDown}
            accent="bg-red-500/10 border-red-500/30"
            valueColor="text-red-400"
          />
        </div>
      )}

      {/* Per-league breakdown table */}
      {stats.leagueBreakdown.length > 0 && (
        <Card className="border-card-border bg-card-bg overflow-hidden">
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300">League Records</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-card-border/50 hover:bg-transparent">
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider pl-4">League</TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center">Record</TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center">Win%</TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center">Titles</TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center">Playoffs</TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center pr-4">Season Range</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.leagueBreakdown.map((breakdown) => (
                    <LeagueRow key={breakdown.rootLeagueId} breakdown={breakdown} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary badges */}
      {totalGames > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          <Badge variant="outline" className="border-card-border text-gray-400 text-[11px]">
            {totalGames} career games
          </Badge>
          {stats.titles > 0 && (
            <Badge variant="outline" className="border-yellow-800/50 text-yellow-400 text-[11px]">
              <Trophy size={10} className="mr-1" />
              {stats.titles}x Champion
            </Badge>
          )}
          {playoffGames > 0 && (
            <Badge variant="outline" className="border-card-border text-gray-400 text-[11px]">
              {playoffGames} playoff games
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
