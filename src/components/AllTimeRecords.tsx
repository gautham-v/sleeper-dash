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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Trophy size={14} className="text-yellow-500" />
          <span>
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

      <Table className="min-w-[520px]">
        <TableHeader>
          <TableRow className="border-gray-700 hover:bg-transparent">
            <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-medium py-3 px-3 pl-5 h-auto w-[38%]">
              Record
            </TableHead>
            <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-medium py-3 px-3 h-auto w-[28%]">
              Holder
            </TableHead>
            <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-medium py-3 px-3 text-right h-auto w-[14%]">
              Value
            </TableHead>
            <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-medium py-3 px-3 pr-5 h-auto hidden sm:table-cell">
              Context
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const meta = RECORD_META[record.id] ?? { icon: <Star size={14} />, accentText: 'text-foreground' };
            return (
              <TableRow key={record.id} className="border-gray-800 hover:bg-gray-800/50">
                <TableCell className="py-3.5 px-3 pl-5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 flex items-center justify-center text-muted-foreground flex-shrink-0">
                      {meta.icon}
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
                      {record.category}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-3.5 px-3">
                  <HolderCell record={record} onSelectManager={onSelectManager} />
                </TableCell>
                <TableCell className="py-3.5 px-3 text-right">
                  <span className={`font-bold text-base tabular-nums ${meta.accentText}`}>
                    {record.value}
                  </span>
                </TableCell>
                <TableCell className="py-3.5 px-3 pr-5 text-xs text-muted-foreground hidden sm:table-cell">
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
