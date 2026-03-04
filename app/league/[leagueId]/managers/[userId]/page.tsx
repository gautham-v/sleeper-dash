'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { ManagerProfile } from '@/components/ManagerProfile';

export default function ManagerProfilePage() {
  const { leagueId, userId } = useParams<{ leagueId: string; userId: string }>();
  const router = useRouter();

  useEffect(() => {
    posthog.capture('manager_profile_viewed', { league_id: leagueId, manager_id: userId });
  }, [leagueId, userId]);

  return (
    <ManagerProfile
      leagueId={leagueId}
      userId={userId}
      onBack={() => router.push(`/league/${leagueId}/managers`)}
      onSelectManager={(uid) => router.push(`/league/${leagueId}/managers/${uid}`)}
      onViewCareerStats={() => router.push(`/league/${leagueId}/managers/${userId}/career-stats`)}
    />
  );
}
