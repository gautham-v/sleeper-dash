'use client';

import { useParams, useRouter } from 'next/navigation';
import { ManagersList } from '@/components/ManagersList';

export default function ManagersPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Managers</h2>
      <p className="text-gray-400 text-sm mb-6">
        Click any manager to view their full career stats and trophy case.
      </p>
      <ManagersList
        leagueId={leagueId}
        onSelectManager={(uid) => router.push(`/league/${leagueId}/managers/${uid}`)}
      />
    </div>
  );
}
