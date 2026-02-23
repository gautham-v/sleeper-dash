import { useMemo } from 'react';
import { Loader2, Trophy, Skull, Flame, Zap, TrendingUp, TrendingDown, Star, AlertTriangle, Swords, Timer, Medal } from 'lucide-react';
import { useLeagueHistory } from '../hooks/useLeagueData';
import { calcAllTimeRecords } from '../utils/calculations';
import { Avatar } from './Avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { AllTimeRecordEntry } from '../types/sleeper';

interface Props {
  leagueId: string;
  onSelectManager?: (userId: string) => void;
}

const RECORD_META: Record<string, { icon: React.ReactNode; accentText: string }> = {
  'career-wins':         { icon: <Trophy size={16} />,        accentText: 'text-yellow-500' },
  'highest-season-pts':  { icon: <TrendingUp size={16} />,    accentText: 'text-foreground' },
  'most-titles':         { icon: <Trophy size={16} />,        accentText: 'text-yellow-500' },
  'most-last-place':     { icon: <Skull size={16} />,         accentText: 'text-muted-foreground' },
  'longest-win-streak':  { icon: <Flame size={16} />,         accentText: 'text-foreground' },
  'title-drought':       { icon: <Timer size={16} />,         accentText: 'text-muted-foreground' },
  'longest-loss-streak': { icon: <TrendingDown size={16} />,  accentText: 'text-muted-foreground' },
  'highest-weekly':      { icon: <Star size={16} />,          accentText: 'text-foreground' },
  'lowest-weekly':       { icon: <AlertTriangle size={16} />, accentText: 'text-muted-foreground' },
  'biggest-blowout':     { icon: <Zap size={16} />,           accentText: 'text-foreground' },
  'blowout-wins':        { icon: <Swords size={16} />,        accentText: 'text-foreground' },
  'playoff-wins':        { icon: <Medal size={16} />,         accentText: 'text-yellow-500' },
};

function HolderButton({ holderId, holder, avatar, onSelectManager }: {
  holderId: string | null;
  holder: string;
  avatar: string | null;
  onSelectManager?: (userId: string) => void;
}) {
  return (
    <button
      className="flex items-center gap-3 min-w-0 group text-left"
      onClick={() => holderId && onSelectManager?.(holderId)}
      disabled={!holderId || !onSelectManager}
    >
      <Avatar avatar={avatar} name={holder} size="md" />
      <span className={`font-bold text-white text-base truncate ${holderId && onSelectManager ? 'group-hover:text-brand-cyan transition-colors cursor-pointer' : ''}`}>
        {holder}
      </span>
    </button>
  );
}

function RecordCard({ record, onSelectManager }: { record: AllTimeRecordEntry; onSelectManager?: (userId: string) => void }) {
  const meta = RECORD_META[record.id] ?? {
    icon: <Star size={16} />,
    accentText: 'text-foreground',
  };

  const isTied = record.coHolders && record.coHolders.length > 0;
  const allHolders = isTied
    ? [{ holderId: record.holderId, holder: record.holder, avatar: record.avatar }, ...record.coHolders!]
    : null;

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-none">
      <CardContent className="p-5 flex flex-col gap-4">
        {/* Category header */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
            {meta.icon}
          </div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{record.category}</span>
        </div>

        {/* Holder(s) */}
        {isTied && allHolders ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs font-medium text-muted-foreground rounded-full px-2 py-0.5">
                Tied
              </Badge>
              <span className={`font-bold text-xl tabular-nums ${meta.accentText}`}>{record.value}</span>
            </div>
            {allHolders.map((h, i) => (
              <HolderButton
                key={i}
                holderId={h.holderId}
                holder={h.holder}
                avatar={h.avatar}
                onSelectManager={onSelectManager}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-3 min-w-0 group"
              onClick={() => record.holderId && onSelectManager?.(record.holderId)}
              disabled={!record.holderId || !onSelectManager}
            >
              <Avatar avatar={record.avatar} name={record.holder} size="md" />
              <span className={`font-bold text-white text-base truncate ${record.holderId && onSelectManager ? 'group-hover:text-brand-cyan transition-colors cursor-pointer' : ''}`}>
                {record.holder}
              </span>
            </button>
            <span className={`ml-auto font-bold text-xl tabular-nums ${meta.accentText} flex-shrink-0`}>
              {record.value}
            </span>
          </div>
        )}

        {/* Context */}
        <div className="text-xs text-muted-foreground">{record.context}</div>
      </CardContent>
    </Card>
  );
}

export function AllTimeRecords({ leagueId, onSelectManager }: Props) {
  const { data: history, isLoading } = useLeagueHistory(leagueId);

  const records = useMemo(() => {
    if (!history) return [];
    return calcAllTimeRecords(history);
  }, [history]);

  const seasons = useMemo(() => {
    if (!history) return [];
    return [...history].map(h => h.season).sort();
  }, [history]);

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
    <div className="space-y-6">
      {/* Subtitle */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Trophy size={14} className="text-yellow-500" />
        <span>Spanning {seasons.length} season{seasons.length !== 1 ? 's' : ''} of history ({seasons[0]}–{seasons[seasons.length - 1]})</span>
      </div>

      {/* Record grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {records.map((record) => (
          <RecordCard key={record.id} record={record} onSelectManager={onSelectManager} />
        ))}
      </div>

      {records.length === 0 && (
        <div className="bg-muted/50 rounded-2xl p-8 text-center text-muted-foreground">
          Not enough data to compute records yet.
        </div>
      )}
    </div>
  );
}
