'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useDashboardData } from '@/hooks/useLeagueData';
import { useAllTimeWAR } from '@/hooks/useAllTimeWAR';
import { useFranchiseOutlook } from '@/hooks/useFranchiseOutlook';
import { useSessionUser } from '@/hooks/useSessionUser';
import { FranchiseTrajectoryTab } from '@/components/FranchiseTrajectoryTab';
import { FranchiseOutlookTab } from '@/components/FranchiseOutlookTab';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function FranchisePage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const sessionUser = useSessionUser();
  const { computed, isLoading: dashLoading } = useDashboardData(leagueId);
  const trajectoryAnalysis = useAllTimeWAR(leagueId);
  const franchiseOutlook = useFranchiseOutlook(leagueId);

  // Default userId: session user if they're in standings, else first in standings (champion)
  const defaultUserId = useMemo(() => {
    if (!computed) return '';
    const standingIds = computed.standings.map((s) => s.userId);
    if (sessionUser?.userId && standingIds.includes(sessionUser.userId)) {
      return sessionUser.userId;
    }
    return standingIds[0] ?? '';
  }, [computed, sessionUser]);

  const [selectedUserId, setSelectedUserId] = useState('');
  const effectiveUserId = selectedUserId || defaultUserId;

  // Manager list for dropdowns: from standings
  const managers = useMemo(() => {
    if (!computed) return [];
    return computed.standings.map((s) => ({
      userId: s.userId,
      displayName: s.displayName,
    }));
  }, [computed]);

  if (dashLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-brand-cyan" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Franchise Analytics</h2>
        <p className="text-sm text-gray-400 mt-1">All-time trajectory and contender window analysis</p>
      </div>

      <Tabs defaultValue="trajectory">
        <TabsList className="bg-card-bg border border-card-border">
          <TabsTrigger value="trajectory">Franchise Value</TabsTrigger>
          <TabsTrigger value="outlook">Franchise Outlook</TabsTrigger>
        </TabsList>

        {/* TRAJECTORY TAB */}
        <TabsContent value="trajectory" className="mt-4">
          {trajectoryAnalysis.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin text-brand-cyan mr-2" size={24} />
              <span className="text-gray-400 text-sm">Building franchise value…</span>
            </div>
          ) : trajectoryAnalysis.data ? (
            <FranchiseTrajectoryTab
              userId={effectiveUserId}
              analysis={trajectoryAnalysis.data}
            />
          ) : (
            <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
              <div className="text-2xl mb-3">📈</div>
              <div className="text-sm font-medium text-gray-300">Trajectory data unavailable</div>
              <div className="text-xs text-gray-500 mt-1">
                Need at least one completed season with matchup data.
              </div>
            </div>
          )}
        </TabsContent>

        {/* OUTLOOK TAB */}
        <TabsContent value="outlook" className="mt-4 space-y-4">
          {/* Manager selector */}
          {managers.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 flex-shrink-0">Viewing:</span>
              <Select value={effectiveUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="bg-card-bg border-card-border text-white w-56">
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent className="bg-card-bg border-card-border text-white">
                  {managers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {franchiseOutlook.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin text-brand-cyan mr-2" size={24} />
              <span className="text-gray-400 text-sm">Computing franchise outlook…</span>
            </div>
          ) : franchiseOutlook.data ? (
            <FranchiseOutlookTab userId={effectiveUserId} data={franchiseOutlook.data} />
          ) : (
            <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
              <div className="text-2xl mb-3">🔭</div>
              <div className="text-sm font-medium text-gray-300">Franchise outlook unavailable</div>
              <div className="text-xs text-gray-500 mt-1">
                Roster and player age data could not be loaded.
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
