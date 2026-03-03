'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, Trophy, ArrowLeftRight, Target, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserById, useUserLeaguesAllSeasons, useCrossLeagueStats } from '@/hooks/useLeagueData';
import {
  useCrossLeagueTradeStats,
  useCrossLeagueDraftStats,
  useCrossLeagueRosters,
  type LeagueRef,
} from '@/hooks/useCrossLeagueAnalytics';
import { CareerOverview } from '@/components/CareerOverview';
import { CareerTrades } from '@/components/CareerTrades';
import { CareerDrafts } from '@/components/CareerDrafts';
import { CareerHoldings } from '@/components/CareerHoldings';
import type { SleeperLeague } from '@/types/sleeper';

export default function ManagerCareerStatsPage() {
  const { leagueId, userId } = useParams<{ leagueId: string; userId: string }>();
  const router = useRouter();

  // Track which tabs have been activated for lazy loading
  const [activatedTabs, setActivatedTabs] = useState<Set<string>>(new Set(['overview']));

  const { data: managerUser, isLoading: userLoading } = useUserById(userId);
  const leagues = useUserLeaguesAllSeasons(managerUser?.user_id);

  const grouped = leagues.data?.reduce<Record<string, SleeperLeague[]>>((acc, league) => {
    (acc[league.name] ??= []).push(league);
    return acc;
  }, {}) ?? {};

  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) => {
    const maxA = Math.max(...a.map((l) => Number(l.season)));
    const maxB = Math.max(...b.map((l) => Number(l.season)));
    return maxB - maxA;
  });

  const rootLeagues: LeagueRef[] = useMemo(
    () => sortedGroups.map(([name, group]) => {
      const sorted = [...group].sort((a, b) => Number(b.season) - Number(a.season));
      return { leagueId: sorted[0].league_id, leagueName: name };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leagues.data],
  );

  const rootLeagueIds = rootLeagues.map((l) => l.leagueId);
  const managerUserId = leagues.isLoading ? undefined : managerUser?.user_id;

  // Core cross-league stats (loaded eagerly)
  const crossStats = useCrossLeagueStats(managerUserId, rootLeagueIds);

  // Analytics hooks (lazy — only active once respective tab is first opened)
  const tradesEnabled = activatedTabs.has('trades') && !!managerUserId && rootLeagues.length > 0;
  const draftsEnabled = activatedTabs.has('drafts') && !!managerUserId && rootLeagues.length > 0;
  const holdingsEnabled = activatedTabs.has('holdings') && !!managerUserId && rootLeagues.length > 0;

  const tradeStats = useCrossLeagueTradeStats(
    tradesEnabled ? managerUserId : undefined,
    tradesEnabled ? rootLeagues : [],
  );

  const draftStats = useCrossLeagueDraftStats(
    draftsEnabled ? managerUserId : undefined,
    draftsEnabled ? rootLeagues : [],
  );

  const rosterData = useCrossLeagueRosters(
    holdingsEnabled ? managerUserId : undefined,
    holdingsEnabled ? rootLeagues : [],
  );

  const handleTabChange = (tab: string) => {
    setActivatedTabs((prev) => new Set([...prev, tab]));
  };

  const displayName = managerUser?.display_name ?? managerUser?.username ?? '';
  const totalLeagues = sortedGroups.length;

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-brand-cyan">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => router.push(`/league/${leagueId}/managers/${userId}`)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ChevronLeft size={16} />
        Back to {displayName || 'Manager'}
      </button>

      <div>
        <h1 className="text-xl font-bold text-white">
          {displayName ? `${displayName} Career Stats` : 'Career Stats'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {totalLeagues > 0
            ? `${totalLeagues} ${totalLeagues === 1 ? 'league' : 'leagues'} · all time`
            : 'Stats across all leagues'}
        </p>
      </div>

      <Tabs defaultValue="overview" onValueChange={handleTabChange}>
        <TabsList className="w-full bg-card-bg border border-card-border h-10 p-1">
          <TabsTrigger
            value="overview"
            className="flex-1 text-xs gap-1.5 data-[state=active]:bg-white/8 data-[state=active]:text-white"
          >
            <Trophy size={12} />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="trades"
            className="flex-1 text-xs gap-1.5 data-[state=active]:bg-white/8 data-[state=active]:text-white"
          >
            <ArrowLeftRight size={12} />
            Trades
          </TabsTrigger>
          <TabsTrigger
            value="drafts"
            className="flex-1 text-xs gap-1.5 data-[state=active]:bg-white/8 data-[state=active]:text-white"
          >
            <Target size={12} />
            Drafts
          </TabsTrigger>
          <TabsTrigger
            value="holdings"
            className="flex-1 text-xs gap-1.5 data-[state=active]:bg-white/8 data-[state=active]:text-white"
          >
            <Users size={12} />
            Holdings
          </TabsTrigger>
        </TabsList>

        {/* ── Overview tab ── */}
        <TabsContent value="overview" className="mt-4 space-y-5">
          <CareerOverview
            stats={crossStats.data}
            isLoading={crossStats.isLoading || leagues.isLoading}
            leagueCount={totalLeagues}
          />
        </TabsContent>

        {/* ── Trades tab ── */}
        <TabsContent value="trades" className="mt-4">
          <CareerTrades stats={tradeStats} userId={managerUserId ?? ''} />
        </TabsContent>

        {/* ── Drafts tab ── */}
        <TabsContent value="drafts" className="mt-4">
          <CareerDrafts stats={draftStats} />
        </TabsContent>

        {/* ── Holdings tab ── */}
        <TabsContent value="holdings" className="mt-4">
          <CareerHoldings data={rosterData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
