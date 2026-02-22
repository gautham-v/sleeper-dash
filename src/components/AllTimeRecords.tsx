import { useMemo } from 'react';
import { Loader2, Trophy, Skull, Flame, Zap, TrendingUp, TrendingDown, Star, AlertTriangle, Swords, Timer, Medal } from 'lucide-react';
import { useLeagueHistory } from '../hooks/useLeagueData';
import { calcAllTimeRecords } from '../utils/calculations';
import { Avatar } from './Avatar';
import type { AllTimeRecordEntry } from '../types/sleeper';

interface Props {
  leagueId: string;
  onSelectManager?: (userId: string) => void;
}

const RECORD_META: Record<string, {
  icon: React.ReactNode;
  accentBg: string;
  accentBorder: string;
  accentText: string;
  badgeBg: string;
}> = {
  'career-wins':        { icon: <Trophy size={16} />,        accentBg: 'bg-yellow-900/20', accentBorder: 'border-yellow-700/40', accentText: 'text-yellow-400',  badgeBg: 'bg-yellow-900/40' },
  'highest-season-pts': { icon: <TrendingUp size={16} />,    accentBg: 'bg-green-900/20',  accentBorder: 'border-green-700/40',  accentText: 'text-green-400',   badgeBg: 'bg-green-900/40' },
  'most-titles':        { icon: <Trophy size={16} />,        accentBg: 'bg-yellow-900/20', accentBorder: 'border-yellow-700/40', accentText: 'text-yellow-400',  badgeBg: 'bg-yellow-900/40' },
  'most-last-place':    { icon: <Skull size={16} />,         accentBg: 'bg-red-900/20',    accentBorder: 'border-red-700/40',    accentText: 'text-red-400',     badgeBg: 'bg-red-900/40' },
  'longest-win-streak': { icon: <Flame size={16} />,         accentBg: 'bg-orange-900/20', accentBorder: 'border-orange-700/40', accentText: 'text-orange-400',  badgeBg: 'bg-orange-900/40' },
  'title-drought':      { icon: <Timer size={16} />,         accentBg: 'bg-gray-800/40',   accentBorder: 'border-gray-700/40',   accentText: 'text-gray-400',    badgeBg: 'bg-gray-700/40' },
  'longest-loss-streak':{ icon: <TrendingDown size={16} />,  accentBg: 'bg-red-900/20',    accentBorder: 'border-red-700/40',    accentText: 'text-red-400',     badgeBg: 'bg-red-900/40' },
  'highest-weekly':     { icon: <Star size={16} />,          accentBg: 'bg-indigo-900/20', accentBorder: 'border-indigo-700/40', accentText: 'text-indigo-400',  badgeBg: 'bg-indigo-900/40' },
  'lowest-weekly':      { icon: <AlertTriangle size={16} />, accentBg: 'bg-gray-800/40',   accentBorder: 'border-gray-700/40',   accentText: 'text-gray-400',    badgeBg: 'bg-gray-700/40' },
  'biggest-blowout':    { icon: <Zap size={16} />,           accentBg: 'bg-purple-900/20', accentBorder: 'border-purple-700/40', accentText: 'text-purple-400',  badgeBg: 'bg-purple-900/40' },
  'blowout-wins':       { icon: <Swords size={16} />,        accentBg: 'bg-orange-900/20', accentBorder: 'border-orange-700/40', accentText: 'text-orange-400',  badgeBg: 'bg-orange-900/40' },
  'playoff-wins':       { icon: <Medal size={16} />,         accentBg: 'bg-yellow-900/20', accentBorder: 'border-yellow-700/40', accentText: 'text-yellow-400',  badgeBg: 'bg-yellow-900/40' },
};

function RecordCard({ record, onSelectManager }: { record: AllTimeRecordEntry; onSelectManager?: (userId: string) => void }) {
  const meta = RECORD_META[record.id] ?? {
    icon: <Star size={16} />,
    accentBg: 'bg-gray-800/40',
    accentBorder: 'border-gray-700/40',
    accentText: 'text-gray-400',
    badgeBg: 'bg-gray-700/40',
  };

  return (
    <div className={`rounded-2xl border ${meta.accentBorder} ${meta.accentBg} p-5 flex flex-col gap-4`}>
      {/* Category header */}
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.badgeBg} ${meta.accentText}`}>
          {meta.icon}
        </div>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{record.category}</span>
      </div>

      {/* Holder */}
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

      {/* Context */}
      <div className="text-xs text-gray-500">{record.context}</div>
    </div>
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
      <div className="flex items-center justify-center h-64 text-brand-cyan">
        <Loader2 className="animate-spin mr-2" size={20} />
        Building all-time record book…
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="bg-gray-900 rounded-2xl p-8 text-center text-gray-500">
        No historical data available.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subtitle */}
      <div className="flex items-center gap-3 text-sm text-gray-500">
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
        <div className="bg-gray-900 rounded-2xl p-8 text-center text-gray-500">
          Not enough data to compute records yet.
        </div>
      )}
    </div>
  );
}
