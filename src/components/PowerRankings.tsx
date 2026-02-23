import type { PowerRanking } from '../types/sleeper';
import { Avatar } from './Avatar';
import { Button } from '@/components/ui/button';

interface PowerRankingsProps {
  rankings: PowerRanking[];
  standings: { rosterId: number; wins: number; losses: number }[];
  onSelectManager?: (userId: string) => void;
}

export function PowerRankings({ rankings, standings, onSelectManager }: PowerRankingsProps) {
  const standingsByRoster = new Map(standings.map((s) => [s.rosterId, s]));
  const maxScore = Math.max(...rankings.map((r) => r.score));

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-4">
        Weighted: 50% last 3 wks · 30% season avg · 20% win %
      </p>
      {rankings.map((r, i) => {
        const standing = standingsByRoster.get(r.rosterId);
        const barWidth = maxScore > 0 ? (r.score / maxScore) * 100 : 0;

        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

        return (
          <div key={r.rosterId} className="bg-gray-900 rounded-xl p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="text-gray-500 font-bold w-5 text-center text-sm shrink-0">
                {medal ?? <span className="text-xs">{i + 1}</span>}
              </span>
              <Avatar avatar={r.avatar} name={r.displayName} size="sm" />
              <Button
                variant="ghost"
                className="flex-1 min-w-0 h-auto p-0 justify-start group hover:bg-transparent"
                onClick={() => r.userId && onSelectManager?.(r.userId)}
                disabled={!r.userId || !onSelectManager}
              >
                <div className="text-left min-w-0">
                  <div className={`text-sm font-semibold text-white truncate ${r.userId && onSelectManager ? 'group-hover:text-indigo-400 transition-colors' : ''}`}>
                    {r.teamName}
                  </div>
                  <div className="text-gray-500 text-xs truncate">{r.displayName}</div>
                </div>
              </Button>
              <div className="text-right shrink-0">
                <div className="text-base font-bold text-indigo-400 tabular-nums">{r.score.toFixed(1)}</div>
                {standing && (
                  <div className="text-xs text-gray-600 tabular-nums">
                    {standing.wins}–{standing.losses}
                  </div>
                )}
              </div>
            </div>

            {/* Score bar + inline stats */}
            <div className="mt-2.5 flex items-center gap-3">
              <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
              <span>L3 <span className="text-gray-300 font-medium">{r.recentAvg.toFixed(1)}</span></span>
              <span className="text-gray-700">·</span>
              <span>Avg <span className="text-gray-300 font-medium">{r.seasonAvg.toFixed(1)}</span></span>
              <span className="text-gray-700">·</span>
              <span>Win% <span className="text-gray-300 font-medium">{r.winPct.toFixed(0)}%</span></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
