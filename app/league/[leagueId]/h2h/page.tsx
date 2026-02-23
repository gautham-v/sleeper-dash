'use client';

import { useParams } from 'next/navigation';
import { TeamComparison } from '@/components/TeamComparison';

export default function H2HPage() {
  const { leagueId } = useParams<{ leagueId: string }>();

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Head-to-Head</h2>
      <p className="text-gray-400 text-sm mb-6">
        Compare any two managers across all seasons of league history.
      </p>
      <TeamComparison leagueId={leagueId} />
    </div>
  );
}
