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
      <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden flex justify-end relative">
        {!isLucky && (
          <div
            className="h-full bg-red-500 rounded-full shadow-[0_0_10px_rgba(248,113,113,0.5)] relative"
            style={{ width: `${pct * 100}%` }}
          >
            <div className="absolute inset-0 bg-white/20 w-full rounded-full"></div>
          </div>
        )}
      </div>
      <div className="w-px h-4 bg-card-border shrink-0" />
      {/* Right (lucky) side */}
      <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden relative">
        {isLucky && (
          <div
            className="h-full bg-brand-green rounded-full shadow-[0_0_10px_rgba(185,251,192,0.5)] relative"
            style={{ width: `${pct * 100}%` }}
          >
            <div className="absolute inset-0 bg-white/20 w-full rounded-full"></div>
          </div>
        )}
      </div>
    </div>
  );
}

export function LuckIndex({ entries }: LuckIndexProps) {
  const maxLuck = Math.max(...entries.map((e) => Math.abs(e.luckScore)));

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-gray-500 mb-5 uppercase tracking-wider font-medium">
        Luck = Actual wins minus expected wins (if you played every team each week).
        Positive = lucky, Negative = unlucky.
      </p>
      <div className="bg-card-bg rounded-2xl overflow-hidden border border-card-border shadow-lg">
        {entries.map((entry, i) => (
          <div
            key={entry.rosterId}
            className="flex items-center gap-4 px-5 py-4 border-b border-card-border/50 last:border-0 hover:bg-white/5 transition-colors group"
          >
            <span className={`w-5 text-center font-bold text-sm ${i < 3 ? 'text-brand-cyan glow-text-cyan' : 'text-gray-500'}`}>{i + 1}</span>
            <div className="relative">
              <Avatar avatar={entry.avatar} name={entry.displayName} size="sm" />
              {i === 0 && <div className="absolute -inset-1 border border-brand-cyan/50 rounded-full animate-pulse pointer-events-none"></div>}
            </div>
            <div className="w-24 sm:w-32 shrink-0">
              <div className="font-bold text-white text-sm leading-tight truncate group-hover:text-brand-cyan transition-colors">
                {entry.teamName}
              </div>
              <div className="text-gray-500 text-xs mt-0.5 font-medium">
                {entry.actualWins}W · {entry.expectedWins}exp
              </div>
            </div>
            <LuckBar value={entry.luckScore} max={maxLuck} />
            <div
              className={`w-14 text-right font-black tabular-nums text-sm shrink-0 drop-shadow-sm ${
                entry.luckScore > 0
                  ? 'text-brand-green'
                  : entry.luckScore < 0
                  ? 'text-red-400'
                  : 'text-gray-500'
              }`}
            >
              {entry.luckScore > 0 ? '+' : ''}
              {entry.luckScore.toFixed(1)}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-gray-500 px-2 mt-2">
        <span className="text-red-400/80">Most Unlucky</span>
        <span className="text-brand-green/80">Most Lucky</span>
      </div>
    </div>
  );
}
