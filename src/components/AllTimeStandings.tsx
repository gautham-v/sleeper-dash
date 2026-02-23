import type { TeamAllTimeStats } from '../types/sleeper';
import { Avatar } from './Avatar';

interface AllTimeStandingsProps {
  stats: TeamAllTimeStats[];
  onSelectManager?: (userId: string) => void;
}

export function AllTimeStandings({ stats, onSelectManager }: AllTimeStandingsProps) {
  const sorted = [...stats].sort((a, b) => {
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    return b.winPct - a.winPct;
  });

  const hasPlayoffData = sorted.some((s) => s.playoffWins > 0 || s.playoffLosses > 0);

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      {/* ── Mobile card list (hidden sm+) ── */}
      <div className="sm:hidden divide-y divide-gray-800">
        {sorted.map((team, i) => (
          <button
            key={team.userId}
            className="w-full text-left px-4 py-3.5 hover:bg-gray-800/50 transition-colors flex items-center gap-3 disabled:cursor-default"
            onClick={() => team.userId && onSelectManager?.(team.userId)}
            disabled={!team.userId || !onSelectManager}
          >
            {/* Rank */}
            <span className="text-gray-500 text-sm tabular-nums w-5 flex-shrink-0 text-center">{i + 1}</span>

            <Avatar avatar={team.avatar} name={team.displayName} size="sm" />

            {/* Name + seasons */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white text-sm truncate leading-tight">{team.displayName}</div>
              <div className="text-gray-500 text-xs">{team.totalSeasons} season{team.totalSeasons !== 1 ? 's' : ''}</div>
            </div>

            {/* Stats cluster */}
            <div className="flex items-center gap-3 flex-shrink-0 text-right">
              <div className="text-xs">
                <span className="text-green-400 font-semibold tabular-nums">{team.totalWins}</span>
                <span className="text-gray-600 mx-0.5">–</span>
                <span className="text-red-400 tabular-nums">{team.totalLosses}</span>
              </div>
              <div className="text-xs text-gray-300 tabular-nums">{(team.winPct * 100).toFixed(1)}%</div>
              {team.titles > 0 && (
                <span className="text-yellow-400 font-semibold text-xs">
                  {'🏆'.repeat(Math.min(team.titles, 3))}{team.titles > 3 ? ` ×${team.titles}` : ''}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* ── Desktop table (hidden below sm) ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700 text-xs uppercase tracking-wider">
              <th className="text-left py-4 px-3 pl-5">#</th>
              <th className="text-left py-4 px-3">Team</th>
              <th className="text-center py-4 px-3">W–L</th>
              <th className="text-center py-4 px-3">Win%</th>
              {hasPlayoffData && (
                <th className="text-center py-4 px-3" title="All-time playoff record">
                  Playoff
                </th>
              )}
              <th className="text-right py-4 px-3" title="Average points per season">
                Avg PF
              </th>
              <th className="text-right py-4 px-3 pr-5">Titles</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((team, i) => (
              <tr
                key={team.userId}
                className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
              >
                <td className="py-3.5 px-3 pl-5">
                  <span className="text-gray-400 w-4 text-center inline-block">{i + 1}</span>
                </td>
                <td className="py-3.5 px-3">
                  <button
                    className="flex items-center gap-2.5 text-left group w-full"
                    onClick={() => team.userId && onSelectManager?.(team.userId)}
                    disabled={!team.userId || !onSelectManager}
                  >
                    <Avatar avatar={team.avatar} name={team.displayName} size="sm" />
                    <div className="min-w-0">
                      <div className={`font-medium text-white leading-tight truncate ${team.userId && onSelectManager ? 'group-hover:text-brand-cyan transition-colors' : ''}`}>
                        {team.displayName}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {team.totalSeasons} season{team.totalSeasons !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </button>
                </td>
                <td className="py-3.5 px-3 text-center tabular-nums">
                  <span className="text-green-400 font-semibold">{team.totalWins}</span>
                  <span className="text-gray-600 mx-0.5">–</span>
                  <span className="text-red-400">{team.totalLosses}</span>
                </td>
                <td className="py-3.5 px-3 text-center tabular-nums text-gray-300">
                  {(team.winPct * 100).toFixed(1)}%
                </td>
                {hasPlayoffData && (
                  <td className="py-3.5 px-3 text-center">
                    {team.playoffWins > 0 || team.playoffLosses > 0 ? (
                      <span className="text-xs font-medium tabular-nums text-yellow-400">
                        {team.playoffWins}–{team.playoffLosses}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                )}
                <td className="py-3.5 px-3 text-right text-gray-400 tabular-nums">
                  {team.avgPointsFor.toFixed(0)}
                </td>
                <td className="py-3.5 px-3 pr-5 text-right">
                  {team.titles > 0 ? (
                    <span className="text-yellow-400 font-semibold tabular-nums">
                      {'🏆'.repeat(Math.min(team.titles, 3))}
                      {team.titles > 3 ? ` ×${team.titles}` : ''}
                    </span>
                  ) : (
                    <span className="text-gray-600 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="py-3 px-4 sm:px-5 text-xs text-gray-500">
        Sorted by total wins · Avg PF is per-season average
      </div>
    </div>
  );
}
