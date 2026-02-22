import type { BlowoutGame } from '../types/sleeper';
import { Zap, Flame } from 'lucide-react';

interface BlowoutsProps {
  blowouts: BlowoutGame[];
  closest: BlowoutGame[];
  hideHeaders?: boolean;
  onSelectManager?: (userId: string) => void;
}

function GameCard({
  game,
  variant,
  onSelectManager,
}: {
  game: BlowoutGame;
  variant: 'blowout' | 'close';
  onSelectManager?: (userId: string) => void;
}) {
  const accent = variant === 'blowout' ? 'text-orange-400' : 'text-cyan-400';
  const bg = variant === 'blowout' ? 'border-orange-900/40' : 'border-cyan-900/40';

  return (
    <div className={`bg-gray-900 rounded-xl p-4 border ${bg}`}>
      <div className="text-xs text-gray-500 mb-3">
        {game.season ? `${game.season} · ` : ''}{game.isPlayoff ? 'Playoffs' : `Week ${game.week}`}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <button
            className="text-left group w-full"
            onClick={() => game.winner.userId && onSelectManager?.(game.winner.userId)}
            disabled={!game.winner.userId || !onSelectManager}
          >
            <div className={`font-semibold text-white text-sm truncate ${game.winner.userId && onSelectManager ? 'group-hover:text-orange-300 transition-colors' : ''}`}>
              {game.winner.teamName}
            </div>
          </button>
          <div className="text-xs text-gray-400">Winner</div>
        </div>
        <div className="text-center shrink-0">
          <div className="flex items-center gap-1 text-lg font-bold tabular-nums">
            <span className="text-white">{game.winner.points.toFixed(2)}</span>
            <span className="text-gray-600 text-sm">–</span>
            <span className="text-gray-400">{game.loser.points.toFixed(2)}</span>
          </div>
          <div className={`text-xs font-semibold ${accent}`}>
            {variant === 'blowout' ? (
              <span>+{game.margin.toFixed(2)} margin</span>
            ) : (
              <span>{game.margin.toFixed(2)} apart</span>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0 text-right">
          <button
            className="text-right group w-full"
            onClick={() => game.loser.userId && onSelectManager?.(game.loser.userId)}
            disabled={!game.loser.userId || !onSelectManager}
          >
            <div className={`font-semibold text-gray-400 text-sm truncate ${game.loser.userId && onSelectManager ? 'group-hover:text-orange-300 transition-colors' : ''}`}>
              {game.loser.teamName}
            </div>
          </button>
          <div className="text-xs text-gray-500">Loser</div>
        </div>
      </div>
    </div>
  );
}

export function BlowoutsAndClose({ blowouts, closest, hideHeaders, onSelectManager }: BlowoutsProps) {
  return (
    <div className={`grid grid-cols-1 ${closest.length > 0 ? 'lg:grid-cols-2' : ''} gap-8`}>
      {blowouts.length > 0 && (
        <div>
          {!hideHeaders && (
            <h3 className="text-sm font-semibold text-orange-400 flex items-center gap-2 mb-4">
              <Flame size={14} /> Biggest Blowouts
            </h3>
          )}
          <div className="space-y-3">
            {blowouts.map((g, i) => (
              <GameCard key={i} game={g} variant="blowout" onSelectManager={onSelectManager} />
            ))}
          </div>
        </div>
      )}

      {closest.length > 0 && (
        <div>
          {!hideHeaders && (
            <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2 mb-4">
              <Zap size={14} /> Closest Games
            </h3>
          )}
          <div className="space-y-3">
            {closest.map((g, i) => (
              <GameCard key={i} game={g} variant="close" onSelectManager={onSelectManager} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
