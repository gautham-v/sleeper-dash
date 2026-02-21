import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Trophy, Zap, TrendingUp, ArrowLeftRight, Star, BarChart2, Loader2 } from 'lucide-react';

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

function LeagueDashboard({ leagueId }: { leagueId: string }) {
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
      {/* League header */}
      <div className="flex items-center gap-3 mb-6">
        {league?.avatar && (
          <img
            src={avatarUrl(league.avatar) ?? ''}
            alt={league.name}
            className="w-12 h-12 rounded-xl object-cover"
          />
        )}
        <div>
          <h2 className="text-xl font-bold text-white">{league?.name ?? 'League'}</h2>
          <p className="text-gray-500 text-sm">
            {league?.season} Season · Week {currentWeek} · {computed.standings.length} Teams
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
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

function LeagueSelector({ userId }: { userId: string }) {
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

  if (selectedLeague) {
    return (
      <div>
        <button
          onClick={() => setSelectedLeague(null)}
          className="text-xs text-gray-500 hover:text-white mb-4 flex items-center gap-1"
        >
          ← All Leagues
        </button>
        <LeagueDashboard leagueId={selectedLeague} />
      </div>
    );
  }

  // Sort: most recent season first
  const sorted = [...leagues.data].sort((a, b) => Number(b.season) - Number(a.season));

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Pick a League</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {sorted.map((league) => (
          <button
            key={league.league_id}
            onClick={() => setSelectedLeague(league.league_id)}
            className="flex items-center gap-3 bg-gray-900 hover:bg-gray-800 p-4 rounded-xl text-left transition-colors border border-gray-800 hover:border-indigo-600"
          >
            {league.avatar ? (
              <img
                src={avatarUrl(league.avatar) ?? ''}
                alt={league.name}
                className="w-10 h-10 rounded-lg object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-indigo-700 flex items-center justify-center text-white font-bold">
                {league.name.slice(0, 2)}
              </div>
            )}
            <div>
              <div className="font-semibold text-white">{league.name}</div>
              <div className="text-xs text-gray-500">
                {league.settings.num_teams} teams · {league.season}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AppContent() {
  const user = useUser();

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
      <div className="flex items-center justify-center h-screen text-red-400">
        Could not find Sleeper user. Check the username in useLeagueData.ts.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center gap-3 mb-8">
          {user.data.avatar && (
            <img
              src={avatarUrl(user.data.avatar) ?? ''}
              alt={user.data.display_name}
              className="w-10 h-10 rounded-full"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">Sleeper Dashboard</h1>
            <p className="text-gray-500 text-sm">{user.data.display_name}</p>
          </div>
        </header>

        <LeagueSelector userId={user.data.user_id} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
