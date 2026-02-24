'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2,
  UserCircle,
  ChevronRight,
  Trophy,
  ArrowLeftRight,
  Target,
  Users,
} from 'lucide-react';
import { AboutModal } from '@/components/AboutModal';
import { ContactModal } from '@/components/ContactModal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemGroup,
  ItemSeparator,
} from '@/components/ui/item';
import { useUser, useUserLeaguesAllSeasons, useCrossLeagueStats } from '@/hooks/useLeagueData';
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
import { avatarUrl } from '@/utils/calculations';
import { saveSessionUser } from '@/hooks/useSessionUser';
import type { SleeperLeague } from '@/types/sleeper';

export default function UserPage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const decodedUsername = decodeURIComponent(username);

  // Track which tabs have been activated for lazy loading
  const [activatedTabs, setActivatedTabs] = useState<Set<string>>(new Set(['overview']));

  const user = useUser(decodedUsername);
  const leagues = useUserLeaguesAllSeasons(user.data?.user_id ?? '');

  const grouped = leagues.data?.reduce<Record<string, SleeperLeague[]>>((acc, league) => {
    (acc[league.name] ??= []).push(league);
    return acc;
  }, {}) ?? {};

  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) => {
    const maxA = Math.max(...a.map((l) => Number(l.season)));
    const maxB = Math.max(...b.map((l) => Number(l.season)));
    return maxB - maxA;
  });

  // Root league IDs (most recent season per league group)
  const rootLeagues: LeagueRef[] = sortedGroups.map(([name, group]) => {
    const sorted = [...group].sort((a, b) => Number(b.season) - Number(a.season));
    return { leagueId: sorted[0].league_id, leagueName: name };
  });

  const rootLeagueIds = rootLeagues.map((l) => l.leagueId);

  // Core cross-league stats (loaded eagerly)
  const crossStats = useCrossLeagueStats(
    leagues.isLoading ? undefined : user.data?.user_id,
    rootLeagueIds,
  );

  // Analytics hooks (lazy — only active once respective tab is first opened)
  const tradesEnabled = activatedTabs.has('trades') && !!user.data?.user_id && rootLeagues.length > 0;
  const draftsEnabled = activatedTabs.has('drafts') && !!user.data?.user_id && rootLeagues.length > 0;
  const holdingsEnabled = activatedTabs.has('holdings') && !!user.data?.user_id && rootLeagues.length > 0;

  const tradeStats = useCrossLeagueTradeStats(
    tradesEnabled ? user.data?.user_id : undefined,
    tradesEnabled ? rootLeagues : [],
  );

  const draftStats = useCrossLeagueDraftStats(
    draftsEnabled ? user.data?.user_id : undefined,
    draftsEnabled ? rootLeagues : [],
  );

  const rosterData = useCrossLeagueRosters(
    holdingsEnabled ? user.data?.user_id : undefined,
    holdingsEnabled ? rootLeagues : [],
  );

  // Save session when user + league data is ready
  useEffect(() => {
    if (user.data && leagues.data && leagues.data.length > 0) {
      saveSessionUser({
        username: decodedUsername,
        userId: user.data.user_id,
        displayName: user.data.display_name,
        avatar: user.data.avatar ?? null,
        leagueGroups: sortedGroups,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.data, leagues.data]);

  const handleSelectLeague = (leagueId: string) => {
    router.push(`/league/${leagueId}/overview`);
  };

  const handleChangeUser = () => {
    router.push('/');
  };

  const handleTabChange = (tab: string) => {
    setActivatedTabs((prev) => new Set([...prev, tab]));
  };

  // ── Loading states ──────────────────────────────────────────

  if (user.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-base-bg">
        <Loader2 className="animate-spin text-brand-cyan" size={24} />
      </div>
    );
  }

  if (user.isError || !user.data) {
    return (
      <div className="min-h-screen bg-base-bg flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <UserCircle size={22} className="text-red-400" />
          </div>
          <p className="text-white font-semibold mb-1">User not found</p>
          <p className="text-gray-500 text-sm mb-6">
            Could not find Sleeper user &quot;{decodedUsername}&quot;. Check the username and try again.
          </p>
          <button
            onClick={handleChangeUser}
            className="bg-card-bg border border-card-border hover:border-card-border/60 text-white px-5 py-2.5 rounded-xl transition-colors text-sm font-medium"
          >
            Try another username
          </button>
        </div>
      </div>
    );
  }

  if (leagues.isLoading) {
    return (
      <div className="min-h-screen bg-base-bg flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-brand-cyan mx-auto" size={24} />
          <p className="text-gray-400 text-sm">Fetching your leagues…</p>
        </div>
      </div>
    );
  }

  const totalLeagues = sortedGroups.length;

  // ── Main render ─────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-base-bg text-white flex flex-col items-center">
      <div className="relative z-10 w-full max-w-2xl px-4 py-8 sm:py-12 space-y-5 pb-20">

        {/* User header */}
        <Card className="border-card-border bg-card-bg">
          <CardContent className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-3">
              {user.data.avatar ? (
                <img
                  src={avatarUrl(user.data.avatar) ?? ''}
                  alt={user.data.display_name}
                  className="w-9 h-9 rounded-full border border-card-border"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center">
                  <UserCircle size={18} className="text-brand-cyan/70" />
                </div>
              )}
              <div>
                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                  Signed in as
                </div>
                <div className="text-sm text-white font-semibold leading-tight">
                  {user.data.display_name}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleChangeUser}
              className="text-xs text-gray-400 border-card-border hover:text-white hover:border-gray-500 h-8 gap-1.5"
            >
              <UserCircle size={13} />
              Change user
            </Button>
          </CardContent>
        </Card>

        {totalLeagues === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <Trophy size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No leagues found for this user.</p>
          </div>
        ) : (
          <Tabs defaultValue="overview" onValueChange={handleTabChange}>
            <TabsList className="w-full bg-card-bg border border-card-border h-10 p-1">
              <TabsTrigger value="overview" className="flex-1 text-xs gap-1.5 data-[state=active]:bg-white/8 data-[state=active]:text-white">
                <Trophy size={12} />
                Overview
              </TabsTrigger>
              <TabsTrigger value="trades" className="flex-1 text-xs gap-1.5 data-[state=active]:bg-white/8 data-[state=active]:text-white">
                <ArrowLeftRight size={12} />
                Trades
              </TabsTrigger>
              <TabsTrigger value="drafts" className="flex-1 text-xs gap-1.5 data-[state=active]:bg-white/8 data-[state=active]:text-white">
                <Target size={12} />
                Drafts
              </TabsTrigger>
              <TabsTrigger value="holdings" className="flex-1 text-xs gap-1.5 data-[state=active]:bg-white/8 data-[state=active]:text-white">
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

              {/* League list */}
              <div className="space-y-2">
                <div className="flex items-baseline gap-3 px-1">
                  <h2 className="text-[13px] font-semibold text-gray-300">Your Leagues</h2>
                  <span className="text-[11px] text-gray-600">
                    {totalLeagues} {totalLeagues === 1 ? 'league' : 'leagues'}
                  </span>
                </div>
                <Card className="border-card-border bg-card-bg overflow-hidden">
                  <ItemGroup>
                    {sortedGroups.map(([name, group], idx) => {
                      const seasons = [...group].sort((a, b) => Number(b.season) - Number(a.season));
                      const latest = seasons[0];

                      return (
                        <React.Fragment key={name}>
                          {idx > 0 && <ItemSeparator className="bg-card-border/60" />}
                          <Item
                            asChild
                            className="rounded-none hover:bg-white/5 transition-colors cursor-pointer text-white"
                          >
                            <button onClick={() => handleSelectLeague(latest.league_id)}>
                              <ItemMedia className="size-11 rounded-lg overflow-hidden shrink-0 self-center">
                                {latest.avatar ? (
                                  <img
                                    src={avatarUrl(latest.avatar) ?? ''}
                                    alt={name}
                                    className="size-full object-cover"
                                  />
                                ) : (
                                  <div className="size-full bg-brand-purple/15 flex items-center justify-center text-brand-purple font-bold text-base border border-brand-purple/20 rounded-lg">
                                    {name.slice(0, 2)}
                                  </div>
                                )}
                              </ItemMedia>

                              <ItemContent>
                                <ItemTitle className="text-white font-semibold group-hover/item:text-brand-cyan transition-colors">
                                  {name}
                                </ItemTitle>
                                <ItemDescription className="flex items-center gap-2 text-gray-500 not-italic">
                                  <span className="flex items-center gap-1">
                                    <Users size={11} />
                                    {latest.settings.num_teams} teams
                                  </span>
                                  <span className="text-gray-700">·</span>
                                  <span className="flex items-center gap-1">
                                    {seasons.map((l) => (
                                      <span
                                        key={l.league_id}
                                        className="text-[11px] bg-white/4 px-1.5 py-0.5 rounded border border-card-border/80 font-medium"
                                      >
                                        {l.season}
                                      </span>
                                    ))}
                                  </span>
                                </ItemDescription>
                              </ItemContent>

                              <ItemActions>
                                <ChevronRight
                                  size={16}
                                  className="text-gray-600 group-hover/item:text-brand-cyan transition-colors"
                                />
                              </ItemActions>
                            </button>
                          </Item>
                        </React.Fragment>
                      );
                    })}
                  </ItemGroup>
                </Card>
              </div>
            </TabsContent>

            {/* ── Trades tab ── */}
            <TabsContent value="trades" className="mt-4">
              <CareerTrades stats={tradeStats} userId={user.data.user_id} />
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

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-center pb-4 pt-2 bg-gradient-to-t from-base-bg via-base-bg/80 to-transparent pointer-events-none">
        <div className="flex items-center gap-1.5 text-xs text-gray-600 pointer-events-auto">
          <AboutModal>
            <button className="hover:text-gray-300 transition-colors px-1.5 py-1 rounded hover:bg-white/5">
              About
            </button>
          </AboutModal>
          <span>·</span>
          <ContactModal>
            <button className="hover:text-gray-300 transition-colors px-1.5 py-1 rounded hover:bg-white/5">
              Contact
            </button>
          </ContactModal>
          <span>·</span>
          <span className="text-gray-700">Made in Seattle 🌧️</span>
        </div>
      </div>
    </div>
  );
}
