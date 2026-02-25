'use client';

import { Avatar } from '@/components/Avatar';
import type { LuckEntry } from '@/types/sleeper';

interface Props {
  luckIndex: LuckEntry[];
  onSelectManager?: (userId: string) => void;
}

export function LuckTeaser({ luckIndex, onSelectManager }: Props) {
  if (luckIndex.length < 4) return null;

  const sorted = [...luckIndex].sort((a, b) => b.luckScore - a.luckScore);
  const featured = [
    ...sorted.slice(0, 2),
    ...sorted.slice(-2).reverse(),
  ];

  const maxAbs = Math.max(...luckIndex.map((e) => Math.abs(e.luckScore)), 1);

  const luckyEntries = featured.filter((e) => e.luckScore >= 0);
  const unluckyEntries = featured.filter((e) => e.luckScore < 0);

  const renderEntry = (entry: (typeof featured)[number]) => {
    const isLucky = entry.luckScore >= 0;
    const barWidth = `${Math.min(100, (Math.abs(entry.luckScore) / maxAbs) * 100)}%`;
    return (
      <button
        key={entry.userId}
        onClick={() => onSelectManager?.(entry.userId)}
        disabled={!onSelectManager}
        className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5 disabled:cursor-default"
      >
        <Avatar avatar={entry.avatar} name={entry.displayName} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{entry.displayName}</div>
          <div className="mt-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isLucky ? 'bg-brand-cyan' : 'bg-red-500'}`}
              style={{ width: barWidth }}
            />
          </div>
        </div>
        <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${isLucky ? 'text-brand-cyan' : 'text-red-400'}`}>
          {isLucky ? '+' : ''}{entry.luckScore.toFixed(1)}
        </span>
      </button>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-base">🍀</span>
          <h2 className="text-base font-semibold text-white">Luck Index</h2>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-3 ml-7">(Current Season)</p>
      <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
        {luckyEntries.length > 0 && (
          <div>
            <div className="px-4 pt-2.5 pb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Most Lucky</span>
            </div>
            {luckyEntries.map(renderEntry)}
          </div>
        )}
        {luckyEntries.length > 0 && unluckyEntries.length > 0 && (
          <div className="border-t border-gray-700/60 mx-4" />
        )}
        {unluckyEntries.length > 0 && (
          <div>
            <div className="px-4 pt-2.5 pb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Most Unlucky</span>
            </div>
            {unluckyEntries.map(renderEntry)}
          </div>
        )}
      </div>
    </div>
  );
}
