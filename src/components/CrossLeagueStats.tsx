'use client';
import { Loader2, Trophy, TrendingUp, Swords, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { CrossLeagueUserStats } from '../hooks/useLeagueData';

interface CrossLeagueStatsProps {
  stats: CrossLeagueUserStats | null | undefined;
  isLoading: boolean;
  leagueCount: number;
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
      <div className="text-lg font-bold text-white leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-gray-600">{sub}</div>}
    </div>
  );
}

export function CrossLeagueStats({ stats, isLoading, leagueCount }: CrossLeagueStatsProps) {
  if (isLoading) {
    return (
      <Card className="border-card-border bg-card-bg">
        <CardContent className="flex items-center gap-3 py-4 px-5">
          <Loader2 size={14} className="animate-spin text-brand-cyan flex-shrink-0" />
          <span className="text-xs text-gray-500">Computing career stats…</span>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const totalGames = stats.totalWins + stats.totalLosses;
  const winPct = totalGames > 0 ? ((stats.totalWins / totalGames) * 100).toFixed(1) : '—';
  const playoffGames = stats.playoffWins + stats.playoffLosses;
  const playoffPct = playoffGames > 0 ? ((stats.playoffWins / playoffGames) * 100).toFixed(0) : null;

  const leagueLabel = leagueCount === 1 ? '1 league' : `${leagueCount} leagues`;
  const seasonLabel = stats.totalSeasons === 1 ? '1 season' : `${stats.totalSeasons} seasons`;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2 px-1">
        <h2 className="text-[13px] font-semibold text-gray-300">Career Stats</h2>
        <span className="text-[11px] text-gray-600">{seasonLabel} across {leagueLabel}</span>
      </div>

      <Card className="border-card-border bg-card-bg overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-card-border/60">
            <StatCard
              label="Career Record"
              value={`${stats.totalWins}–${stats.totalLosses}`}
              sub={`${winPct}% win rate`}
              icon={TrendingUp}
            />
            <StatCard
              label="Championships"
              value={stats.titles === 0 ? '0' : stats.titles.toString()}
              sub={stats.titles === 1 ? '1 title' : `${stats.titles} titles`}
              icon={Trophy}
            />
            <StatCard
              label="Playoff Record"
              value={`${stats.playoffWins}–${stats.playoffLosses}`}
              sub={playoffPct ? `${playoffPct}% win rate` : 'No playoff games'}
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
    </div>
  );
}
