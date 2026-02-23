import type { TeamStanding } from '../types/sleeper';
import { Avatar } from './Avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface StandingsProps {
  standings: TeamStanding[];
  onSelectManager?: (userId: string) => void;
}

export function Standings({ standings, onSelectManager }: StandingsProps) {
  const hasPlayoffData = standings.some(
    (s) => (s.playoffWins ?? 0) > 0 || (s.playoffLosses ?? 0) > 0
  );

  return (
    <>
      <Table className="min-w-[480px]">
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-4 px-3 pl-5 h-auto">
              #
            </TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-4 px-3 h-auto">
              Team
            </TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-4 px-3 text-center h-auto">
              W
            </TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-4 px-3 text-center h-auto">
              L
            </TableHead>
            {hasPlayoffData && (
              <TableHead
                className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-4 px-3 text-center h-auto hidden sm:table-cell"
                title="Playoff record"
              >
                Playoff
              </TableHead>
            )}
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-4 px-3 text-right h-auto">
              PF
            </TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-4 px-3 text-right h-auto hidden sm:table-cell">
              PA
            </TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-4 px-3 pr-5 text-right h-auto">
              Streak
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((team, i) => {
            const isPlayoff = i < Math.ceil(standings.length / 3);
            return (
              <TableRow
                key={team.rosterId}
                className="border-border hover:bg-muted/30"
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
                      <div className={`font-medium text-white leading-tight truncate max-w-[120px] sm:max-w-none ${team.userId && onSelectManager ? 'group-hover:text-brand-cyan transition-colors' : ''}`}>
                        {team.teamName}
                      </div>
                      <div className="text-muted-foreground text-xs truncate max-w-[120px] sm:max-w-none">
                        {team.displayName}
                      </div>
                    </div>
                  </button>
                </TableCell>
                <TableCell className="py-3.5 px-3 text-center font-semibold text-foreground">
                  {team.wins}
                </TableCell>
                <TableCell className="py-3.5 px-3 text-center text-muted-foreground">
                  {team.losses}
                </TableCell>
                {hasPlayoffData && (
                  <TableCell className="py-3.5 px-3 text-center hidden sm:table-cell">
                    {(team.playoffWins ?? 0) > 0 || (team.playoffLosses ?? 0) > 0 ? (
                      <span className="text-xs font-medium tabular-nums text-yellow-400">
                        {team.playoffWins ?? 0}–{team.playoffLosses ?? 0}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="py-3.5 px-3 text-right text-white tabular-nums">
                  {team.pointsFor.toFixed(2)}
                </TableCell>
                <TableCell className="py-3.5 px-3 text-right text-muted-foreground tabular-nums hidden sm:table-cell">
                  {team.pointsAgainst.toFixed(2)}
                </TableCell>
                <TableCell className="py-3.5 px-3 pr-5 text-right">
                  {team.streak ? (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground"
                    >
                      {team.streak}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="py-3.5 px-5 text-xs text-muted-foreground flex items-center gap-4 border-t border-border">
        <span className="flex items-center gap-2">
          <span className="w-1 h-3 rounded-full bg-green-500 inline-block" />
          Playoff position
        </span>
        {hasPlayoffData && (
          <span className="text-yellow-500/70">Playoff column shows postseason W–L</span>
        )}
      </div>
    </>
  );
}
