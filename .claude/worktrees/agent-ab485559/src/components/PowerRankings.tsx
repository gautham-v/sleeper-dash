'use client';
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
      <p className="text-xs text-muted-foreground mb-4">
        Weighted: 50% last 3 wks · 30% season avg · 20% win %
      </p>
      {rankings.map((r, i) => {
        const standing = standingsByRoster.get(r.rosterId);
        const barWidth = maxScore > 0 ? (r.score / maxScore) * 100 : 0;
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

        return (
          <div key={r.rosterId} className="bg-muted/30 rounded-xl p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="text-muted-foreground font-bold w-5 text-center text-sm shrink-0">
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
                  <div className={`text-sm font-semibold text-white truncate ${r.userId && onSelectManager ? 'group-hover:text-brand-cyan transition-colors' : ''}`}>
                    {r.teamName}
                  </div>
                  <div className="text-muted-foreground text-xs truncate">{r.displayName}</div>
                </div>
              </Button>
              <div className="text-right shrink-0">
                <div className="text-base font-bold text-foreground tabular-nums">{r.score.toFixed(1)}</div>
                {standing && (
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {standing.wins}–{standing.losses}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-3">
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground rounded-full transition-all"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span>L3 <span className="text-foreground font-medium">{r.recentAvg.toFixed(1)}</span></span>
              <span className="text-muted-foreground/40">·</span>
              <span>Avg <span className="text-foreground font-medium">{r.seasonAvg.toFixed(1)}</span></span>
              <span className="text-muted-foreground/40">·</span>
              <span>Win% <span className="text-foreground font-medium">{r.winPct.toFixed(0)}%</span></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
