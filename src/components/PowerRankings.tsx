import type { PowerRanking } from '../types/sleeper';
import { Avatar } from './Avatar';

interface PowerRankingsProps {
  rankings: PowerRanking[];
  standings: { rosterId: number; wins: number; losses: number }[];
}

export function PowerRankings({ rankings, standings }: PowerRankingsProps) {
  const standingsByRoster = new Map(standings.map((s) => [s.rosterId, s]));
  const maxScore = Math.max(...rankings.map((r) => r.score));

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-gray-500 mb-5 font-medium uppercase tracking-wider">
        Weighted score: 50% recent 3-week avg · 30% season avg · 20% win %
      </p>
      {rankings.map((r, i) => {
        const standing = standingsByRoster.get(r.rosterId);
        const barWidth = maxScore > 0 ? (r.score / maxScore) * 100 : 0;

        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

        return (
          <div key={r.rosterId} className="bg-card-bg rounded-2xl p-5 border border-card-border hover:border-brand-purple/30 transition-all group hover:shadow-[0_0_20px_rgba(176,132,233,0.05)] relative overflow-hidden">
            {i === 0 && <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>}
            
            <div className="flex items-center gap-4 mb-4 relative z-10">
              <span className={`font-bold w-6 text-center text-sm ${i < 3 ? 'text-brand-purple' : 'text-gray-500'}`}>
                {medal ?? `${i + 1}`}
              </span>
              <div className="relative">
                <Avatar avatar={r.avatar} name={r.displayName} size="md" />
                {i === 0 && <div className="absolute -inset-1 border border-brand-purple/50 rounded-full animate-pulse pointer-events-none"></div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white truncate group-hover:text-brand-cyan transition-colors">{r.teamName}</div>
                <div className="text-gray-500 text-xs">{r.displayName}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xl font-bold text-brand-purple drop-shadow-[0_0_8px_rgba(176,132,233,0.3)]">{r.score.toFixed(1)}</div>
                {standing && (
                  <div className="text-xs font-medium text-gray-500">
                    {standing.wins}–{standing.losses}
                  </div>
                )}
              </div>
            </div>

            {/* Score bar */}
            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden mb-4 relative z-10">
              <div
                className="h-full bg-gradient-to-r from-brand-cyan to-brand-purple rounded-full transition-all relative"
                style={{ width: `${barWidth}%` }}
              >
                <div className="absolute inset-0 bg-white/20 w-full rounded-full"></div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 text-center text-xs relative z-10">
              <div className="bg-black/20 border border-card-border rounded-xl p-3 hover:bg-black/30 transition-colors">
                <div className="text-gray-500 font-medium mb-1">
                  <span className="sm:hidden">L3</span>
                  <span className="hidden sm:inline">Last 3 Avg</span>
                </div>
                <div className="text-white font-bold">{r.recentAvg.toFixed(1)}</div>
              </div>
              <div className="bg-black/20 border border-card-border rounded-xl p-3 hover:bg-black/30 transition-colors">
                <div className="text-gray-500 font-medium mb-1">
                  <span className="sm:hidden">Avg</span>
                  <span className="hidden sm:inline">Season Avg</span>
                </div>
                <div className="text-white font-bold">{r.seasonAvg.toFixed(1)}</div>
              </div>
              <div className="bg-black/20 border border-card-border rounded-xl p-3 hover:bg-black/30 transition-colors">
                <div className="text-gray-500 font-medium mb-1">Win %</div>
                <div className="text-white font-bold">{r.winPct.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
