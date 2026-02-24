import type { TeamAllTimeStats } from '../types/sleeper';
import { Avatar } from './Avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

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
    <>
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 pl-4 h-auto w-8">
              #
            </TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 h-auto">
              Team
            </TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 text-center h-auto w-14">
              W–L
            </TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 text-center h-auto w-14">
              Win%
            </TableHead>
            {hasPlayoffData && (
              <TableHead
                className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-4 px-3 text-center h-auto hidden sm:table-cell w-16"
                title="All-time playoff record"
              >
                Playoff
              </TableHead>
            )}
            <TableHead
              className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-4 px-3 text-right h-auto hidden sm:table-cell w-16"
              title="Average points per season"
            >
              Avg PF
            </TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-4 px-3 pr-5 text-right h-auto w-14">
              Titles
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((team, i) => (
            <TableRow key={team.userId} className="border-border hover:bg-muted/30">
              <TableCell className="py-3 px-2 pl-4">
                <span className="text-muted-foreground w-4 text-center inline-block text-sm">{i + 1}</span>
              </TableCell>
              <TableCell className="py-3 px-2">
                <button
                  className="flex items-center gap-2 text-left group w-full min-w-0"
                  onClick={() => team.userId && onSelectManager?.(team.userId)}
                  disabled={!team.userId || !onSelectManager}
                >
                  <Avatar avatar={team.avatar} name={team.displayName} size="sm" />
                  <div className="min-w-0">
                    <div className={`font-medium text-white text-sm leading-tight truncate ${team.userId && onSelectManager ? 'group-hover:text-brand-cyan transition-colors' : ''}`}>
                      {team.displayName}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {team.totalSeasons} season{team.totalSeasons !== 1 ? 's' : ''}
                    </div>
                  </div>
                </button>
              </TableCell>
              <TableCell className="py-3 px-2 text-center tabular-nums text-sm">
                <span className="text-foreground font-semibold">{team.totalWins}</span>
                <span className="text-muted-foreground/50 mx-0.5">–</span>
                <span className="text-muted-foreground">{team.totalLosses}</span>
              </TableCell>
              <TableCell className="py-3 px-2 text-center tabular-nums text-foreground text-sm">
                {(team.winPct * 100).toFixed(1)}%
              </TableCell>
              {hasPlayoffData && (
                <TableCell className="py-3.5 px-3 text-center hidden sm:table-cell">
                  {team.playoffWins > 0 || team.playoffLosses > 0 ? (
                    <span className="text-xs font-medium tabular-nums text-yellow-400">
                      {team.playoffWins}–{team.playoffLosses}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">—</span>
                  )}
                </TableCell>
              )}
              <TableCell className="py-3 px-2 text-right text-muted-foreground tabular-nums hidden sm:table-cell">
                {team.avgPointsFor.toFixed(0)}
              </TableCell>
              <TableCell className="py-3 px-2 pr-4 text-right">
                {team.titles > 0 ? (
                  <span className="text-yellow-400 font-semibold tabular-nums">
                    {'🏆'.repeat(Math.min(team.titles, 3))}
                    {team.titles > 3 ? ` ×${team.titles}` : ''}
                  </span>
                ) : (
                  <span className="text-muted-foreground/40 text-xs">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="py-3 px-4 text-xs text-muted-foreground border-t border-border">
        Sorted by total wins · Avg PF is per-season average
      </div>
    </>
  );
}
