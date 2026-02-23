import React, { useState, useRef, useEffect, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Trophy, BookOpen, Scale, Users,
  Loader2, ChevronRight, ChevronDown, ChevronLeft, UserCircle, LayoutDashboard,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Item, ItemMedia, ItemContent, ItemTitle, ItemDescription,
  ItemActions, ItemGroup, ItemSeparator,
} from '@/components/ui/item';

import { useUser, useUserLeaguesAllSeasons, useDashboardData, useCrossLeagueStats, useLeagueHistory } from './hooks/useLeagueData';
import { CrossLeagueStats } from './components/CrossLeagueStats';
import { LuckIndex } from './components/LuckIndex';
import { Overview } from './components/Overview';
import { AllTimeRecords } from './components/AllTimeRecords';
import { ManagersList } from './components/ManagersList';
import { ManagerProfile } from './components/ManagerProfile';
import { TeamComparison } from './components/TeamComparison';
import { StandingsSection } from './components/StandingsSection';
import { avatarUrl, calcAllTimeLuckIndex } from './utils/calculations';
import type { SleeperLeague } from './types/sleeper';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const TABS = [
  { id: 'overview',  label: 'Overview',     icon: LayoutDashboard },
  { id: 'records',   label: 'Records',      icon: BookOpen },
  { id: 'managers',  label: 'Managers',     icon: Users },
  { id: 'h2h',       label: 'Head-to-Head', icon: Scale },
] as const;

type TabId = (typeof TABS)[number]['id'];

