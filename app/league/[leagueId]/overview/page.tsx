'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDashboardData } from '@/hooks/useLeagueData';
import { useSessionUser } from '@/hooks/useSessionUser';
import { Overview } from '@/components/Overview';
import { LeagueTables } from '@/components/LeagueTables';
import { Loader2 } from 'lucide-react';
import type { TabId } from '@/lib/tabs';

export default function OverviewPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const sessionUser = useSessionUser();
  const { computed, isLoading } = useDashboardData(leagueId);

  const handleSelectManager = (uid: string) => {
    router.push(`/league/${leagueId}/managers/${uid}`);
  };

  const handleNavigate = (tab: string) => {
    if (tab === 'compare') router.push(`/league/${leagueId}/h2h`);
    else router.push(`/league/${leagueId}/${tab as TabId}`);
  };

  if (isLoading || !computed) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-brand-cyan" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Overview
        computed={computed}
        leagueId={leagueId}
        userId={sessionUser?.userId ?? ''}
        onNavigate={handleNavigate}
        onViewMyProfile={
          sessionUser?.userId
            ? () => handleSelectManager(sessionUser.userId)
            : undefined
        }
        onSelectManager={handleSelectManager}
      />
      <LeagueTables
        computed={computed}
        leagueId={leagueId}
        onSelectManager={handleSelectManager}
      />
    </div>
  );
}
