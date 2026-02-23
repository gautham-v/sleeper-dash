import type { TeamStanding } from '../types/sleeper';
import { Avatar } from './Avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface StandingsProps {
  standings: TeamStanding[];
  onSelectManager?: (userId: string) => void;
}

export function Standings({ standings, onSelectManager }: StandingsProps) {
  const hasPlayoffData = standings.some(
    (s) => (s.playoffWins ?? 0) > 0 || (s.playoffLosses ?? 0) > 0
  );

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      {/* Mobile card list (hidden sm+) */}
      <div className="sm:hidden divide-y divide-gray-800">
        {standings.map((team, i) => {
          const isPlayoff = i < Math.ceil(standings.length / 3);
          return (
            <button
              key={team.rosterId}
              className="w-full text-left px-4 py-3.5 hover:bg-gray-800/50 transition-colors flex items-center gap-3 disabled:cursor-default"
              onClick={() => team.userId && onSelectManager?.(team.userId)}
              disabled={!team.userId || !onSelectManager}
            >
              {/* Rank + playoff indicator */}
              <div className="flex items-center gap-1.5 w-7 flex-shrink-0">
                <span className="text-gray-500 text-sm tabular-nums">{i + 1}</span>
                {isPlayoff && (
                  <span className="w-1 h-4 rounded-full bg-green-500 inline-block" title="Playoff position" />
                )}
              </div>

              {/* Avatar */}
              <Avatar avatar={team.avatar} name={team.displayName} size="sm" />

              {/* Name block */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white text-sm truncate leading-tight">{team.teamName}</div>
                <div className="text-gray-500 text-xs truncate">{team.displayName}</div>
              </div>

              {/* Stats cluster */}
              <div className="flex items-center gap-3 flex-shrink-0 text-right">
                <div>
                  <span className="text-green-400 font-semibold tabular-nums text-sm">{team.wins}</span>
                  <span className="text-gray-600 mx-0.5">–</span>
                  <span className="text-red-400 tabular-nums text-sm">{team.losses}</span>
                </div>
                <div className="text-xs text-gray-400 tabular-nums">{team.pointsFor.toFixed(0)}</div>
                {team.streak && (
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border-0 ${
                      team.streak.startsWith('W')
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-red-900/50 text-red-400'
                    }`}
                  >
                    {team.streak}
                  </Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop table (hidden below sm) */}
      <div className="hidden sm:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-gray-400 border-b border-gray-700 text-xs uppercase tracking-wider">
              <TableHead className="text-left py-4 px-3 pl-5">#</TableHead>
              <TableHead className="text-left py-4 px-3">Team</TableHead>
              <TableHead className="text-center py-4 px-3">W</TableHead>
              <TableHead className="text-center py-4 px-3">L</TableHead>
              {hasPlayoffData && (
                <TableHead className="text-center py-4 px-3" title="Playoff record">Playoff</TableHead>
              )}
              <TableHead className="text-right py-4 px-3">PF</TableHead>
              <TableHead className="text-right py-4 px-3">PA</TableHead>
              <TableHead className="text-right py-4 px-3 pr-5">Streak</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings.map((team, i) => {
              const isPlayoff = i < Math.ceil(standings.length / 3);
              return (
                <TableRow
                  key={team.rosterId}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <TableCell className="py-3.5 px-3 pl-5">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-4 text-center">{i + 1}</span>
                      {isPlayoff && (
                        <span className="w-1 h-4 rounded-full bg-green-500 inline-block" title="Playoff position" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5 px-3">
                    <button
                      className="flex items-center gap-2.5 text-left group w-full"
                      onClick={() => team.userId && onSelectManager?.(team.userId)}
                      disabled={!team.userId || !onSelectManager}
                    >
                      <Avatar avatar={team.avatar} name={team.displayName} size="sm" />
                      <div className="min-w-0">
                        <div className={`font-medium text-white leading-tight truncate ${team.userId && onSelectManager ? 'group-hover:text-brand-cyan transition-colors' : ''}`}>
                          {team.teamName}
                        </div>
                        <div className="text-gray-500 text-xs truncate">{team.displayName}</div>
                      </div>
                    </button>
                  </TableCell>
                  <TableCell className="py-3.5 px-3 text-center font-semibold text-green-400">{team.wins}</TableCell>
                  <TableCell className="py-3.5 px-3 text-center text-red-400">{team.losses}</TableCell>
                  {hasPlayoffData && (
                    <TableCell className="py-3.5 px-3 text-center">
                      {(team.playoffWins ?? 0) > 0 || (team.playoffLosses ?? 0) > 0 ? (
                        <span className="text-xs font-medium tabular-nums text-yellow-400">
                          {team.playoffWins ?? 0}–{team.playoffLosses ?? 0}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="py-3.5 px-3 text-right text-white tabular-nums">{team.pointsFor.toFixed(2)}</TableCell>
                  <TableCell className="py-3.5 px-3 text-right text-gray-400 tabular-nums">{team.pointsAgainst.toFixed(2)}</TableCell>
                  <TableCell className="py-3.5 px-3 pr-5 text-right">
                    {team.streak ? (
                      <Badge
                        variant="outline"
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border-0 ${
                          team.streak.startsWith('W')
                            ? 'bg-green-900/50 text-green-400'
                            : 'bg-red-900/50 text-red-400'
                        }`}
                      >
                        {team.streak}
                      </Badge>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="py-3 px-4 sm:px-5 text-xs text-gray-500 flex items-center gap-4">
        <span className="flex items-center gap-2">
          <span className="w-1 h-3 rounded-full bg-green-500 inline-block" />
          Playoff position
        </span>
        {hasPlayoffData && (
          <span className="text-yellow-500/70">Playoff column shows postseason W–L</span>
        )}
      </div>
    </div>
  );
}