function LeagueDashboard({
  initialLeagueId,
  allSeasons,
  userId,
  onBack,
}: {
  initialLeagueId: string;
  allSeasons: SleeperLeague[];
  userId: string;
  onBack: () => void;
}) {
  const [leagueId, setLeagueId] = useState(initialLeagueId);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [luckMode, setLuckMode] = useState<'alltime' | 'season'>('alltime');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { league, currentWeek, isOffseason, isLoading, computed } =
    useDashboardData(leagueId);
  const { data: history } = useLeagueHistory(leagueId);

  const allTimeLuck = useMemo(() => {
    if (!history) return [];
    return calcAllTimeLuckIndex(history);
  }, [history]);

  const mostRecentSeason = history?.[history.length - 1]?.season ?? '';
  const activeLuck = luckMode === 'alltime' ? allTimeLuck : (computed?.luckIndex ?? []);
  const showLuck = activeLuck.length > 0;

  const sortedSeasons = [...allSeasons].sort((a, b) => Number(b.season) - Number(a.season));
  const multipleSeasons = sortedSeasons.length > 1;

  // Hash-based deep-linking for manager profiles
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#managers/')) {
      const uid = hash.slice('#managers/'.length);
      if (uid) {
        setActiveTab('managers');
        setSelectedManagerId(uid);
      }
    }
  }, []);

  const handleSelectManager = (userId: string) => {
    setSelectedManagerId(userId);
    window.history.pushState(null, '', `${window.location.pathname}#managers/${userId}`);
  };

  const handleBackFromProfile = () => {
    setSelectedManagerId(null);
    window.history.pushState(null, '', window.location.pathname + window.location.search);
  };

  // When switching tabs away from managers, clear selected manager
  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    if (id !== 'managers') {
      setSelectedManagerId(null);
      window.history.pushState(null, '', window.location.pathname + window.location.search);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setYearDropdownOpen(false);
      }
    }
    if (yearDropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [yearDropdownOpen]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-bg">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-brand-cyan mx-auto" size={28} />
          <p className="text-gray-400 text-sm">Loading league data…</p>
        </div>
      </div>
    );
  }

  if (!computed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-bg text-gray-500">
        Failed to load league data.
      </div>
    );
  }

  const activeTabMeta = TABS.find((tab) => tab.id === activeTab);

  return (
    <div className="relative min-h-screen bg-base-bg text-white font-sans">

      <div className="relative z-10 flex min-h-screen flex-col xl:flex-row">
        {/* Sidebar Navigation */}
        <aside className="xl:w-72 flex-shrink-0 border-b xl:border-b-0 xl:border-r border-card-border/80 bg-base-bg/85 xl:h-screen xl:sticky xl:top-0 backdrop-blur-md">
          <div className="p-4 sm:p-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-cyan/10 flex items-center justify-center border border-brand-cyan/20">
                <span className="text-brand-cyan font-bold text-lg leading-none mt-[-2px]">∞</span>
              </div>
              <span className="font-bold text-xl tracking-tight">recordbook.fyi</span>
            </div>
            <button onClick={onBack} className="text-gray-500 hover:text-white transition-colors" title="Back to Leagues">
              <ChevronLeft size={20} />
            </button>
          </div>

          <div className="px-4 sm:px-5 mb-4 sm:mb-6">
            <div className="flex items-center gap-3 bg-card-bg p-3 rounded-2xl border border-card-border">
              {league?.avatar ? (
                <img
                  src={avatarUrl(league.avatar) ?? ''}
                  alt={league.name}
                  className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-brand-purple/20 flex items-center justify-center text-brand-purple font-bold text-base flex-shrink-0 border border-brand-purple/30">
                  {league?.name?.slice(0, 2) ?? '??'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-white truncate leading-tight">{league?.name ?? 'League'}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {multipleSeasons ? (
                    <div className="relative" ref={dropdownRef}>
                      <button
                        onClick={() => setYearDropdownOpen((o) => !o)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                      >
                        {league?.season ?? '—'} <ChevronDown size={12} />
                      </button>
                      {yearDropdownOpen && (
                        <div className="absolute left-0 top-full mt-1 bg-card-bg border border-card-border rounded-xl shadow-2xl z-30 py-1 overflow-hidden min-w-[100px]">
                          {sortedSeasons.map((s) => (
                            <button
                              key={s.league_id}
                              onClick={() => {
                                setLeagueId(s.league_id);
                                setActiveTab('overview');
                                setSelectedManagerId(null);
                                setYearDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                                s.league_id === leagueId
                                  ? 'bg-brand-cyan/20 text-brand-cyan font-medium'
                                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              {s.season}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">{league?.season}</span>
                  )}
                  <span className="text-gray-600 text-xs">
                    {isOffseason ? '• Offseason' : `• Wk ${currentWeek}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex-1 overflow-y-auto no-scrollbar px-3 sm:px-4 pb-4 sm:pb-6 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-1 gap-1.5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`flex items-center gap-2.5 xl:gap-3 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300 justify-start ${
                  activeTab === id
                    ? 'bg-brand-cyan/10 text-brand-cyan relative xl:before:absolute xl:before:left-0 xl:before:top-[10%] xl:before:h-[80%] xl:before:w-1 xl:before:bg-brand-cyan xl:before:rounded-r-full'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                <Icon size={18} className={activeTab === id ? 'text-brand-cyan' : 'text-gray-500'} />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Top Header */}
          <header className="h-16 sm:h-20 border-b border-card-border px-4 sm:px-8 flex items-center justify-between bg-base-bg/80 backdrop-blur-md sticky top-0 z-10">
            <div className="sm:hidden min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">recordbook.fyi</div>
              <div className="text-sm font-bold text-white truncate">
                {activeTab === 'managers' && selectedManagerId ? 'Manager Profile' : activeTabMeta?.label ?? 'Overview'}
              </div>
            </div>
            <div className="items-center gap-6 hidden sm:flex text-sm font-medium text-gray-400">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-yellow-500" /> League Record Book
              </div>
              <div className="flex items-center gap-2">
                <BookOpen size={16} /> {isOffseason ? 'Offseason' : `Wk ${currentWeek}`}
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 ml-auto">
              <div className="text-xs text-gray-400 font-medium sm:hidden">
                {isOffseason ? 'Offseason' : `Wk ${currentWeek}`}
              </div>
              <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center bg-card-bg">
                <UserCircle size={20} className="text-muted-foreground" />
              </div>
            </div>
          </header>

          {/* Dynamic Content */}
          <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 flex-1 overflow-y-auto">
            <div className="max-w-[1200px] mx-auto">

              {/* OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  <Overview
                    computed={computed}
                    leagueId={leagueId}
                    userId={userId}
                    onNavigate={(tab) => {
                      if (tab === 'compare') handleTabChange('h2h');
                      else if (tab === 'records') handleTabChange('records');
                      else handleTabChange(tab as TabId);
                    }}
                    onViewMyProfile={() => {
                      handleSelectManager(userId);
                      handleTabChange('managers');
                    }}
                    onSelectManager={(uid) => {
                      handleSelectManager(uid);
                      handleTabChange('managers');
                    }}
                  />

                  {/* Standings widget */}
                  <StandingsSection
                    currentStandings={computed.standings}
                    leagueId={leagueId}
                    onSelectManager={(uid) => {
                      handleSelectManager(uid);
                      handleTabChange('managers');
                    }}
                  />

                  {/* Luck Index */}
                  {showLuck && (
                    <div className="bg-card-bg rounded-xl border border-card-border overflow-hidden">
                      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-card-border">
                        <h3 className="font-semibold text-white">Luck Index</h3>
                        <div className="flex gap-1 bg-muted rounded-lg p-1">
                          <button
                            onClick={() => setLuckMode('alltime')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                              luckMode === 'alltime'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            All-Time
                          </button>
                          <button
                            onClick={() => setLuckMode('season')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                              luckMode === 'season'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {mostRecentSeason ? `${mostRecentSeason} Season` : 'This Season'}
                          </button>
                        </div>
                      </div>
                      <LuckIndex
                        entries={activeLuck}
                        onSelectManager={(uid) => {
                          handleSelectManager(uid);
                          handleTabChange('managers');
                        }}
                      />
                    </div>
                  )}

                </div>
              )}

              {/* ALL-TIME RECORDS */}
              {activeTab === 'records' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">All-Time Record Book</h2>
                  <AllTimeRecords leagueId={leagueId} onSelectManager={(uid) => { handleSelectManager(uid); handleTabChange('managers'); }} />
                </div>
              )}

              {/* MANAGERS */}
              {activeTab === 'managers' && (
                <div>
                  {selectedManagerId ? (
                    <ManagerProfile
                      leagueId={leagueId}
                      userId={selectedManagerId}
                      onBack={handleBackFromProfile}
                      onSelectManager={handleSelectManager}
                    />
                  ) : (
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Managers</h2>
                      <p className="text-gray-400 text-sm mb-6">Click any manager to view their full career stats and trophy case.</p>
                      <ManagersList leagueId={leagueId} onSelectManager={handleSelectManager} />
                    </div>
                  )}
                </div>
              )}

              {/* HEAD-TO-HEAD */}
              {activeTab === 'h2h' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Head-to-Head</h2>
                  <p className="text-gray-400 text-sm mb-6">Compare any two managers across all seasons of league history.</p>
                  <TeamComparison leagueId={leagueId} />
                </div>
              )}

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}


function LeagueSelector({ user, onChangeUser }: { user: any; onChangeUser: () => void }) {
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<SleeperLeague[]>([]);
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

  // One root league ID per group (most recent) — used to walk history chains
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
        allSeasons={selectedGroup}
        userId={user.user_id}
        onBack={() => {
          setSelectedLeagueId(null);
          setSelectedGroup([]);
        }}
      />
    );
  }

  const totalLeagues = sortedGroups.length;

  return (
    <div className="min-h-screen bg-base-bg text-white flex flex-col items-center">

      <div className="relative z-10 w-full max-w-lg px-4 py-10 sm:py-14 space-y-5">

        {/* Header card */}
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

        {/* Title row */}
        <div className="flex items-baseline gap-3 px-1">
          <h1 className="text-xl font-bold text-white">Your Leagues</h1>
          <span className="text-xs text-gray-500 font-medium">
            {totalLeagues} {totalLeagues === 1 ? 'league' : 'leagues'}
          </span>
        </div>

        {/* Cross-league career stats */}
        {totalLeagues > 0 && (
          <CrossLeagueStats
            stats={crossStats.data}
            isLoading={crossStats.isLoading}
            leagueCount={totalLeagues}
          />
        )}

        {/* League list */}
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
                        onClick={() => {
                          setSelectedGroup(group);
                          setSelectedLeagueId(latest.league_id);
                        }}
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

/** Username entry screen */
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

function AppContent({
  username,
  onChangeUser,
}: {
  username: string;
  onChangeUser: () => void;
}) {
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
