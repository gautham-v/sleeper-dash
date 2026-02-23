'use client';

import { useParams, useRouter } from 'next/navigation';
import { ManagerProfile } from '@/components/ManagerProfile';

export default function ManagerProfilePage() {
  const { leagueId, userId } = useParams<{ leagueId: string; userId: string }>();
  const router = useRouter();

  return (
    <ManagerProfile
      leagueId={leagueId}
      userId={userId}
      onBack={() => router.push(`/league/${leagueId}/managers`)}
      onSelectManager={(uid) => router.push(`/league/${leagueId}/managers/${uid}`)}
    />
  );
}
