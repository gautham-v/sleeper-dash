'use client';
import { Loader2 } from 'lucide-react';
import { usePlayerCareerHistory } from '@/hooks/usePlayerCareerHistory';
import { StatusBadge } from '@/components/ui/badges';

interface Props {
  leagueId: string;
  playerId: string;
  playerName: string;
  position: string;
}

export function PlayerCareerPanel({ leagueId, playerId }: Props) {
  const { data, isLoading, isError } = usePlayerCareerHistory(leagueId, playerId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
        <Loader2 className="animate-spin" size={14} />
        Loading career history…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-3 text-sm text-gray-500">Could not load career data.</div>
    );
  }

  const { seasons, draftedBy } = data;

  if (seasons.length === 0) {
    return (
      <div className="py-3 text-sm text-gray-500">No matchup data found for this player.</div>
    );
  }

  // Most recent first
  const orderedSeasons = [...seasons].reverse();
  const mostRecentSeason = seasons[seasons.length - 1]?.season;
  const draftOwnerIdForSeason = draftedBy
    ? seasons.find(ss => ss.season === draftedBy.season)?.ownerId
    : undefined;

  return (
    <div className="mt-2 rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-800">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Dynasty Career</span>
      </div>

      {/* Mobile: stacked cards */}
      <div className="sm:hidden divide-y divide-gray-800/60">
        {orderedSeasons.map((s, i) => {
          const isCurrent = s.season === mostRecentSeason;
          const isDraftSeason = draftedBy && s.season === draftedBy.season && s.ownerId === draftOwnerIdForSeason;
          return (
            <div
              key={`${s.season}-${s.ownerId}-${i}`}
              className={`px-4 py-3 ${isDraftSeason ? 'bg-yellow-900/10' : ''}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-300">{s.season}</span>
                  {isCurrent && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30">
                      current
                    </span>
                  )}
                  {isDraftSeason && <StatusBadge variant="drafted" />}
                </div>
                <span className="text-xs font-medium text-white tabular-nums">
                  {s.starterPoints > 0 ? `${s.starterPoints.toFixed(1)} pts` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span className="truncate max-w-[160px]">{s.ownerName}</span>
                <span>{s.starts} starts · {s.weeksOnRoster} wks</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider">
              <th className="text-left px-4 py-2">Season</th>
              <th className="text-left px-4 py-2">Owner</th>
              <th className="text-right px-4 py-2">Pts</th>
              <th className="text-right px-4 py-2">Starts</th>
              <th className="text-right px-4 py-2">Wks</th>
            </tr>
          </thead>
          <tbody>
            {orderedSeasons.map((s, i) => {
              const isCurrent = s.season === mostRecentSeason;
              const isDraftSeason = draftedBy && s.season === draftedBy.season && s.ownerId === draftOwnerIdForSeason;
              return (
                <tr
                  key={`${s.season}-${s.ownerId}-${i}`}
                  className={`border-b border-gray-800/60 ${isDraftSeason ? 'bg-yellow-900/10' : ''}`}
                >
                  <td className="px-4 py-2 font-medium text-gray-300">
                    <div className="flex items-center gap-1.5">
                      {s.season}
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30">
                          current
                        </span>
                      )}
                      {isDraftSeason && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-900/40 text-yellow-400 border border-yellow-700/40">
                          drafted
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-300 max-w-[120px] truncate">{s.ownerName}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-white font-medium">
                    {s.starterPoints > 0 ? s.starterPoints.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-400">{s.starts}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-400">{s.weeksOnRoster}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {draftedBy && (
        <div className="px-4 py-2.5 border-t border-gray-800 text-xs text-gray-500">
          Drafted by <span className="text-yellow-400 font-medium">{draftedBy.ownerName}</span>
          {' · '}{draftedBy.season}
          {' · '}R{draftedBy.round} P{draftedBy.pick}
        </div>
      )}
    </div>
  );
}
