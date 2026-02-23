import { useMemo, useState } from 'react';
import {
  Loader2, Trophy, Skull, Flame, Zap, TrendingUp, TrendingDown,
  Star, AlertTriangle, Swords, Timer, Medal, ChevronDown,
} from 'lucide-react';
import { useLeagueHistory } from '../hooks/useLeagueData';
import { calcAllTimeRecords, calcSeasonRecords } from '../utils/calculations';
import { Avatar } from './Avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { AllTimeRecordEntry } from '../types/sleeper';

interface Props {
  leagueId: string;
  onSelectManager?: (userId: string) => void;
}

const RECORD_META: Record<string, { icon: React.ReactNode; accentText: string }> = {
  'season-wins':         { icon: <Trophy size={14} />,        accentText: 'text-yellow-500' },
  'career-wins':         { icon: <Trophy size={14} />,        accentText: 'text-yellow-500' },
  'highest-season-pts':  { icon: <TrendingUp size={14} />,    accentText: 'text-foreground' },
  'most-titles':         { icon: <Trophy size={14} />,        accentText: 'text-yellow-500' },
  'most-last-place':     { icon: <Skull size={14} />,         accentText: 'text-muted-foreground' },
  'longest-win-streak':  { icon: <Flame size={14} />,         accentText: 'text-foreground' },
  'title-drought':       { icon: <Timer size={14} />,         accentText: 'text-muted-foreground' },
  'longest-loss-streak': { icon: <TrendingDown size={14} />,  accentText: 'text-muted-foreground' },
  'highest-weekly':      { icon: <Star size={14} />,          accentText: 'text-foreground' },
  'lowest-weekly':       { icon: <AlertTriangle size={14} />, accentText: 'text-muted-foreground' },
  'biggest-blowout':     { icon: <Zap size={14} />,           accentText: 'text-foreground' },
  'blowout-wins':        { icon: <Swords size={14} />,        accentText: 'text-foreground' },
  'playoff-wins':        { icon: <Medal size={14} />,         accentText: 'text-yellow-500' },
};

function HolderCell({ record, onSelectManager }: {
  record: AllTimeRecordEntry;
  onSelectManager?: (userId: string) => void;
}) {
  const isTied = record.coHolders && record.coHolders.length > 0;
  const allHolders = isTied
    ? [{ holderId: record.holderId, holder: record.holder, avatar: record.avatar }, ...record.coHolders!]
    : null;

  if (isTied && allHolders) {
    return (
      <div className="flex flex-col gap-1.5">
        <Badge variant="outline" className="text-xs w-fit rounded-full px-2 py-0.5 text-muted-foreground">
          Tied
        </Badge>
        {allHolders.map((h, i) => (
          <button
            key={i}
            className="flex items-center gap-2 min-w-0 group text-left"
            onClick={() => h.holderId && onSelectManager?.(h.holderId)}
            disabled={!h.holderId || !onSelectManager}
          >
            <Avatar avatar={h.avatar} name={h.holder} size="sm" />
            <span className={`font-medium text-white text-sm truncate ${h.holderId && onSelectManager ? 'group-hover:text-brand-cyan transition-colors' : ''}`}>
              {h.holder}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <button
      className="flex items-center gap-2 min-w-0 group text-left"
      onClick={() => record.holderId && onSelectManager?.(record.holderId)}
      disabled={!record.holderId || !onSelectManager}
    >
      <Avatar avatar={record.avatar} name={record.holder} size="sm" />
      <span className={`font-medium text-white text-sm truncate ${record.holderId && onSelectManager ? 'group-hover:text-brand-cyan transition-colors' : ''}`}>
        {record.holder}
      </span>
    </button>
  );
}

export function AllTimeRecords({ leagueId, onSelectManager }: Props) {
  const [selectedSeason, setSelectedSeason] = useState<string>('alltime');
  const { data: history, isLoading } = useLeagueHistory(leagueId);

  const availableSeasons = useMemo(() => {
    if (!history) return [];
    return [...history].map((s) => s.season).sort((a, b) => Number(b) - Number(a));
  }, [history]);

  const seasons = useMemo(() => {
    if (!history) return [];
    return [...history].map((h) => h.season).sort();
  }, [history]);

  const records = useMemo(() => {
    if (!history) return [];
    if (selectedSeason === 'alltime') return calcAllTimeRecords(history);
    const season = history.find((s) => s.season === selectedSeason);
    return season ? calcSeasonRecords(season) : [];
  }, [history, selectedSeason]);

  const selectedLabel = selectedSeason === 'alltime' ? 'All-Time' : selectedSeason;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={20} />
        Building all-time record book…
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="bg-muted/50 rounded-2xl p-8 text-center text-muted-foreground">
        No historical data available.
      </div>
    );
  }

  return (
    <div className="bg-card-bg rounded-xl border border-card-border overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-card-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0 flex-1">
          <Trophy size={14} className="text-yellow-500 shrink-0" />
          <span className="truncate">
            Spanning {seasons.length} season{seasons.length !== 1 ? 's' : ''}{' '}
            ({seasons[0]}–{seasons[seasons.length - 1]})
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7 border-card-border text-muted-foreground hover:text-foreground"
            >
              {selectedLabel} <ChevronDown size={11} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[120px]">
            <DropdownMenuItem
              className={selectedSeason === 'alltime' ? 'text-brand-cyan' : ''}
              onClick={() => setSelectedSeason('alltime')}
            >
              All-Time
            </DropdownMenuItem>
            {availableSeasons.map((season) => (
              <DropdownMenuItem
                key={season}
                className={selectedSeason === season ? 'text-brand-cyan' : ''}
                onClick={() => setSelectedSeason(season)}
              >
                {season}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Table className="w-full table-fixed">
        <colgroup>
          <col className="w-[42%]" />
          <col className="w-[34%]" />
          <col className="w-[24%]" />
          <col className="hidden sm:table-column" />
        </colgroup>
        <TableHeader>
          <TableRow className="border-gray-700 hover:bg-transparent">
            <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-medium py-3 px-3 pl-4 h-auto">
              Record
            </TableHead>
            <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-medium py-3 px-2 h-auto">
              Holder
            </TableHead>
            <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-medium py-3 px-2 pr-4 text-right h-auto">
              Value
            </TableHead>
            <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-medium py-3 px-2 pr-4 h-auto hidden sm:table-cell">
              Context
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const meta = RECORD_META[record.id] ?? { icon: <Star size={14} />, accentText: 'text-foreground' };
            return (
              <TableRow key={record.id} className="border-gray-800 hover:bg-gray-800/50">
                <TableCell className="py-3 px-3 pl-4 w-[40%]">
                  <div className="flex items-start gap-1.5">
                    <div className="w-4 h-4 flex items-center justify-center text-muted-foreground flex-shrink-0 mt-0.5">
                      {meta.icon}
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide leading-snug">
                      {record.category}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-3 px-2 w-[38%]">
                  <HolderCell record={record} onSelectManager={onSelectManager} />
                </TableCell>
                <TableCell className="py-3 px-2 pr-4 text-right w-[22%]">
                  <span className={`font-bold text-sm sm:text-base tabular-nums ${meta.accentText}`}>
                    {record.value}
                  </span>
                </TableCell>
                <TableCell className="py-3 px-2 pr-4 text-xs text-muted-foreground hidden sm:table-cell">
                  {record.context}
                </TableCell>
              </TableRow>
            );
          })}
          {records.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground text-sm">
                No records available for this season.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
