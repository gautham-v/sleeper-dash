'use client';

import { useState } from 'react';
import { Loader2, Trophy, ArrowLeftRight, Target, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCrossLeagueStats } from '@/hooks/useLeagueData';
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
import { useSessionUser } from '@/hooks/useSessionUser';

export default function CareerPage() {
  const sessionUser = useSessionUser();

  // Track which tabs have been activated for lazy loading
  const [activatedTabs, setActivatedTabs] = useState<Set<string>>(new Set(['overview']));

  const sortedGroups = sessionUser?.leagueGroups ?? [];

  // Root league IDs (most recent season per league group)
  const rootLeagues: LeagueRef[] = sortedGroups.map(([name, group]) => {
    const sorted = [...group].sort((a, b) => Number(b.season) - Number(a.season));
    return { leagueId: sorted[0].league_id, leagueName: name };
  });

  const userId = sessionUser?.userId;
  const rootLeagueIds = rootLeagues.map((l) => l.leagueId);

  // Core cross-league stats (loaded eagerly)
  const crossStats = useCrossLeagueStats(userId, rootLeagueIds);

  // Analytics hooks (lazy — only active once respective tab is first opened)
  const tradesEnabled = activatedTabs.has('trades') && !!userId && rootLeagues.length > 0;
  const draftsEnabled = activatedTabs.has('drafts') && !!userId && rootLeagues.length > 0;
  const holdingsEnabled = activatedTabs.has('holdings') && !!userId && rootLeagues.length > 0;

  const tradeStats = useCrossLeagueTradeStats(
    tradesEnabled ? userId : undefined,
    tradesEnabled ? rootLeagues : [],
  );

  const draftStats = useCrossLeagueDraftStats(
    draftsEnabled ? userId : undefined,
    draftsEnabled ? rootLeagues : [],
  );

  const rosterData = useCrossLeagueRosters(
    holdingsEnabled ? userId : undefined,
    holdingsEnabled ? rootLeagues : [],
  );

  const handleTabChange = (tab: string) => {
    setActivatedTabs((prev) => new Set([...prev, tab]));
  };

  // Show loading state if session isn't ready yet
  if (!sessionUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-brand-cyan" size={24} />
      </div>
    );
  }

  const totalLeagues = sortedGroups.length;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-white">Career Stats</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {totalLeagues} {totalLeagues === 1 ? 'league' : 'leagues'} · all time
        </p>
      </div>

      {totalLeagues === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Trophy size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No leagues found for this user.</p>
        </div>
      ) : (
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
              isLoading={crossStats.isLoading}
              leagueCount={totalLeagues}
            />
          </TabsContent>

          {/* ── Trades tab ── */}
          <TabsContent value="trades" className="mt-4">
            <CareerTrades stats={tradeStats} userId={userId ?? ''} />
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
      )}
    </div>
  );
}
