'use client';
import type { LuckEntry } from '../types/sleeper';
import { Avatar } from './Avatar';

interface LuckIndexProps {
  entries: LuckEntry[];
  onSelectManager?: (userId: string) => void;
}

function LuckBar({ value, max }: { value: number; max: number }) {
  const absMax = Math.max(max, 1);
  const pct = Math.abs(value) / absMax;
  const isLucky = value > 0;

  return (
    <div className="flex items-center gap-2 flex-1">
      {/* Left (unlucky) side */}
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex justify-end">
        {!isLucky && (
          <div
            className="h-full bg-foreground/60 rounded-full"
            style={{ width: `${pct * 100}%` }}
          />
        )}
      </div>
      <div className="w-px h-4 bg-border shrink-0" />
      {/* Right (lucky) side */}
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        {isLucky && (
          <div
            className="h-full bg-foreground rounded-full"
            style={{ width: `${pct * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

export function LuckIndex({ entries, onSelectManager }: LuckIndexProps) {
  const maxLuck = Math.max(...entries.map((e) => Math.abs(e.luckScore)));

  return (
    <div>
      <p className="text-xs text-muted-foreground px-5 pt-4 pb-3">
        Luck = Actual wins minus expected wins (if you played every team each week).
        Positive = lucky, Negative = unlucky.
      </p>
      {entries.map((entry, i) => {
        const showUsername = entry.teamName !== entry.displayName;
        const scorePositive = entry.luckScore > 0;
        return (
          <div
            key={entry.userId || entry.rosterId}
            className="flex items-center gap-3 px-5 py-3.5 border-t border-border hover:bg-muted/30 transition-colors"
          >
            <span className="text-muted-foreground w-4 text-center text-sm shrink-0">{i + 1}</span>
            <Avatar avatar={entry.avatar} name={entry.displayName} size="sm" />
            <button
              className="flex-1 min-w-0 text-left group"
              onClick={() => entry.userId && onSelectManager?.(entry.userId)}
              disabled={!entry.userId || !onSelectManager}
            >
              <div className={`font-medium text-white text-sm leading-tight truncate ${entry.userId && onSelectManager ? 'group-hover:text-brand-cyan transition-colors' : ''}`}>
                {entry.teamName}
              </div>
              {showUsername && (
                <div className="text-muted-foreground text-xs truncate">{entry.displayName}</div>
              )}
              <div className="text-muted-foreground text-xs mt-0.5 sm:hidden tabular-nums">
                {entry.actualWins}W · {entry.expectedWins}exp
              </div>
            </button>
            {/* Bar: visible on sm+ only */}
            <div className="hidden sm:flex items-center flex-[2]">
              <LuckBar value={entry.luckScore} max={maxLuck} />
            </div>
            <div className="shrink-0 text-right min-w-[3rem]">
              <div className={`font-bold tabular-nums text-sm ${scorePositive ? 'text-foreground' : 'text-muted-foreground'}`}>
                {scorePositive ? '+' : ''}{entry.luckScore.toFixed(1)}
              </div>
              <div className="text-muted-foreground text-xs tabular-nums hidden sm:block">
                {entry.actualWins}W · {entry.expectedWins}exp
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex justify-between text-xs text-muted-foreground/60 px-5 py-3 border-t border-border">
        <span>Most Unlucky</span>
        <span>Most Lucky</span>
      </div>
    </div>
  );
}
