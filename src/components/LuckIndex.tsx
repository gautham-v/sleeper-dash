import type { LuckEntry } from '../types/sleeper';
import { Avatar } from './Avatar';
import { Button } from '@/components/ui/button';

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
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden flex justify-end">
        {!isLucky && (
          <div
            className="h-full bg-red-500 rounded-full"
            style={{ width: `${pct * 100}%` }}
          />
        )}
      </div>
      <div className="w-px h-4 bg-gray-600 shrink-0" />
      {/* Right (lucky) side */}
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        {isLucky && (
          <div
            className="h-full bg-green-500 rounded-full"
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
      <p className="text-xs text-gray-500 mb-3">
        Actual wins vs. expected wins if you played every team each week.
      </p>
      <div className="bg-gray-900 rounded-xl overflow-hidden">
        {entries.map((entry, i) => (
          <div
            key={entry.userId || entry.rosterId}
            className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 last:border-0 hover:bg-gray-800/30 transition-colors"
          >
            <span className="text-gray-600 w-4 text-center text-xs shrink-0">{i + 1}</span>
            <Avatar avatar={entry.avatar} name={entry.displayName} size="sm" />
            <Button
              variant="ghost"
              className="w-20 sm:w-28 shrink-0 h-auto p-0 justify-start group hover:bg-transparent"
              onClick={() => entry.userId && onSelectManager?.(entry.userId)}
              disabled={!entry.userId || !onSelectManager}
            >
              <div className="text-left">
                <div className={`font-medium text-white text-xs leading-tight truncate ${entry.userId && onSelectManager ? 'group-hover:text-brand-cyan transition-colors' : ''}`}>
                  {entry.teamName}
                </div>
                <div className="text-gray-500 text-xs">
                  {entry.actualWins}W · {entry.expectedWins}exp
                </div>
              </div>
            </Button>
            <LuckBar value={entry.luckScore} max={maxLuck} />
            <div
              className={`w-12 text-right font-bold tabular-nums text-sm shrink-0 ${
                entry.luckScore > 0
                  ? 'text-green-400'
                  : entry.luckScore < 0
                  ? 'text-red-400'
                  : 'text-gray-400'
              }`}
            >
              {entry.luckScore > 0 ? '+' : ''}
              {entry.luckScore.toFixed(1)}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-600 px-1 mt-1">
        <span>Most Unlucky</span>
        <span>Most Lucky</span>
      </div>
    </div>
  );
}
