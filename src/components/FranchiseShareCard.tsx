import { PosBadge, TierBadge } from '@/components/ui/badges';
import type { FranchiseTier, StrategyMode } from '../types/sleeper';

export interface FranchiseShareCardProps {
  displayName: string;
  totalManagers: number;
  tier: FranchiseTier;
  warRank: number;
  wins: number;
  losses: number;
  luckScore: number;
  windowLength: number;
  peakYearOffset: number;
  currentWAR: number;
  strategyMode: StrategyMode;
  strategyHeadline: string;
  rationale: string[];
  keyPlayers: {
    name: string;
    position: string;
    age: number | null;
    dynastyValue: number | null;
    war: number;
  }[];
}

function tierEmoji(tier: FranchiseTier): string {
  switch (tier) {
    case 'Contender': return '🏆';
    case 'Fringe': return '⚡';
    case 'Rebuilding': return '🔨';
  }
}

function strategyModeColor(mode: StrategyMode): string {
  switch (mode) {
    case 'Push All-In Now':    return 'text-red-400';
    case 'Win-Now Pivot':      return 'text-orange-400';
    case 'Steady State':       return 'text-emerald-400';
    case 'Asset Accumulation': return 'text-brand-cyan';
    case 'Full Rebuild':       return 'text-yellow-400';
  }
}

export function FranchiseShareCard({
  displayName,
  totalManagers,
  tier,
  warRank,
  wins,
  losses,
  luckScore,
  windowLength,
  peakYearOffset,
  strategyMode,
  strategyHeadline,
  rationale,
  keyPlayers,
}: FranchiseShareCardProps) {
  const luckLabel =
    luckScore >= 2 ? ' · 🔥 Running hot' :
    luckScore <= -2 ? ' · 😓 Unlucky' :
    '';

  return (
    <div
      className="bg-base-bg border border-card-border rounded-2xl p-5 flex flex-col gap-4"
      style={{ width: 400, height: 520, overflow: 'hidden' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <TierBadge tier={tier} size="md" label={`${tierEmoji(tier)} ${tier}`} />
          <div className="text-xs text-gray-500 mt-1">
            #{warRank} of {totalManagers} · {wins}–{losses}{luckLabel}
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold text-white leading-tight truncate max-w-[160px]">
            {displayName}
          </div>
        </div>
      </div>

      <div className="border-t border-card-border" />

      {/* Strategy */}
      <div className="flex flex-col gap-0.5">
        <div className={`text-xl font-bold ${strategyModeColor(strategyMode)}`}>{strategyMode}</div>
        <div className="text-sm text-gray-400 leading-snug">{strategyHeadline}</div>
      </div>

      {/* Metric chips */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { value: `#${warRank}`, label: 'WAR Rank' },
          { value: `${windowLength} yr${windowLength !== 1 ? 's' : ''}`, label: 'Window' },
          { value: peakYearOffset === 0 ? 'Now' : `+${peakYearOffset} yr`, label: 'Peak Year' },
          { value: `${wins}–${losses}`, label: 'Record' },
        ].map(({ value, label }) => (
          <div key={label} className="bg-card-bg border border-card-border rounded-lg px-2 py-2 text-center">
            <div className="text-sm font-bold text-white tabular-nums">{value}</div>
            <div className="text-[10px] text-gray-600 mt-0.5 leading-tight">{label}</div>
          </div>
        ))}
      </div>

      {/* Franchise Pillars */}
      <div className="flex flex-col gap-1">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
          Franchise Pillars
        </div>
        {keyPlayers.length === 0 ? (
          <div className="text-xs text-gray-600">No production data available.</div>
        ) : (
          keyPlayers.slice(0, 3).map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <PosBadge pos={p.position} />
              <span className="text-sm text-gray-200 flex-1 truncate">{p.name}</span>
              {p.age != null && <span className="text-xs text-gray-500">age {p.age}</span>}
              {p.dynastyValue != null ? (
                <span className="text-xs font-medium text-yellow-400 tabular-nums">
                  {p.dynastyValue.toLocaleString()}
                </span>
              ) : (
                <span className={`text-xs font-medium tabular-nums ${p.war >= 0 ? 'text-sky-400' : 'text-red-400'}`}>
                  {p.war >= 0 ? '+' : ''}{p.war.toFixed(1)}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Rationale bullets */}
      <div className="flex flex-col gap-1">
        {rationale.slice(0, 2).map((r, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="text-white shrink-0 mt-0.5 text-xs">•</span>
            <span className="text-xs text-gray-400 leading-relaxed">{r}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between">
        <div className="text-xs text-gray-500">Screenshot to share</div>
        <div className="text-xs text-gray-500">leaguemate.fyi</div>
      </div>
    </div>
  );
}
