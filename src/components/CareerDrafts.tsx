'use client';

import { TrendingUp, TrendingDown, Target, BarChart2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CrossLeagueDraftStats } from '@/hooks/useCrossLeagueAnalytics';
import type { AnalyzedPick } from '@/types/sleeper';
import { MetricTooltip } from '@/components/MetricTooltip';

const POSITION_COLORS: Record<string, string> = {
  QB:  'bg-red-900/50 text-red-300 border-red-800/50',
  RB:  'bg-green-900/50 text-green-300 border-green-800/50',
  WR:  'bg-blue-900/50 text-blue-300 border-blue-800/50',
  TE:  'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
  K:   'bg-gray-700 text-gray-300 border-gray-600',
  DEF: 'bg-purple-900/50 text-purple-300 border-purple-800/50',
  DST: 'bg-purple-900/50 text-purple-300 border-purple-800/50',
};

function surplusColor(surplus: number): string {
  if (surplus > 1) return 'text-green-400';
  if (surplus < -1) return 'text-red-400';
  return 'text-gray-400';
}

function surplusLabel(surplus: number): string {
  return (surplus >= 0 ? '+' : '') + surplus.toFixed(1);
}

function PickCard({
  pick,
  leagueName,
  label,
  icon: Icon,
  accent,
}: {
  pick: AnalyzedPick;
  leagueName: string;
  label: string;
  icon: React.ElementType;
  accent: string;
}) {
  const posClass = POSITION_COLORS[pick.position] ?? 'bg-gray-700 text-gray-300 border-gray-600';
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${accent}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-70">
        <Icon size={11} />
        {label}
      </div>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 px-1.5 py-0.5 rounded text-xs font-bold border ${posClass}`}>
          {pick.position}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm leading-tight truncate">{pick.playerName}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {pick.season} · Round {pick.round}, Pick {pick.pickNo}
            {pick.isKeeper && <span className="ml-1 text-brand-cyan">(K)</span>}
          </div>
          <div className="text-[11px] text-gray-600 mt-0.5 truncate">{leagueName}</div>
        </div>
        <div className={`text-xl font-bold tabular-nums flex-shrink-0 ${surplusColor(pick.surplus)}`}>
          {surplusLabel(pick.surplus)}
        </div>
      </div>
    </div>
  );
}

function GradeBadge({ grade, gradeColor }: { grade: string; gradeColor: string }) {
  return <span className={`text-lg font-bold tabular-nums ${gradeColor}`}>{grade}</span>;
}

interface CareerDraftsProps {
  stats: CrossLeagueDraftStats;
}

export function CareerDrafts({ stats }: CareerDraftsProps) {
  if (stats.isLoading) {
    return (
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-3 text-sm text-gray-500 px-1">
          <Loader2 size={14} className="animate-spin text-brand-cyan flex-shrink-0" />
          Computing draft history across all leagues…
        </div>
        <Skeleton className="h-24 w-full rounded-xl bg-card-bg/60" />
        <Skeleton className="h-40 w-full rounded-xl bg-card-bg/60" />
      </div>
    );
  }

  if (!stats.hasData) {
    return (
      <div className="py-16 text-center space-y-2">
        <Target size={28} className="mx-auto text-gray-700" />
        <p className="text-sm text-gray-500">No draft data available yet.</p>
        <p className="text-xs text-gray-700">Draft analysis requires completed snake drafts in at least one league.</p>
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
                <span className="flex items-center gap-1">Overall Grade <MetricTooltip metricKey="grade" /></span>
              </div>
              <GradeBadge grade={stats.overallGrade} gradeColor={stats.overallGradeColor} />
              <div className="text-[11px] text-gray-600">across all leagues</div>
            </div>
            <div className="flex flex-col gap-1 px-4 py-4">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium uppercase tracking-wider">
                <TrendingUp size={11} className="text-gray-600" />
                <span className="flex items-center gap-1">Total WAR <MetricTooltip metricKey="war" /></span>
              </div>
              <div className={`text-xl font-bold tabular-nums ${surplusColor(stats.totalWAR)}`}>
                {stats.totalWAR >= 0 ? '+' : ''}{stats.totalWAR.toFixed(1)}
              </div>
              <div className="text-[11px] text-gray-600">wins above replacement</div>
            </div>
            <div className="flex flex-col gap-1 px-4 py-4">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium uppercase tracking-wider">
                <TrendingUp size={11} className="text-gray-600" />
                <span className="flex items-center gap-1">Hit Rate <MetricTooltip metricKey="hitRate" /></span>
              </div>
              <div className="text-xl font-bold text-green-400">
                {(stats.hitRate * 100).toFixed(0)}%
              </div>
              <div className="text-[11px] text-gray-600">top-tier picks</div>
            </div>
            <div className="flex flex-col gap-1 px-4 py-4">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium uppercase tracking-wider">
                <TrendingDown size={11} className="text-gray-600" />
                <span className="flex items-center gap-1">Bust Rate <MetricTooltip metricKey="bustRate" /></span>
              </div>
              <div className="text-xl font-bold text-red-400">
                {(stats.bustRate * 100).toFixed(0)}%
              </div>
              <div className="text-[11px] text-gray-600">busted picks</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best / Worst picks all-time */}
      {(stats.bestPickAllTime || stats.worstPickAllTime) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.bestPickAllTime && (
            <PickCard
              pick={stats.bestPickAllTime.pick}
              leagueName={stats.bestPickAllTime.leagueName}
              label="Best Pick All-Time"
              icon={TrendingUp}
              accent="border-green-800/30 bg-green-950/20 text-green-300"
            />
          )}
          {stats.worstPickAllTime && (
            <PickCard
              pick={stats.worstPickAllTime.pick}
              leagueName={stats.worstPickAllTime.leagueName}
              label="Worst Pick All-Time"
              icon={TrendingDown}
              accent="border-red-800/30 bg-red-950/20 text-red-300"
            />
          )}
        </div>
      )}

      {/* Per-league draft breakdown table */}
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
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center"><span className="flex items-center justify-center gap-1">Grade <MetricTooltip metricKey="grade" side="bottom" /></span></TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center"><span className="flex items-center justify-center gap-1">WAR <MetricTooltip metricKey="war" side="bottom" /></span></TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center">Hit%</TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center">Bust%</TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center pr-4">Best Pick</TableHead>
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
                        <span className={`text-sm font-semibold tabular-nums ${surplusColor(league.totalWAR)}`}>
                          {league.totalWAR >= 0 ? '+' : ''}{league.totalWAR.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <span className="text-sm text-green-400 tabular-nums">
                          {(league.hitRate * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <span className="text-sm text-red-400/80 tabular-nums">
                          {(league.bustRate * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-3 pr-4">
                        {league.bestPick ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`text-[10px] font-bold px-1 py-0.5 rounded border ${POSITION_COLORS[league.bestPick.position] ?? 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                              {league.bestPick.position}
                            </span>
                            <span className="text-xs text-gray-300 truncate max-w-[80px]">{league.bestPick.playerName}</span>
                          </div>
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
    </div>
  );
}
