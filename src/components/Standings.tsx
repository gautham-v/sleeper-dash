import type { TeamStanding } from '../types/sleeper';
import { Avatar } from './Avatar';

interface StandingsProps {
  standings: TeamStanding[];
}

export function Standings({ standings }: StandingsProps) {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden shadow-lg border border-card-border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="text-gray-400 border-b border-card-border text-[10px] font-semibold uppercase tracking-wider bg-black/20">
              <th className="text-left py-4 px-3 pl-5">#</th>
              <th className="text-left py-4 px-3">Team</th>
              <th className="text-center py-4 px-3">W</th>
              <th className="text-center py-4 px-3">L</th>
              <th className="text-right py-4 px-3">PF</th>
              <th className="text-right py-4 px-3 hidden sm:table-cell">PA</th>
              <th className="text-right py-4 px-3 pr-5">Streak</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team, i) => {
              const isPlayoff = i < Math.ceil(standings.length / 3);
              return (
                <tr
                  key={team.rosterId}
                  className="border-b border-card-border/50 hover:bg-white/5 transition-colors group"
                >
                  <td className="py-4 px-3 pl-5">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 text-center font-medium ${i < 3 ? 'text-brand-cyan glow-text-cyan' : 'text-gray-500'}`}>{i + 1}</span>
                      {isPlayoff && (
                        <span className="w-1.5 h-4 rounded-full bg-brand-green/80 shadow-[0_0_8px_rgba(185,251,192,0.4)] inline-block" title="Playoff position" />
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar avatar={team.avatar} name={team.displayName} size="sm" />
                        {i === 0 && <div className="absolute -inset-1 border border-brand-cyan/50 rounded-full animate-pulse pointer-events-none"></div>}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-white leading-tight truncate max-w-[120px] sm:max-w-none group-hover:text-brand-cyan transition-colors">{team.teamName}</div>
                        <div className="text-gray-500 text-xs truncate max-w-[120px] sm:max-w-none">{team.displayName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-3 text-center font-bold text-brand-green">{team.wins}</td>
                  <td className="py-4 px-3 text-center font-bold text-gray-400">{team.losses}</td>
                  <td className="py-4 px-3 text-right text-white font-medium tabular-nums">{team.pointsFor.toFixed(2)}</td>
                  <td className="py-4 px-3 text-right text-gray-500 tabular-nums hidden sm:table-cell">{team.pointsAgainst.toFixed(2)}</td>
                  <td className="py-4 px-3 pr-5 text-right">
                    {team.streak ? (
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${
                          team.streak.startsWith('W')
                            ? 'bg-brand-green/10 text-brand-green border-brand-green/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}
                      >
                        {team.streak}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="py-3 px-5 text-[11px] font-medium text-gray-500 flex items-center gap-2 bg-black/10">
        <span className="w-1.5 h-3 rounded-full bg-brand-green/80 shadow-[0_0_8px_rgba(185,251,192,0.4)] inline-block" />
        Playoff position
      </div>
    </div>
  );
}
