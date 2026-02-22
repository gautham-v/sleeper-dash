import type { BlowoutGame } from '../types/sleeper';
import { Zap, Flame } from 'lucide-react';

interface BlowoutsProps {
  blowouts: BlowoutGame[];
  closest: BlowoutGame[];
  hideHeaders?: boolean;
}

function GameCard({ game, variant }: { game: BlowoutGame; variant: 'blowout' | 'close' }) {
  const accent = variant === 'blowout' ? 'text-red-400' : 'text-brand-cyan';
  const bg = variant === 'blowout' ? 'border-red-500/20 bg-red-500/5' : 'border-brand-cyan/20 bg-brand-cyan/5';

  return (
    <div className={`rounded-2xl p-4 border ${bg} backdrop-blur-sm transition-all hover:bg-white/5`}>
      <div className="text-xs font-semibold text-gray-500 mb-3 tracking-wider uppercase">Week {game.week}</div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white text-sm truncate">{game.winner.teamName}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Winner</div>
        </div>
        <div className="text-center shrink-0 px-2">
          <div className="flex items-center justify-center gap-1.5 text-lg font-black tabular-nums tracking-tight">
            <span className="text-white drop-shadow-sm">{game.winner.points.toFixed(2)}</span>
            <span className="text-gray-600 text-sm font-normal">–</span>
            <span className="text-gray-400 drop-shadow-sm">{game.loser.points.toFixed(2)}</span>
          </div>
          <div className={`text-[11px] font-bold mt-1 tracking-wide ${accent}`}>
            {variant === 'blowout' ? (
              <span className="drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]">+{game.margin.toFixed(2)} margin</span>
            ) : (
              <span className="drop-shadow-[0_0_5px_rgba(0,229,255,0.5)]">{game.margin.toFixed(2)} apart</span>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0 text-right">
          <div className="font-semibold text-gray-400 text-sm truncate">{game.loser.teamName}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Loser</div>
        </div>
      </div>
    </div>
  );
}

export function BlowoutsAndClose({ blowouts, closest, hideHeaders }: BlowoutsProps) {
  return (
    <div className={`grid grid-cols-1 ${closest.length > 0 ? 'lg:grid-cols-2' : ''} gap-8`}>
      {blowouts.length > 0 && (
        <div className="bg-card-bg rounded-2xl p-5 border border-card-border shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-all group-hover:bg-red-500/10"></div>
          {!hideHeaders && (
            <h3 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-5 tracking-wide relative z-10">
              <Flame size={16} className="drop-shadow-[0_0_5px_rgba(248,113,113,0.6)]" /> Biggest Blowouts
            </h3>
          )}
          <div className="space-y-3 relative z-10">
            {blowouts.map((g, i) => (
              <GameCard key={i} game={g} variant="blowout" />
            ))}
          </div>
        </div>
      )}

      {closest.length > 0 && (
        <div className="bg-card-bg rounded-2xl p-5 border border-card-border shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-cyan/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-all group-hover:bg-brand-cyan/10"></div>
          {!hideHeaders && (
            <h3 className="text-sm font-bold text-brand-cyan flex items-center gap-2 mb-5 tracking-wide relative z-10">
              <Zap size={16} className="drop-shadow-[0_0_5px_rgba(0,229,255,0.6)]" /> Closest Games
            </h3>
          )}
          <div className="space-y-3 relative z-10">
            {closest.map((g, i) => (
              <GameCard key={i} game={g} variant="close" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
