'use client';

import { useParams, useRouter } from 'next/navigation';
import { ManagersList } from '@/components/ManagersList';
import { ShareButton } from '@/components/ShareButton';

export default function ManagersPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Managers</h2>
          <p className="text-gray-400 text-sm">
            Click any manager to view their full career stats and trophy case.
          </p>
        </div>
        <ShareButton className="mt-1" />
      </div>
      <ManagersList
        leagueId={leagueId}
        onSelectManager={(uid) => router.push(`/league/${leagueId}/managers/${uid}`)}
      />
    </div>
  );
}
