'use client';

import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { DraftLeaderboard } from '@/components/DraftLeaderboard';
import { ShareButton } from '@/components/ShareButton';

export default function DraftPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Draft Analysis</h2>
          <p className="text-gray-400 text-sm">
            League-wide draft performance — steals, busts, and who's actually winning the draft.
          </p>
        </div>
        <ShareButton className="mt-1" />
      </div>
      <DraftLeaderboard
        leagueId={leagueId}
        onSelectManager={(uid) => router.push(`/league/${leagueId}/managers/${uid}`)}
      />
    </div>
  );
}
