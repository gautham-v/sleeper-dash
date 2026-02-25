'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDashboardData } from '@/hooks/useLeagueData';
import { useAllTimeWAR } from '@/hooks/useAllTimeWAR';
import { useSessionUser } from '@/hooks/useSessionUser';
import { Overview } from '@/components/Overview';
import { LeagueTables } from '@/components/LeagueTables';
import { RecordsSpotlight } from '@/components/RecordsSpotlight';
import { FranchiseTrajectoryTab } from '@/components/FranchiseTrajectoryTab';
import { ShareButton } from '@/components/ShareButton';
import { Loader2 } from 'lucide-react';
import type { TabId } from '@/lib/tabs';

export default function OverviewPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const sessionUser = useSessionUser();
  const { computed, isLoading, league } = useDashboardData(leagueId);
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
      <div>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
              {league?.name ?? 'League Overview'}
            </h2>
            <p className="text-gray-400 text-sm">
              Standings, power rankings, and a snapshot of your league this season.
            </p>
          </div>
          <ShareButton className="mt-1" />
        </div>
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
      </div>

      {/* Records Spotlight */}
      <RecordsSpotlight
        leagueId={leagueId}
        onSelectManager={handleSelectManager}
      />

      {/* Franchise Value Preview */}
      {!trajectoryAnalysis.isLoading && trajectoryAnalysis.data?.hasData && trajectoryUserId && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">📈</span>
              <h2 className="text-base font-semibold text-white">Franchise Value</h2>
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
          />
        </div>
      )}

      {/* Standings & Stats */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">📊</span>
          <h2 className="text-base font-semibold text-white">Standings &amp; Stats</h2>
        </div>
        <LeagueTables
          computed={computed}
          leagueId={leagueId}
          onSelectManager={handleSelectManager}
        />
      </div>
    </div>
  );
}
