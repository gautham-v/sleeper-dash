import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Trophy, Users, Loader2, ChevronRight, UserCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Item, ItemMedia, ItemContent, ItemTitle, ItemDescription,
  ItemActions, ItemGroup, ItemSeparator,
} from '@/components/ui/item';

import { useUser, useUserLeaguesAllSeasons, useCrossLeagueStats } from './hooks/useLeagueData';
import { CrossLeagueStats } from './components/CrossLeagueStats';
import { LeagueDashboard } from './components/LeagueDashboard';
import { avatarUrl } from './utils/calculations';
import type { SleeperLeague } from './types/sleeper';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

// ─── League Selector ───────────────────────────────────────────────────────────

function LeagueSelector({ user, onChangeUser }: { user: any; onChangeUser: () => void }) {
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const leagues = useUserLeaguesAllSeasons(user.user_id);

  const grouped = leagues.data?.reduce<Record<string, SleeperLeague[]>>((acc, league) => {
    (acc[league.name] ??= []).push(league);
    return acc;
  }, {}) ?? {};

  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) => {
    const maxA = Math.max(...a.map((l) => Number(l.season)));
    const maxB = Math.max(...b.map((l) => Number(l.season)));
    return maxB - maxA;
  });

  const rootLeagueIds = sortedGroups.map(([, group]) => {
    const sorted = [...group].sort((a, b) => Number(b.season) - Number(a.season));
    return sorted[0].league_id;
  });

  const crossStats = useCrossLeagueStats(
    leagues.isLoading ? undefined : user.user_id,
    rootLeagueIds,
  );

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

  if (selectedLeagueId) {
    return (
      <LeagueDashboard
        initialLeagueId={selectedLeagueId}
        allLeagueGroups={sortedGroups}
        userId={user.user_id}
        onBack={() => setSelectedLeagueId(null)}
      />
    );
  }

  const totalLeagues = sortedGroups.length;

  return (
    <div className="min-h-screen bg-base-bg text-white flex flex-col items-center">
      <div className="relative z-10 w-full max-w-lg px-4 py-10 sm:py-14 space-y-5">

        <Card className="border-card-border bg-card-bg">
          <CardContent className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-3">
              {user.avatar ? (
                <img
                  src={avatarUrl(user.avatar) ?? ''}
                  alt={user.display_name}
                  className="w-9 h-9 rounded-full border border-card-border"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center">
                  <UserCircle size={18} className="text-brand-cyan/70" />
                </div>
              )}
              <div>
                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Signed in as</div>
                <div className="text-sm text-white font-semibold leading-tight">{user.display_name}</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onChangeUser}
              className="text-xs text-gray-400 border-card-border hover:text-white hover:border-gray-500 h-8 gap-1.5"
            >
              <UserCircle size={13} />
              Change user
            </Button>
          </CardContent>
        </Card>

        <div className="flex items-baseline gap-3 px-1">
          <h1 className="text-xl font-bold text-white">Your Leagues</h1>
          <span className="text-xs text-gray-500 font-medium">
            {totalLeagues} {totalLeagues === 1 ? 'league' : 'leagues'}
          </span>
        </div>

        {totalLeagues > 0 && (
          <CrossLeagueStats
            stats={crossStats.data}
            isLoading={crossStats.isLoading}
            leagueCount={totalLeagues}
          />
        )}

        {sortedGroups.length > 0 ? (
          <Card className="border-card-border bg-card-bg overflow-hidden">
            <ItemGroup>
              {sortedGroups.map(([name, group], idx) => {
                const seasons = [...group].sort((a, b) => Number(b.season) - Number(a.season));
                const latest = seasons[0];

                return (
                  // eslint-disable-next-line react/jsx-key
                  <React.Fragment key={name}>
                    {idx > 0 && <ItemSeparator className="bg-card-border/60" />}
                    <Item
                      asChild
                      className="rounded-none hover:bg-white/5 transition-colors cursor-pointer text-white"
                    >
                      <button
                        onClick={() => setSelectedLeagueId(latest.league_id)}
                      >
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
        ) : (
          <div className="text-center py-16 text-gray-600">
            <Trophy size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No leagues found for this user.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Username Entry Screen ─────────────────────────────────────────────────────

function UsernameInput({ onSubmit }: { onSubmit: (username: string) => void }) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div className="min-h-screen bg-base-bg flex items-center justify-center px-4 font-sans">
      <Card className="relative z-10 w-full max-w-sm border-card-border gap-0 py-0">
        <CardHeader className="flex flex-col items-center text-center gap-3 pt-8 pb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-cyan/10 flex items-center justify-center border border-brand-cyan/20">
            <span className="text-brand-cyan font-bold text-3xl leading-none" style={{ marginTop: '-2px' }}>∞</span>
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl font-bold tracking-tight text-white">recordbook.fyi</CardTitle>
            <CardDescription>Fantasy football analytics for your Sleeper leagues</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-0 pb-8">
          <form id="username-form" onSubmit={handleSubmit}>
            <Field>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. sleeperuser123"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="focus-visible:ring-brand-cyan/30 focus-visible:border-brand-cyan/50 h-10"
              />
            </Field>
          </form>
        </CardContent>

        <CardFooter className="flex-col gap-3 border-t border-border pt-6 pb-6">
          <Button
            type="submit"
            form="username-form"
            disabled={!value.trim()}
            size="lg"
            className="w-full font-bold"
          >
            View Dashboard
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Reads public league data from the Sleeper API
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

// ─── App Shell ─────────────────────────────────────────────────────────────────

function AppContent({ username, onChangeUser }: { username: string; onChangeUser: () => void }) {
  const user = useUser(username);

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
            Could not find Sleeper user "{username}". Check the username and try again.
          </p>
          <button
            onClick={onChangeUser}
            className="bg-card-bg border border-card-border hover:border-card-border/60 text-white px-5 py-2.5 rounded-xl transition-colors text-sm font-medium"
          >
            Try another username
          </button>
        </div>
      </div>
    );
  }

  return <LeagueSelector user={user.data} onChangeUser={onChangeUser} />;
}

export default function App() {
  const [username, setUsername] = useState<string | null>(null);

  const handleChangeUser = () => {
    queryClient.clear();
    setUsername(null);
  };

  return (
    <QueryClientProvider client={queryClient}>
      {username === null ? (
        <UsernameInput onSubmit={setUsername} />
      ) : (
        <AppContent username={username} onChangeUser={handleChangeUser} />
      )}
    </QueryClientProvider>
  );
}
