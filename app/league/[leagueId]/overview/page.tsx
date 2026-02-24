'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDashboardData } from '@/hooks/useLeagueData';
import { useAllTimeWAR } from '@/hooks/useAllTimeWAR';
import { useSessionUser } from '@/hooks/useSessionUser';
import { Overview } from '@/components/Overview';
import { LeagueTables } from '@/components/LeagueTables';
import { RecordsSpotlight } from '@/components/RecordsSpotlight';
import { LuckTeaser } from '@/components/LuckTeaser';
import { FranchiseTrajectoryTab } from '@/components/FranchiseTrajectoryTab';
import { Loader2 } from 'lucide-react';
import type { TabId } from '@/lib/tabs';

export default function OverviewPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const sessionUser = useSessionUser();
  const { computed, isLoading } = useDashboardData(leagueId);
  const trajectoryAnalysis = useAllTimeWAR(leagueId);

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

  // Default userId for trajectory preview
  const trajectoryUserId = sessionUser?.userId || computed.standings[0]?.userId || '';

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

      {/* Records Spotlight */}
      <RecordsSpotlight
        leagueId={leagueId}
        onSelectManager={handleSelectManager}
      />

      {/* Luck Index Teaser */}
      {computed.luckIndex.length >= 4 && (
        <LuckTeaser
          luckIndex={computed.luckIndex}
          onSelectManager={handleSelectManager}
        />
      )}

      {/* Franchise Trajectory Preview */}
      {!trajectoryAnalysis.isLoading && trajectoryAnalysis.data?.hasData && trajectoryUserId && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">📈</span>
              <h2 className="text-base font-semibold text-white">Franchise Trajectory</h2>
            </div>
            <Link
              href={`/league/${leagueId}/franchise`}
              className="text-xs text-brand-cyan hover:text-brand-cyan/80 transition-colors"
            >
              See full interactive chart →
            </Link>
          </div>
          <FranchiseTrajectoryTab
            userId={trajectoryUserId}
            analysis={trajectoryAnalysis.data}
            previewMode
          />
        </div>
      )}

      <LeagueTables
        computed={computed}
        leagueId={leagueId}
        onSelectManager={handleSelectManager}
      />
    </div>
  );
}
