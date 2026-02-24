'use client';

import { Users, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CrossLeagueRosterData } from '@/hooks/useCrossLeagueAnalytics';

const POSITION_COLORS: Record<string, string> = {
  QB:  'bg-red-900/50 text-red-300 border-red-800/50',
  RB:  'bg-green-900/50 text-green-300 border-green-800/50',
  WR:  'bg-blue-900/50 text-blue-300 border-blue-800/50',
  TE:  'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
  K:   'bg-gray-700 text-gray-300 border-gray-600',
  DEF: 'bg-purple-900/50 text-purple-300 border-purple-800/50',
  DST: 'bg-purple-900/50 text-purple-300 border-purple-800/50',
};

interface CareerHoldingsProps {
  data: CrossLeagueRosterData;
}

export function CareerHoldings({ data }: CareerHoldingsProps) {
  if (data.isLoading) {
    return (
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-3 text-sm text-gray-500 px-1">
          <Loader2 size={14} className="animate-spin text-brand-cyan flex-shrink-0" />
          Loading current rosters…
        </div>
        <Skeleton className="h-64 w-full rounded-xl bg-card-bg/60" />
      </div>
    );
  }

  if (data.players.length === 0) {
    return (
      <div className="py-16 text-center space-y-2">
        <Users size={28} className="mx-auto text-gray-700" />
        <p className="text-sm text-gray-500">No roster data available.</p>
        <p className="text-xs text-gray-700">Holdings are derived from your current rosters in active leagues.</p>
      </div>
    );
  }

  const uniquePlayers = data.players.length;
  const stackedPlayers = data.players.filter((p) => p.shares > 1).length;

  return (
    <div className="space-y-4 pt-2">
      {/* Summary */}
      <div className="flex flex-wrap gap-2 px-1">
        <Badge variant="outline" className="border-card-border text-gray-400 text-[11px]">
          {uniquePlayers} unique players
        </Badge>
        {stackedPlayers > 0 && (
          <Badge variant="outline" className="border-brand-cyan/30 text-brand-cyan text-[11px]">
            {stackedPlayers} stacked {stackedPlayers === 1 ? 'player' : 'players'}
          </Badge>
        )}
      </div>

      {/* Holdings table */}
      <Card className="border-card-border bg-card-bg overflow-hidden">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Users size={13} />
            Current Roster Holdings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[520px]">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-card-border/50 hover:bg-transparent sticky top-0 bg-card-bg z-10">
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider pl-4">Player</TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center">Pos</TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center">Team</TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider text-center">Shares</TableHead>
                    <TableHead className="text-[11px] text-gray-600 font-medium uppercase tracking-wider pr-4">Leagues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.players.map((player) => {
                    const posClass = POSITION_COLORS[player.position] ?? 'bg-gray-700 text-gray-300 border-gray-600';
                    const isStacked = player.shares > 1;

                    return (
                      <TableRow
                        key={player.playerId}
                        className={`border-card-border/50 hover:bg-white/3 ${isStacked ? 'bg-brand-cyan/3' : ''}`}
                      >
                        <TableCell className="pl-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {isStacked && (
                              <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan flex-shrink-0" />
                            )}
                            <span className="text-sm font-medium text-white truncate max-w-[140px]">
                              {player.playerName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${posClass}`}>
                            {player.position}
                          </span>
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                          <span className="text-xs text-gray-400">{player.team ?? '—'}</span>
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                          {isStacked ? (
                            <span className="text-sm font-bold text-brand-cyan">{player.shares}</span>
                          ) : (
                            <span className="text-sm text-gray-500">1</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {player.leagueNames.map((name, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="border-card-border/60 text-gray-500 text-[10px] h-4 px-1.5 truncate max-w-[100px]"
                              >
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {stackedPlayers > 0 && (
        <p className="text-[11px] text-gray-600 px-1">
          <span className="text-brand-cyan">●</span> Highlighted players appear on rosters in multiple leagues.
        </p>
      )}
    </div>
  );
}
