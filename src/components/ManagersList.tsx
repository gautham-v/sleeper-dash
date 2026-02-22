import { useMemo } from 'react';
import { Loader2, Trophy, TrendingUp, ChevronRight } from 'lucide-react';
import { useLeagueHistory } from '../hooks/useLeagueData';
import { calcAllTimeStats } from '../utils/calculations';
import { Avatar } from './Avatar';

interface Props {
  leagueId: string;
  onSelectManager: (userId: string) => void;
}

export function ManagersList({ leagueId, onSelectManager }: Props) {
  const { data: history, isLoading } = useLeagueHistory(leagueId);

  const allStats = useMemo(() => {
    if (!history) return new Map();
    return calcAllTimeStats(history);
  }, [history]);

  const managers = useMemo(() => {
    return [...allStats.values()].sort((a, b) => {
      // Sort by win % descending, then total wins
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      return b.totalWins - a.totalWins;
    });
  }, [allStats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-brand-cyan">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading manager history…
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="bg-gray-900 rounded-2xl p-8 text-center text-gray-500">
        No historical data available.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Click any manager to view their full career stats and trophy case.</p>
      {managers.map((mgr, idx) => {
        const winPctDisplay = `${(mgr.winPct * 100).toFixed(1)}%`;
        const totalGames = mgr.totalWins + mgr.totalLosses;
        return (
          <button
            key={mgr.userId}
            onClick={() => onSelectManager(mgr.userId)}
            className="w-full flex items-center gap-4 bg-card-bg hover:bg-surface-hover border border-card-border hover:border-brand-cyan/40 rounded-2xl p-4 transition-all group text-left"
          >
            {/* Rank */}
            <div className="w-7 text-center text-sm font-bold text-gray-600 flex-shrink-0">
              {idx + 1}
            </div>

            <Avatar avatar={mgr.avatar} name={mgr.displayName} size="lg" />

            <div className="flex-1 min-w-0">
              <div className="font-bold text-white group-hover:text-brand-cyan transition-colors truncate">
                {mgr.displayName}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {mgr.totalWins}–{mgr.totalLosses} · {totalGames} games · {mgr.totalSeasons} season{mgr.totalSeasons !== 1 ? 's' : ''}
                {(mgr.playoffWins > 0 || mgr.playoffLosses > 0) && (
                  <span className="text-yellow-500/70"> · playoffs {mgr.playoffWins}–{mgr.playoffLosses}</span>
                )}
              </div>
            </div>

            {/* Titles */}
            {mgr.titles > 0 && (
              <div className="flex items-center gap-1 bg-yellow-900/30 border border-yellow-700/40 rounded-lg px-2.5 py-1 flex-shrink-0">
                <Trophy size={11} className="text-yellow-400" />
                <span className="text-yellow-400 font-bold text-xs">{mgr.titles}</span>
              </div>
            )}

            {/* Win % */}
            <div className="flex flex-col items-end flex-shrink-0 min-w-[60px]">
              <div className="flex items-center gap-1">
                <TrendingUp size={12} className="text-brand-cyan" />
                <span className="font-bold text-brand-cyan text-sm">{winPctDisplay}</span>
              </div>
              <span className="text-xs text-gray-500">win rate</span>
            </div>

            <ChevronRight size={16} className="text-gray-600 group-hover:text-brand-cyan transition-colors flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
