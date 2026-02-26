'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { useLeagueHistory } from '@/hooks/useLeagueData';
import { calcAllTimeRecords } from '@/utils/calculations';
import { Avatar } from '@/components/Avatar';
import type { AllTimeRecordEntry } from '@/types/sleeper';

const SPOTLIGHT_IDS = ['most-titles', 'longest-win-streak', 'highest-weekly', 'biggest-blowout'];

interface Props {
  leagueId: string;
  onSelectManager?: (userId: string) => void;
}

export function RecordsSpotlight({ leagueId, onSelectManager }: Props) {
  const { data: history, isLoading } = useLeagueHistory(leagueId);

  const records = useMemo<AllTimeRecordEntry[]>(() => {
    if (!history) return [];
    const all = calcAllTimeRecords(history);
    return SPOTLIGHT_IDS
      .map((id) => all.find((r) => r.id === id))
      .filter((r): r is AllTimeRecordEntry => r !== undefined);
  }, [history]);

  if (isLoading || records.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-yellow-400" />
          <h2 className="text-base font-semibold text-white">Record Holders</h2>
        </div>
        <Link
          href={`/league/${leagueId}/records`}
          className="text-xs text-brand-cyan hover:text-brand-cyan/80 transition-colors"
        >
          View All →
        </Link>
      </div>
      <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden divide-y divide-border">
        {records.map((r) => (
          <button
            key={r.id}
            onClick={() => r.holderId && onSelectManager?.(r.holderId)}
            disabled={!r.holderId || !onSelectManager}
            className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/20 transition-colors disabled:cursor-default"
          >
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{r.category}</div>
              <div className="text-sm font-bold text-white tabular-nums">{r.value}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Avatar avatar={r.avatar} name={r.holder} size="sm" />
              <span className="text-sm text-gray-300 font-medium">{r.holder}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
