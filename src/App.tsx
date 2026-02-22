import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Trophy, Zap, TrendingUp, ArrowLeftRight, Star, BarChart2,
  Loader2, ChevronRight, Calendar, ChevronLeft, UserCircle,
} from 'lucide-react';

import { useUser, useUserLeaguesAllSeasons, useDashboardData, useYearOverYear } from './hooks/useLeagueData';
import { buildUserMap } from './hooks/useLeagueData';
import { Standings } from './components/Standings';
import { PowerRankings } from './components/PowerRankings';
import { LuckIndex } from './components/LuckIndex';
import { BlowoutsAndClose } from './components/BlowoutsAndClose';
import { TradeHistory } from './components/TradeHistory';
import { DraftGrades } from './components/DraftGrades';
import { YearOverYear } from './components/YearOverYear';
import { avatarUrl } from './utils/calculations';
import type { SleeperLeague } from './types/sleeper';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const TABS = [
  { id: 'standings', label: 'Standings', icon: Trophy },
  { id: 'power', label: 'Power Rankings', icon: TrendingUp },
  { id: 'luck', label: 'Luck Index', icon: Star },
  { id: 'games', label: 'Blowouts & Close', icon: Zap },
  { id: 'trades', label: 'Trades', icon: ArrowLeftRight },
  { id: 'draft', label: 'Draft Grades', icon: BarChart2 },
  { id: 'history', label: 'Year Over Year', icon: BarChart2 },
] as const;

type TabId = (typeof TABS)[number]['id'];

