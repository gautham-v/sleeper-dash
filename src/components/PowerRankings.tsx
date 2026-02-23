import type { PowerRanking } from '../types/sleeper';
import { Avatar } from './Avatar';

interface PowerRankingsProps {
  rankings: PowerRanking[];
  standings: { rosterId: number; wins: number; losses: number }[];
  onSelectManager?: (userId: string) => void;
}

export function PowerRankings({ rankings, standings, onSelectManager }: PowerRankingsProps) {
  const standingsByRoster = new Map(standings.map((s) => [s.rosterId, s]));
  const maxScore = Math.max(...rankings.map((r) => r.score));

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 mb-5">
        Weighted score: 50% recent 3-week avg · 30% season avg · 20% win %
      </p>
      {rankings.map((r, i) => {
        const standing = standingsByRoster.get(r.rosterId);
        const barWidth = maxScore > 0 ? (r.score / maxScore) * 100 : 0;

        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

        return (
          <div key={r.rosterId} className="bg-gray-900 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-gray-500 font-bold w-6 text-center text-sm">
                {medal ?? `${i + 1}`}
              </span>
              <Avatar avatar={r.avatar} name={r.displayName} size="md" />
              <button
                className="flex-1 min-w-0 text-left group"
                onClick={() => r.userId && onSelectManager?.(r.userId)}
                disabled={!r.userId || !onSelectManager}
              >
                <div className={`text-sm font-semibold text-white truncate ${r.userId && onSelectManager ? 'group-hover:text-indigo-400 transition-colors' : ''}`}>
                  {r.teamName}
                </div>
                <div className="text-gray-500 text-xs">{r.displayName}</div>
              </button>
              <div className="text-right shrink-0">
                <div className="text-lg font-bold text-indigo-400">{r.score.toFixed(1)}</div>
                {standing && (
                  <div className="text-xs text-gray-500">
                    {standing.wins}–{standing.losses}
                  </div>
                )}
              </div>
            </div>

            {/* Score bar */}
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${barWidth}%` }}
              />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-gray-800 rounded-lg p-2.5">
                <div className="text-gray-400">
                  <span className="sm:hidden">L3</span>
                  <span className="hidden sm:inline">Last 3 Avg</span>
                </div>
                <div className="text-white font-semibold">{r.recentAvg.toFixed(1)}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-2.5">
                <div className="text-gray-400">
                  <span className="sm:hidden">Avg</span>
                  <span className="hidden sm:inline">Season Avg</span>
                </div>
                <div className="text-white font-semibold">{r.seasonAvg.toFixed(1)}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-2.5">
                <div className="text-gray-400">Win %</div>
                <div className="text-white font-semibold">{r.winPct.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
