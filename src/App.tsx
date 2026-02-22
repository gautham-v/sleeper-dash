import { useState, useRef, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Trophy, BookOpen, Scale, Users,
  Loader2, ChevronRight, ChevronDown, ChevronLeft, UserCircle, LayoutDashboard,
} from 'lucide-react';

import { useUser, useUserLeaguesAllSeasons, useDashboardData } from './hooks/useLeagueData';
import { Overview } from './components/Overview';
import { AllTimeRecords } from './components/AllTimeRecords';
import { ManagersList } from './components/ManagersList';
import { ManagerProfile } from './components/ManagerProfile';
import { TeamComparison } from './components/TeamComparison';
import { LuckIndex } from './components/LuckIndex';
import { Standings } from './components/Standings';
import { avatarUrl } from './utils/calculations';
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
  onBack,
}: {
  initialLeagueId: string;
  allSeasons: SleeperLeague[];
  onBack: () => void;
}) {
  const [leagueId, setLeagueId] = useState(initialLeagueId);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { league, currentWeek, isLoading, computed, transactions, draftData } =
    useDashboardData(leagueId);

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
      {/* Ambient glow orbs */}
      <div className="pointer-events-none fixed -top-40 -left-40 h-96 w-96 rounded-full bg-brand-cyan/5 blur-[120px]" />
      <div className="pointer-events-none fixed right-0 top-1/2 h-96 w-96 rounded-full bg-brand-purple/5 blur-[140px]" />

      <div className="relative z-10 flex min-h-screen flex-col xl:flex-row">
        {/* Sidebar Navigation */}
        <aside className="xl:w-72 flex-shrink-0 border-b xl:border-b-0 xl:border-r border-card-border/80 bg-[#0a0d14]/85 xl:h-screen xl:sticky xl:top-0 backdrop-blur-md">
          <div className="p-4 sm:p-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-cyan/20 flex items-center justify-center border border-brand-cyan/30 shadow-[0_0_15px_rgba(0,229,255,0.2)]">
                <span className="text-brand-cyan font-bold text-lg leading-none mt-[-2px]">∞</span>
              </div>
              <span className="font-bold text-xl tracking-tight">Sleeper Dash</span>
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
                  <span className="text-gray-600 text-xs">• Wk {currentWeek}</span>
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
                    ? 'bg-brand-cyan/10 text-brand-cyan relative xl:before:absolute xl:before:left-0 xl:before:top-[10%] xl:before:h-[80%] xl:before:w-1 xl:before:bg-brand-cyan xl:before:rounded-r-full glow-box-cyan'
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
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Sleeper Dash</div>
              <div className="text-sm font-bold text-white truncate">
                {activeTab === 'managers' && selectedManagerId ? 'Manager Profile' : activeTabMeta?.label ?? 'Overview'}
              </div>
            </div>
            <div className="items-center gap-6 hidden sm:flex text-sm font-medium text-gray-400">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-yellow-500" /> League Record Book
              </div>
              <div className="flex items-center gap-2">
                <BookOpen size={16} /> Wk {currentWeek}
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 ml-auto">
              <div className="text-xs text-gray-400 font-medium sm:hidden">Wk {currentWeek}</div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-purple to-brand-cyan p-[2px]">
                <div className="w-full h-full rounded-full bg-base-bg flex items-center justify-center">
                  <UserCircle size={20} className="text-white" />
                </div>
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
                    onNavigate={(tab) => {
                      // Map legacy tab IDs to new ones
                      if (tab === 'compare') handleTabChange('h2h');
                      else if (tab === 'records') handleTabChange('records');
                      else handleTabChange(tab as TabId);
                    }}
                  />

                  {/* Standings widget */}
                  <section>
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <Trophy size={16} className="text-yellow-500" /> Current Standings
                    </h3>
                    <Standings standings={computed.standings} />
                  </section>

                  {/* Luck Index widget */}
                  {computed.luckIndex.length > 0 && (
                    <section>
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        ⭐ Luck Index
                        <span className="text-xs font-normal text-gray-500 ml-1">actual wins vs. expected wins</span>
                      </h3>
                      <LuckIndex entries={computed.luckIndex} />
                    </section>
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

  const grouped = leagues.data?.reduce<Record<string, SleeperLeague[]>>((acc, league) => {
    (acc[league.name] ??= []).push(league);
    return acc;
  }, {}) ?? {};

  if (selectedLeagueId) {
    return (
      <LeagueDashboard
        initialLeagueId={selectedLeagueId}
        allSeasons={selectedGroup}
        onBack={() => {
          setSelectedLeagueId(null);
          setSelectedGroup([]);
        }}
      />
    );
  }

  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) => {
    const maxA = Math.max(...a.map((l) => Number(l.season)));
    const maxB = Math.max(...b.map((l) => Number(l.season)));
    return maxB - maxA;
  });

  const totalLeagues = sortedGroups.length;

  return (
    <div className="min-h-screen bg-base-bg text-white">
      {/* Ambient bg */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 h-64 w-96 bg-brand-cyan/4 blur-[100px] rounded-full" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
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
          <button
            onClick={onChangeUser}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors border border-card-border hover:border-card-border/80 px-3 py-1.5 rounded-lg bg-white/3"
          >
            <UserCircle size={13} />
            Change user
          </button>
        </div>

        {/* Title row */}
        <div className="flex items-baseline gap-3 mb-5">
          <h1 className="text-xl font-bold text-white">Your Leagues</h1>
          <span className="text-xs text-gray-600 font-medium">{totalLeagues} {totalLeagues === 1 ? 'league' : 'leagues'}</span>
        </div>

        {/* League cards */}
        <div className="space-y-2">
          {sortedGroups.map(([name, group]) => {
            const seasons = [...group].sort((a, b) => Number(b.season) - Number(a.season));
            const latest = seasons[0];

            return (
              <button
                key={name}
                onClick={() => {
                  setSelectedGroup(group);
                  setSelectedLeagueId(latest.league_id);
                }}
                className="flex items-center gap-4 w-full text-left bg-card-bg hover:bg-[#161d2e] border border-card-border hover:border-brand-cyan/25 rounded-xl px-4 py-4 transition-all group"
              >
                {/* Avatar */}
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

                {/* Info */}
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
              </button>
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

/** Username entry screen */
function UsernameInput({ onSubmit }: { onSubmit: (username: string) => void }) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div className="min-h-screen bg-base-bg flex items-center justify-center px-4 font-sans relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-brand-cyan/6 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-1/4 left-1/4 h-64 w-64 rounded-full bg-brand-purple/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-7">
          <div className="w-16 h-16 rounded-2xl bg-brand-cyan/10 flex items-center justify-center border border-brand-cyan/20 shadow-[0_0_40px_rgba(0,229,255,0.12)]">
            <span className="text-brand-cyan font-bold text-4xl leading-none" style={{ marginTop: '-3px' }}>∞</span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Sleeper Dash</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Fantasy football analytics for your Sleeper leagues
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter your Sleeper username"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-card-bg border border-card-border rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/20 transition-all text-sm"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="w-full bg-brand-cyan disabled:opacity-30 disabled:cursor-not-allowed text-[#0b0e14] py-3.5 rounded-xl font-bold transition-all text-sm hover:brightness-110 shadow-[0_4px_20px_rgba(0,229,255,0.2)] disabled:shadow-none"
          >
            View Dashboard
          </button>
        </form>

        {/* Subtle hint */}
        <p className="text-center text-xs text-gray-700 mt-6">
          Reads public league data from Sleeper API
        </p>
      </div>
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
