import { useState, useRef, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Trophy, Zap, TrendingUp, ArrowLeftRight, Star, BarChart2, BookOpen, Scale,
  Loader2, ChevronRight, ChevronDown, ChevronLeft, UserCircle, LayoutDashboard,
} from 'lucide-react';

import { useUser, useUserLeaguesAllSeasons, useDashboardData, useYearOverYear, useLeagueRecords } from './hooks/useLeagueData';
import { buildUserMap } from './hooks/useLeagueData';
import { Overview } from './components/Overview';
import { Standings } from './components/Standings';
import { PowerRankings } from './components/PowerRankings';
import { LuckIndex } from './components/LuckIndex';
import { BlowoutsAndClose } from './components/BlowoutsAndClose';
import { TradeHistory } from './components/TradeHistory';
import { DraftGrades } from './components/DraftGrades';
import { YearOverYear } from './components/YearOverYear';
import { LeagueRecords } from './components/LeagueRecords';
import { TeamComparison } from './components/TeamComparison';
import { avatarUrl } from './utils/calculations';
import type { SleeperLeague } from './types/sleeper';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'standings', label: 'Standings', icon: Trophy },
  { id: 'power', label: 'Power Rankings', icon: TrendingUp },
  { id: 'luck', label: 'Luck Index', icon: Star },
  { id: 'games', label: 'Blowouts & Close', icon: Zap },
  { id: 'trades', label: 'Trades', icon: ArrowLeftRight },
  { id: 'draft', label: 'Draft Grades', icon: BarChart2 },
  { id: 'history', label: 'Year Over Year', icon: BarChart2 },
  { id: 'records', label: 'Records', icon: BookOpen },
  { id: 'compare', label: 'Compare Teams', icon: Scale },
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { league, currentWeek, isLoading, computed, transactions, draftData, users, rosters } =
    useDashboardData(leagueId);
  const yoy = useYearOverYear(leagueId);
  const records = useLeagueRecords(leagueId);

  const sortedSeasons = [...allSeasons].sort((a, b) => Number(b.season) - Number(a.season));
  const multipleSeasons = sortedSeasons.length > 1;

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
      <div className="flex items-center justify-center min-h-screen text-brand-cyan bg-base-bg">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading league data…
      </div>
    );
  }

  if (!computed) {
    return (
      <div className="flex items-center justify-center min-h-screen text-center text-gray-500 py-16 bg-base-bg">
        Failed to load league data.
      </div>
    );
  }

  const { rosterMap } = buildUserMap(users, rosters);
  const activeTabMeta = TABS.find((tab) => tab.id === activeTab);

  return (
    <div className="relative min-h-screen bg-base-bg text-white font-sans">
      <div className="pointer-events-none absolute -top-28 left-8 h-72 w-72 rounded-full bg-brand-cyan/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-80 w-80 rounded-full bg-brand-purple/10 blur-[140px]" />
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
          <div className="col-span-full px-2 mb-1 mt-1 text-[10px] font-semibold text-gray-500 tracking-wider">
            MAIN
          </div>
          {TABS.slice(0, 6).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
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
          
          <div className="col-span-full px-2 mb-1 mt-3 sm:mt-5 text-[10px] font-semibold text-gray-500 tracking-wider">
            ANALYSIS
          </div>
          {TABS.slice(6).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
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

        {/* Upgrade to Pro Box */}
        <div className="p-4 mt-auto hidden xl:block">
          <div className="bg-gradient-to-br from-brand-cyan/20 to-transparent border border-brand-cyan/20 rounded-2xl p-4 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-brand-cyan/20 rounded-full blur-xl pointer-events-none group-hover:bg-brand-cyan/30 transition-colors"></div>
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <div className="w-6 h-6 rounded-md bg-brand-cyan/20 flex items-center justify-center border border-brand-cyan/30">
                <Zap size={12} className="text-brand-cyan" />
              </div>
              <span className="font-bold text-sm text-white">Upgrade to Pro</span>
            </div>
            <p className="text-[10px] text-gray-400 mb-3 relative z-10">
              Get insights on coverage and eligibility with AI. Simplify decisions.
            </p>
            <div className="flex items-center gap-3 relative z-10">
              <button className="bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-brand-cyan/30 text-brand-cyan px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-[0_0_10px_rgba(0,229,255,0.2)]">
                Upgrade
              </button>
              <button className="text-xs text-gray-400 hover:text-white transition-colors font-medium">
                Learn More
              </button>
            </div>
          </div>
          </div>
        </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 sm:h-20 border-b border-card-border px-4 sm:px-8 flex items-center justify-between bg-base-bg/80 backdrop-blur-md sticky top-0 z-10">
          <div className="sm:hidden min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Dashboard</div>
            <div className="text-sm font-bold text-white truncate">{activeTabMeta?.label ?? 'Overview'}</div>
          </div>
          <div className="flex items-center gap-6 hidden sm:flex text-sm font-medium text-gray-400">
            <button className="hover:text-white flex items-center gap-2 transition-colors">
              <BarChart2 size={16} /> Reports
            </button>
            <div className="flex items-center gap-2">
              <BookOpen size={16} /> Wk {currentWeek}
            </div>
          </div>
          
          <div className="flex-1 max-w-md mx-6 hidden md:block">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input 
                type="text" 
                placeholder="Search for any fantasy metrics..." 
                className="w-full bg-card-bg border border-card-border rounded-full py-2.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/50 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 ml-auto">
            <div className="text-xs text-gray-400 font-medium sm:hidden">Wk {currentWeek}</div>
            <button className="w-10 h-10 rounded-full border border-card-border bg-card-bg flex items-center justify-center text-gray-400 hover:text-white transition-colors">
              <Zap size={18} />
            </button>
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
            {activeTab === 'overview' && (
              <Overview 
                computed={computed} 
                transactions={transactions} 
                draftData={draftData} 
                onNavigate={setActiveTab} 
              />
            )}

            {activeTab === 'standings' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Standings</h2>
                <Standings standings={computed.standings} />
              </div>
            )}

            {activeTab === 'power' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Power Rankings</h2>
                <PowerRankings rankings={computed.powerRankings} standings={computed.standings} />
              </div>
            )}

            {activeTab === 'luck' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Luck Index</h2>
                <LuckIndex entries={computed.luckIndex} />
              </div>
            )}

            {activeTab === 'games' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Blowouts & Close Games</h2>
                <BlowoutsAndClose blowouts={computed.blowouts} closest={computed.closest} />
              </div>
            )}

            {activeTab === 'trades' && computed.rosterMap && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Trade History</h2>
                <TradeHistory
                  transactions={transactions}
                  rosterMap={computed.rosterMap}
                  playerMap={draftData.playerMap}
                />
              </div>
            )}

            {activeTab === 'draft' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Draft Grades</h2>
                <DraftGrades
                  picks={draftData.picks}
                  rosters={rosters}
                  rosterMap={rosterMap}
                  totalRounds={draftData.draft?.settings.rounds ?? 15}
                />
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Year Over Year</h2>
                {yoy.isLoading ? (
                  <div className="flex items-center justify-center h-48 text-brand-cyan">
                    <Loader2 className="animate-spin mr-2" size={18} />
                    Fetching multi-season data…
                  </div>
                ) : (
                  <YearOverYear data={yoy.data ?? []} />
                )}
              </div>
            )}

            {activeTab === 'records' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">League Records</h2>
                {records.isLoading ? (
                  <div className="flex items-center justify-center h-48 text-brand-cyan">
                    <Loader2 className="animate-spin mr-2" size={18} />
                    Building records book…
                  </div>
                ) : (
                  <LeagueRecords data={records.data ?? []} />
                )}
              </div>
            )}

            {activeTab === 'compare' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Compare Teams</h2>
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
      <div className="min-h-screen bg-base-bg flex items-center justify-center text-brand-cyan">
        <Loader2 className="animate-spin mr-2" size={18} />
        Fetching your leagues…
      </div>
    );
  }

  // Group leagues by name
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

  // Sort league groups by most recent season first
  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) => {
    const maxA = Math.max(...a.map((l) => Number(l.season)));
    const maxB = Math.max(...b.map((l) => Number(l.season)));
    return maxB - maxA;
  });

  return (
    <div className="min-h-screen bg-base-bg text-white">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <header className="flex items-center gap-3 mb-8 sm:mb-10 pb-6 border-b border-card-border">
          {user.avatar ? (
            <img
              src={avatarUrl(user.avatar) ?? ''}
              alt={user.display_name}
              className="w-10 h-10 rounded-full flex-shrink-0 border border-brand-cyan/30"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-brand-cyan/20 flex items-center justify-center flex-shrink-0 border border-brand-cyan/30 shadow-[0_0_15px_rgba(0,229,255,0.2)]">
              <UserCircle size={22} className="text-brand-cyan" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">Sleeper Dashboard</h1>
            <p className="text-gray-400 text-sm">{user.display_name}</p>
          </div>
          <button
            onClick={onChangeUser}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors flex-shrink-0"
          >
            <UserCircle size={15} />
            Change user
          </button>
        </header>

        <h2 className="text-lg font-semibold text-white mb-5">Your Leagues</h2>
        <div className="grid gap-4 sm:grid-cols-2">
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
                className="flex items-center gap-3 bg-card-bg hover:bg-[#1a1e2b] p-5 rounded-2xl text-left transition-all border border-card-border hover:border-brand-cyan/50 hover:shadow-[0_0_20px_rgba(0,229,255,0.1)] w-full group"
              >
                {latest.avatar ? (
                  <img
                    src={avatarUrl(latest.avatar) ?? ''}
                    alt={name}
                    className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-white/5"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-brand-purple/20 flex items-center justify-center text-brand-purple font-bold text-lg flex-shrink-0 border border-brand-purple/30">
                    {name.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white truncate mb-1 group-hover:text-brand-cyan transition-colors">{name}</div>
                  <div className="text-xs text-gray-500 mb-2">{latest.settings.num_teams} teams</div>
                  {/* Season badges */}
                  <div className="flex flex-wrap gap-1">
                    {seasons.map((l) => (
                      <span
                        key={l.league_id}
                        className="text-[10px] bg-base-bg text-gray-400 px-2 py-0.5 rounded-md border border-card-border"
                      >
                        {l.season}
                      </span>
                    ))}
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-600 group-hover:text-brand-cyan transition-colors flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Username entry screen shown before a user is loaded */
function UsernameInput({ onSubmit }: { onSubmit: (username: string) => void }) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div className="min-h-screen bg-base-bg flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-brand-cyan/10 flex items-center justify-center border border-brand-cyan/30 shadow-[0_0_30px_rgba(0,229,255,0.2)]">
            <span className="text-brand-cyan font-bold text-5xl leading-none mt-[-4px]">∞</span>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 text-center tracking-tight">Sleeper Dash</h1>
        <p className="text-gray-400 text-center mb-8">
          Enter your Sleeper username to view your leagues
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="relative">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Sleeper username"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-card-bg border border-card-border rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={!value.trim()}
            className="w-full bg-brand-cyan hover:bg-[#00cce6] disabled:opacity-40 disabled:cursor-not-allowed text-[#0b0e14] py-3.5 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(0,229,255,0.4)] hover:shadow-[0_0_25px_rgba(0,229,255,0.6)]"
          >
            View Dashboard
          </button>
        </form>
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
      <div className="flex items-center justify-center h-screen text-brand-cyan bg-base-bg">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading…
      </div>
    );
  }

  if (user.isError || !user.data) {
    return (
      <div className="min-h-screen bg-base-bg flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 mb-2">
            Could not find Sleeper user "{username}".
          </p>
          <p className="text-gray-500 text-sm mb-6">Check the username and try again.</p>
          <button
            onClick={onChangeUser}
            className="bg-card-bg border border-card-border hover:bg-[#1a1e2b] text-white px-5 py-2.5 rounded-xl transition-colors text-sm font-medium"
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
