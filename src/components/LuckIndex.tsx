import type { LuckEntry } from '../types/sleeper';
import { Avatar } from './Avatar';

interface LuckIndexProps {
  entries: LuckEntry[];
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

export function LuckIndex({ entries }: LuckIndexProps) {
  const maxLuck = Math.max(...entries.map((e) => Math.abs(e.luckScore)));

  return (
    <div>
      <p className="text-xs text-gray-500 mb-5">
        Luck = Actual wins minus expected wins (if you played every team each week).
        Positive = lucky, Negative = unlucky.
      </p>
      <div className="bg-gray-900 rounded-xl overflow-hidden">
        {entries.map((entry, i) => (
          <div
            key={entry.rosterId}
            className="flex items-center gap-4 px-5 py-4 border-b border-gray-800 last:border-0 hover:bg-gray-800/30 transition-colors"
          >
            <span className="text-gray-500 w-4 text-center text-sm">{i + 1}</span>
            <Avatar avatar={entry.avatar} name={entry.displayName} size="sm" />
            <div className="w-24 sm:w-32 shrink-0">
              <div className="font-medium text-white text-sm leading-tight truncate">
                {entry.teamName}
              </div>
              <div className="text-gray-500 text-xs">
                {entry.actualWins}W · {entry.expectedWins}exp
              </div>
            </div>
            <LuckBar value={entry.luckScore} max={maxLuck} />
            <div
              className={`w-14 text-right font-bold tabular-nums text-sm shrink-0 ${
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
