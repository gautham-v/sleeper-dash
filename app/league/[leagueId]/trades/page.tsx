'use client';

import { useParams } from 'next/navigation';
import { LeagueTrades } from '@/components/LeagueTrades';

export default function TradesPage() {
  const { leagueId } = useParams<{ leagueId: string }>();

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Trade Analyzer</h2>
      <p className="text-gray-400 text-sm mb-6">
        Analyze every trade in league history and see who came out on top.
      </p>
      <LeagueTrades leagueId={leagueId} />
    </div>
  );
}
