'use client';

import { useParams } from 'next/navigation';
import { LeagueTrades } from '@/components/LeagueTrades';
import { ShareButton } from '@/components/ShareButton';

export default function TradesPage() {
  const { leagueId } = useParams<{ leagueId: string }>();

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Trade Analyzer</h2>
          <p className="text-gray-400 text-sm">
            Analyze every trade in league history and see who came out on top.
          </p>
        </div>
        <ShareButton className="mt-1" />
      </div>
      <LeagueTrades leagueId={leagueId} />
    </div>
  );
}
