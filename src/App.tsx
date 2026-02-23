import { useState, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Trophy, BookOpen, Scale, Users,
  ChevronRight, ChevronDown, ChevronLeft, UserCircle, LayoutDashboard,
} from 'lucide-react';

import {
  Sidebar, SidebarContent, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';

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
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [luckMode, setLuckMode] = useState<'alltime' | 'season'>('alltime');

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

  const handleSelectManager = (uid: string) => {
    setSelectedManagerId(uid);
    window.history.pushState(null, '', `${window.location.pathname}#managers/${uid}`);
  };

  const handleBackFromProfile = () => {
    setSelectedManagerId(null);
    window.history.pushState(null, '', window.location.pathname + window.location.search);
  };

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    if (id !== 'managers') {
      setSelectedManagerId(null);
      window.history.pushState(null, '', window.location.pathname + window.location.search);
    }
  };

  const activeTabMeta = TABS.find((tab) => tab.id === activeTab);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-bg">
        <div className="text-center space-y-3">
          <div className="w-7 h-7 rounded-full border-2 border-brand-cyan border-t-transparent animate-spin mx-auto" />
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

  const sidebarNav = (
    <>
      <SidebarHeader className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-cyan/20 flex items-center justify-center border border-brand-cyan/30 shadow-[0_0_15px_rgba(0,229,255,0.2)]">
              <span className="text-brand-cyan font-bold text-lg leading-none mt-[-2px]">∞</span>
            </div>
            <span className="font-bold text-xl tracking-tight">recordbook.fyi</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 text-gray-500 hover:text-white"
            title="Back to Leagues"
          >
            <ChevronLeft size={18} />
          </Button>
        </div>
      </SidebarHeader>

      <Separator className="bg-card-border/60 mx-3 w-auto" />

      <div className="px-3 py-3">
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-xs text-gray-400 hover:text-white hover:bg-transparent gap-1 font-normal"
                    >
                      {league?.season ?? '—'} <ChevronDown size={12} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[100px] bg-card-bg border-card-border">
                    {sortedSeasons.map((s) => (
                      <DropdownMenuItem
                        key={s.league_id}
                        onClick={() => {
                          setLeagueId(s.league_id);
                          setActiveTab('overview');
                          setSelectedManagerId(null);
                        }}
                        className={s.league_id === leagueId ? 'text-brand-cyan font-medium' : ''}
                      >
                        {s.season}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
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

      <SidebarContent className="px-1 pb-6">
        <SidebarMenu>
          {TABS.map(({ id, label, icon: Icon }) => (
            <SidebarMenuItem key={id}>
              <SidebarMenuButton
                isActive={activeTab === id}
                onClick={() => handleTabChange(id)}
                size="lg"
                className={
                  activeTab === id
                    ? 'bg-brand-cyan/10 text-brand-cyan relative before:absolute before:left-0 before:top-[10%] before:h-[80%] before:w-1 before:bg-brand-cyan before:rounded-r-full glow-box-cyan'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }
              >
                <Icon size={18} className={activeTab === id ? 'text-brand-cyan' : 'text-gray-500'} />
                <span>{label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </>
  );

  return (
    <SidebarProvider>
      <div className="relative min-h-screen bg-base-bg text-white font-sans w-full">
        <div className="pointer-events-none fixed -top-40 -left-40 h-96 w-96 rounded-full bg-brand-cyan/5 blur-[120px]" />
        <div className="pointer-events-none fixed right-0 top-1/2 h-96 w-96 rounded-full bg-brand-purple/5 blur-[140px]" />

        <div className="relative z-10 flex min-h-screen">
          <Sidebar collapsible="none" className="border-r border-card-border/80 bg-base-bg/85 backdrop-blur-md hidden xl:flex">
            {sidebarNav}
          </Sidebar>

          <Sidebar collapsible="offcanvas" className="bg-base-bg xl:hidden">
            {sidebarNav}
          </Sidebar>

          <SidebarInset className="bg-base-bg min-w-0">
            <header className="h-16 border-b border-card-border px-4 sm:px-6 flex items-center justify-between bg-base-bg/80 backdrop-blur-md sticky top-0 z-20">
              <div className="flex items-center gap-3 xl:hidden">
                <SidebarTrigger className="text-gray-400 hover:text-white hover:bg-white/5 h-9 w-9" />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">recordbook.fyi</div>
                  <div className="text-sm font-bold text-white truncate">
                    {activeTab === 'managers' && selectedManagerId ? 'Manager Profile' : activeTabMeta?.label ?? 'Overview'}
                  </div>
                </div>
              </div>

              <div className="items-center gap-6 hidden xl:flex text-sm font-medium text-gray-400">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-yellow-500" /> League Record Book
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen size={16} /> {isOffseason ? 'Offseason' : `Wk ${currentWeek}`}
                </div>
              </div>

              <div className="flex items-center gap-3 ml-auto">
                <div className="text-xs text-gray-400 font-medium xl:hidden">
                  {isOffseason ? 'Offseason' : `Wk ${currentWeek}`}
                </div>
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-purple to-brand-cyan p-[2px]">
                  <div className="w-full h-full rounded-full bg-base-bg flex items-center justify-center">
                    <UserCircle size={18} className="text-white" />
                  </div>
                </div>
              </div>
            </header>

            <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 flex-1 overflow-y-auto">
              <div className="max-w-[1200px] mx-auto">

                {activeTab === 'overview' && (
                  <div className="space-y-5">
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

                    <StandingsSection
                      currentStandings={computed.standings}
                      leagueId={leagueId}
                      onSelectManager={(uid) => {
                        handleSelectManager(uid);
                        handleTabChange('managers');
                      }}
                    />

                    {showLuck && (
                      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800/60">
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-white">Luck Index</h3>
                            <span className="text-xs text-gray-500">actual vs. expected wins</span>
                          </div>
                        </div>
                        <ToggleGroup
                          type="single"
                          value={luckMode}
                          onValueChange={(v) => v && setLuckMode(v as 'alltime' | 'season')}
                          className="bg-gray-800/60 rounded-lg p-1 mb-3 justify-start gap-0"
                        >
                          <ToggleGroupItem
                            value="alltime"
                            className="px-3 py-1 rounded-md text-xs font-medium h-auto data-[state=on]:bg-gray-700 data-[state=on]:text-white data-[state=on]:shadow-sm text-gray-500 hover:text-gray-300"
                          >
                            All-Time
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="season"
                            className="px-3 py-1 rounded-md text-xs font-medium h-auto data-[state=on]:bg-gray-700 data-[state=on]:text-white data-[state=on]:shadow-sm text-gray-500 hover:text-gray-300"
                          >
                            {mostRecentSeason ? `${mostRecentSeason} Season` : 'This Season'}
                          </ToggleGroupItem>
                        </ToggleGroup>
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

                {activeTab === 'records' && (
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">All-Time Record Book</h2>
                    <AllTimeRecords leagueId={leagueId} onSelectManager={(uid) => { handleSelectManager(uid); handleTabChange('managers'); }} />
                  </div>
                )}

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

                {activeTab === 'h2h' && (
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Head-to-Head</h2>
                    <p className="text-gray-400 text-sm mb-6">Compare any two managers across all seasons of league history.</p>
                    <TeamComparison leagueId={leagueId} />
                  </div>
                )}

              </div>
            </div>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
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
          <div className="w-6 h-6 rounded-full border-2 border-brand-cyan border-t-transparent animate-spin mx-auto" />
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
    <div className="min-h-screen bg-base-bg text-white">
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 h-64 w-96 bg-brand-cyan/4 blur-[100px] rounded-full" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {user.avatar ? (
              <img
                src={avatarUrl(user.avatar) ?? ''}
                alt={user.display_name}
                className="w-10 h-10 rounded-full border border-card-border"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center">
                <UserCircle size={20} className="text-brand-cyan/70" />
              </div>
            )}
            <div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Signed in as</div>
              <div className="text-white font-semibold leading-tight">{user.display_name}</div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onChangeUser}
            className="text-xs text-gray-500 hover:text-gray-300 border-card-border hover:border-card-border/80 bg-transparent gap-1.5"
          >
            <UserCircle size={13} />
            Change user
          </Button>
        </div>

        <div className="flex items-baseline gap-3 mb-5">
          <h1 className="text-xl font-bold text-white">Your Leagues</h1>
          <span className="text-xs text-gray-600 font-medium">{totalLeagues} {totalLeagues === 1 ? 'league' : 'leagues'}</span>
        </div>

        {totalLeagues > 0 && (
          <CrossLeagueStats
            stats={crossStats.data}
            isLoading={crossStats.isLoading}
            leagueCount={totalLeagues}
          />
        )}

        <div className="space-y-2">
          {sortedGroups.map(([name, group]) => {
            const seasons = [...group].sort((a, b) => Number(b.season) - Number(a.season));
            const latest = seasons[0];

            return (
              <Button
                key={name}
                variant="ghost"
                onClick={() => {
                  setSelectedGroup(group);
                  setSelectedLeagueId(latest.league_id);
                }}
                className="flex items-center gap-4 w-full text-left h-auto bg-card-bg hover:bg-surface-hover border border-card-border hover:border-brand-cyan/25 rounded-xl px-4 py-4 group justify-start"
              >
                {latest.avatar ? (
                  <img
                    src={avatarUrl(latest.avatar) ?? ''}
                    alt={name}
                    className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-brand-purple/15 flex items-center justify-center text-brand-purple font-bold text-base flex-shrink-0 border border-brand-purple/20">
                    {name.slice(0, 2)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white group-hover:text-brand-cyan transition-colors truncate leading-snug">
                    {name}
                  </div>
                  <div className="flex items-center gap-2.5 mt-1">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Users size={11} />
                      {latest.settings.num_teams} teams
                    </span>
                    <span className="text-gray-700">·</span>
                    <div className="flex items-center gap-1">
                      {seasons.map((l) => (
                        <span
                          key={l.league_id}
                          className="text-[11px] text-gray-500 bg-white/4 px-1.5 py-0.5 rounded border border-card-border/80 font-medium"
                        >
                          {l.season}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-600 group-hover:text-brand-cyan transition-colors flex-shrink-0" />
              </Button>
            );
          })}
        </div>

        {sortedGroups.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <Trophy size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No leagues found for this user.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function UsernameInput({ onSubmit }: { onSubmit: (username: string) => void }) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div className="min-h-screen bg-base-bg flex items-center justify-center px-4 font-sans relative overflow-hidden">
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-brand-cyan/6 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-1/4 left-1/4 h-64 w-64 rounded-full bg-brand-purple/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="flex justify-center mb-7">
          <div className="w-16 h-16 rounded-2xl bg-brand-cyan/10 flex items-center justify-center border border-brand-cyan/20 shadow-[0_0_40px_rgba(0,229,255,0.12)]">
            <span className="text-brand-cyan font-bold text-4xl leading-none" style={{ marginTop: '-3px' }}>∞</span>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">recordbook.fyi</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Fantasy football analytics for your Sleeper leagues
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter your Sleeper username"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-12 bg-card-bg border-card-border rounded-xl text-white placeholder:text-gray-600 focus-visible:ring-brand-cyan/30 focus-visible:border-brand-cyan/50 text-sm"
          />
          <Button
            type="submit"
            disabled={!value.trim()}
            className="w-full h-12 bg-brand-cyan disabled:opacity-30 text-[#0b0e14] rounded-xl font-bold hover:brightness-110 shadow-[0_4px_20px_rgba(0,229,255,0.2)] disabled:shadow-none"
          >
            View Dashboard
          </Button>
        </form>

        <p className="text-center text-xs text-gray-700 mt-6">
          Reads public league data from Sleeper API
        </p>
      </div>
    </div>
  );
}

function AppContent({ username, onChangeUser }: { username: string; onChangeUser: () => void }) {
  const user = useUser(username);

  if (user.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-base-bg">
        <div className="w-6 h-6 rounded-full border-2 border-brand-cyan border-t-transparent animate-spin" />
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
          <Button
            variant="outline"
            onClick={onChangeUser}
            className="border-card-border hover:border-card-border/60 text-white"
          >
            Try another username
          </Button>
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
