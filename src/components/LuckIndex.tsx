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
      {entries.map((entry, i) => (
        <div
          key={entry.userId || entry.rosterId}
          className="flex items-center gap-4 px-5 py-4 border-t border-border hover:bg-muted/30 transition-colors"
        >
          <span className="text-muted-foreground w-4 text-center text-sm">{i + 1}</span>
          <Avatar avatar={entry.avatar} name={entry.displayName} size="sm" />
          <button
            className="w-24 sm:w-32 shrink-0 text-left group"
            onClick={() => entry.userId && onSelectManager?.(entry.userId)}
            disabled={!entry.userId || !onSelectManager}
          >
            <div className={`font-medium text-white text-sm leading-tight truncate ${entry.userId && onSelectManager ? 'group-hover:text-brand-cyan transition-colors' : ''}`}>
              {entry.teamName}
            </div>
            <div className="text-muted-foreground text-xs">
              {entry.actualWins}W · {entry.expectedWins}exp
            </div>
          </button>
          <LuckBar value={entry.luckScore} max={maxLuck} />
          <div
            className={`w-14 text-right font-bold tabular-nums text-sm shrink-0 ${
              entry.luckScore > 0
                ? 'text-foreground'
                : entry.luckScore < 0
                ? 'text-muted-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {entry.luckScore > 0 ? '+' : ''}
            {entry.luckScore.toFixed(1)}
          </div>
        </div>
      ))}
      <div className="flex justify-between text-xs text-muted-foreground/60 px-5 py-3 border-t border-border">
        <span>Most Unlucky</span>
        <span>Most Lucky</span>
      </div>
    </div>
  );
}
