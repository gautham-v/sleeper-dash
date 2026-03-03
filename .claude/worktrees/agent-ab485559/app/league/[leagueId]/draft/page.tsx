'use client';

import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { DraftLeaderboard } from '@/components/DraftLeaderboard';

export default function DraftPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Draft Analysis</h2>
      <p className="text-gray-400 text-sm mb-6">
        League-wide draft performance — steals, busts, and who's actually winning the draft.
      </p>
      <DraftLeaderboard
        leagueId={leagueId}
        onSelectManager={(uid) => router.push(`/league/${leagueId}/managers/${uid}`)}
      />
    </div>
  );
}
