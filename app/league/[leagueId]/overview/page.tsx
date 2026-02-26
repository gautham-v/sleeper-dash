'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDashboardData } from '@/hooks/useLeagueData';
import { useSessionUser } from '@/hooks/useSessionUser';
import { Overview } from '@/components/Overview';
import { LeagueTables } from '@/components/LeagueTables';
import { ShareButton } from '@/components/ShareButton';
import { Loader2, ChevronRight } from 'lucide-react';
import type { TabId } from '@/lib/tabs';

export default function OverviewPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const sessionUser = useSessionUser();
  const { computed, isLoading, league } = useDashboardData(leagueId);
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

      {/* Franchise Analytics */}
      <Link
        href={`/league/${leagueId}/franchise`}
        className="flex items-center gap-4 bg-card-bg border border-card-border rounded-2xl p-4 hover:border-brand-cyan/40 transition-colors group"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center text-lg">
          📈
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white group-hover:text-brand-cyan transition-colors">Franchise Value</div>
          <div className="text-xs text-muted-foreground mt-0.5">Track how each franchise has grown over time and explore contender windows.</div>
        </div>
        <ChevronRight size={16} className="text-muted-foreground group-hover:text-brand-cyan transition-colors flex-shrink-0" />
      </Link>

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