function LeagueDashboard({ leagueId, onBack }: { leagueId: string; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>('standings');
  const { league, currentWeek, isLoading, computed, transactions, draftData, users, rosters } =
    useDashboardData(leagueId);
  const yoy = useYearOverYear(leagueId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading league data…
      </div>
    );
  }

  if (!computed) {
    return (
      <div className="text-center text-gray-500 py-16">Failed to load league data.</div>
    );
  }

  const { rosterMap } = buildUserMap(users, rosters);

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        Back to leagues
      </button>

      {/* League header */}
      <div className="flex items-center gap-4 mb-6 sm:mb-8">
        {league?.avatar ? (
          <img
            src={avatarUrl(league.avatar) ?? ''}
            alt={league.name}
            className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-indigo-700 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {league?.name?.slice(0, 2) ?? '??'}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white truncate">{league?.name ?? 'League'}</h2>
          <p className="text-gray-500 text-sm">
            {league?.season} · Week {currentWeek} · {computed.standings.length} teams
          </p>
        </div>
      </div>

      {/* Tabs — bleed to screen edges on mobile for smooth scroll */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-8 no-scrollbar">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'standings' && <Standings standings={computed.standings} />}

        {activeTab === 'power' && (
          <PowerRankings rankings={computed.powerRankings} standings={computed.standings} />
        )}

        {activeTab === 'luck' && <LuckIndex entries={computed.luckIndex} />}

        {activeTab === 'games' && (
          <BlowoutsAndClose blowouts={computed.blowouts} closest={computed.closest} />
        )}

        {activeTab === 'trades' && computed.rosterMap && (
          <TradeHistory
            transactions={transactions}
            rosterMap={computed.rosterMap}
            playerMap={draftData.playerMap}
            picks={draftData.picks}
          />
        )}

        {activeTab === 'draft' && (
          <DraftGrades
            picks={draftData.picks}
            rosters={rosters}
            rosterMap={rosterMap}
            totalRounds={draftData.draft?.settings.rounds ?? 15}
          />
        )}

        {activeTab === 'history' && (
          <div>
            {yoy.isLoading ? (
              <div className="flex items-center justify-center h-48 text-gray-400">
                <Loader2 className="animate-spin mr-2" size={18} />
                Fetching multi-season data…
              </div>
            ) : (
              <YearOverYear data={yoy.data ?? []} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Season list for a specific league group */
function SeasonPicker({
  leagues,
  onSelect,
  onBack,
}: {
  leagues: SleeperLeague[];
  onSelect: (leagueId: string) => void;
  onBack: () => void;
}) {
  const sorted = [...leagues].sort((a, b) => Number(b.season) - Number(a.season));
  const rep = sorted[0];

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        All leagues
      </button>

      {/* League identity */}
      <div className="flex items-center gap-4 mb-8">
        {rep.avatar ? (
          <img
            src={avatarUrl(rep.avatar) ?? ''}
            alt={rep.name}
            className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-indigo-700 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {rep.name.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white truncate">{rep.name}</h2>
          <p className="text-gray-500 text-sm">{rep.settings.num_teams} teams</p>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-4">Select a season</p>

      <div className="flex flex-col gap-3">
        {sorted.map((league) => (
          <button
            key={league.league_id}
            onClick={() => onSelect(league.league_id)}
            className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 px-4 py-4 rounded-xl text-left transition-colors border border-gray-800 hover:border-indigo-600"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center flex-shrink-0">
                <Calendar size={16} className="text-indigo-400" />
              </div>
              <div>
                <div className="font-semibold text-white">{league.season} Season</div>
                <div className="text-xs text-gray-500">{league.settings.num_teams} teams</div>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-500" />
          </button>
        ))}
      </div>
    </div>
  );
}

type View = 'leagues' | 'seasons' | 'dashboard';

function LeagueSelector({ userId }: { userId: string }) {
  const [view, setView] = useState<View>('leagues');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const leagues = useUserLeaguesAllSeasons(userId);

  if (leagues.isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={18} />
        Fetching your leagues…
      </div>
    );
  }

  // Group leagues by name
  const grouped = leagues.data.reduce<Record<string, SleeperLeague[]>>((acc, league) => {
    (acc[league.name] ??= []).push(league);
    return acc;
  }, {});

  if (view === 'dashboard' && selectedLeague) {
    return (
      <LeagueDashboard
        leagueId={selectedLeague}
        onBack={() => {
          setSelectedLeague(null);
          setView(selectedGroup ? 'seasons' : 'leagues');
        }}
      />
    );
  }

  if (view === 'seasons' && selectedGroup && grouped[selectedGroup]) {
    return (
      <SeasonPicker
        leagues={grouped[selectedGroup]}
        onSelect={(id) => {
          setSelectedLeague(id);
          setView('dashboard');
        }}
        onBack={() => {
          setSelectedGroup(null);
          setView('leagues');
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
    <div>
      <h2 className="text-lg font-semibold text-white mb-5">Your Leagues</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {sortedGroups.map(([name, group]) => {
          const seasons = [...group].sort((a, b) => Number(b.season) - Number(a.season));
          const latest = seasons[0];

          return (
            <button
              key={name}
              onClick={() => {
                if (group.length === 1) {
                  setSelectedLeague(group[0].league_id);
                  setView('dashboard');
                } else {
                  setSelectedGroup(name);
                  setView('seasons');
                }
              }}
              className="flex items-center gap-3 bg-gray-900 hover:bg-gray-800 p-5 rounded-xl text-left transition-colors border border-gray-800 hover:border-indigo-600 w-full"
            >
              {latest.avatar ? (
                <img
                  src={avatarUrl(latest.avatar) ?? ''}
                  alt={name}
                  className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-indigo-700 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {name.slice(0, 2)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white truncate mb-1">{name}</div>
                <div className="text-xs text-gray-500 mb-2">{latest.settings.num_teams} teams</div>
                {/* Season badges */}
                <div className="flex flex-wrap gap-1">
                  {seasons.map((l) => (
                    <span
                      key={l.league_id}
                      className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full border border-gray-700"
                    >
                      {l.season}
                    </span>
                  ))}
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
            </button>
          );
        })}
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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-700 flex items-center justify-center">
            <UserCircle size={36} className="text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Sleeper Dashboard</h1>
        <p className="text-gray-400 text-center mb-8">
          Enter your Sleeper username to view your leagues
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Sleeper username"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors"
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
      <div className="flex items-center justify-center h-screen text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading…
      </div>
    );
  }

  if (user.isError || !user.data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 mb-2">
            Could not find Sleeper user "{username}".
          </p>
          <p className="text-gray-500 text-sm mb-6">Check the username and try again.</p>
          <button
            onClick={onChangeUser}
            className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl transition-colors text-sm font-medium"
          >
            Try another username
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <header className="flex items-center gap-3 mb-8 sm:mb-10 pb-6 border-b border-gray-800/60">
          {user.data.avatar ? (
            <img
              src={avatarUrl(user.data.avatar) ?? ''}
              alt={user.data.display_name}
              className="w-10 h-10 rounded-full flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center flex-shrink-0">
              <UserCircle size={22} className="text-white" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-white leading-tight">Sleeper Dashboard</h1>
            <p className="text-gray-500 text-sm">{user.data.display_name}</p>
          </div>
          <button
            onClick={onChangeUser}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors flex-shrink-0"
          >
            <UserCircle size={15} />
            Change user
          </button>
        </header>

        <LeagueSelector userId={user.data.user_id} />
      </div>
    </div>
  );
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
