import { Loader2, Trophy, TrendingUp, Swords, Calendar } from 'lucide-react';
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
    <div className="flex flex-col gap-1 px-4 py-3">
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
      <div className="mb-5 bg-card-bg border border-card-border rounded-xl px-4 py-4 flex items-center gap-3">
        <Loader2 size={14} className="animate-spin text-brand-cyan flex-shrink-0" />
        <span className="text-xs text-gray-500">Computing career stats…</span>
      </div>
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
    <div className="mb-5">
      <div className="flex items-baseline gap-2 mb-2.5">
        <h2 className="text-[13px] font-semibold text-gray-300">Career Stats</h2>
        <span className="text-[11px] text-gray-600">{seasonLabel} across {leagueLabel}</span>
      </div>

      <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden">
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
      </div>
    </div>
  );
}
