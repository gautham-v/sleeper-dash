import type { TeamStanding } from '../types/sleeper';
import { Avatar } from './Avatar';

interface StandingsProps {
  standings: TeamStanding[];
}

export function Standings({ standings }: StandingsProps) {
  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700 text-xs uppercase tracking-wider">
            <th className="text-left p-3 pl-4">#</th>
            <th className="text-left p-3">Team</th>
            <th className="text-center p-3">W</th>
            <th className="text-center p-3">L</th>
            <th className="text-right p-3">PF</th>
            <th className="text-right p-3">PA</th>
            <th className="text-right p-3 pr-4">Streak</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team, i) => {
            const isPlayoff = i < Math.ceil(standings.length / 3);
            return (
              <tr
                key={team.rosterId}
                className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
              >
                <td className="p-3 pl-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-4 text-center">{i + 1}</span>
                    {isPlayoff && (
                      <span className="w-1 h-4 rounded-full bg-green-500 inline-block" title="Playoff position" />
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Avatar avatar={team.avatar} name={team.displayName} size="sm" />
                    <div>
                      <div className="font-medium text-white leading-tight">{team.teamName}</div>
                      <div className="text-gray-500 text-xs">{team.displayName}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-center font-semibold text-green-400">{team.wins}</td>
                <td className="p-3 text-center text-red-400">{team.losses}</td>
                <td className="p-3 text-right text-white tabular-nums">{team.pointsFor.toFixed(2)}</td>
                <td className="p-3 text-right text-gray-400 tabular-nums">{team.pointsAgainst.toFixed(2)}</td>
                <td className="p-3 pr-4 text-right">
                  {team.streak ? (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        team.streak.startsWith('W')
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-red-900/50 text-red-400'
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
      <div className="p-3 pl-4 text-xs text-gray-500 flex items-center gap-2">
        <span className="w-1 h-3 rounded-full bg-green-500 inline-block" />
        Playoff position
      </div>
    </div>
  );
}
