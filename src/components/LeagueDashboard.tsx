import { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Trophy, ChevronLeft, ChevronRight, UserCircle, Loader2, Layers, BarChart2, LogOut,
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useDashboardData, useCrossLeagueStats } from '@/hooks/useLeagueData';
import { CrossLeagueStats } from '@/components/CrossLeagueStats';
import { Overview } from '@/components/Overview';
import { AllTimeRecords } from '@/components/AllTimeRecords';
import { ManagersList } from '@/components/ManagersList';
import { ManagerProfile } from '@/components/ManagerProfile';
import { TeamComparison } from '@/components/TeamComparison';
import { LeagueTables } from '@/components/LeagueTables';
import { SidebarNav, type SidebarNavProps } from '@/components/SidebarNav';
import { TABS, type TabId } from '@/lib/tabs';
import { avatarUrl } from '@/utils/calculations';
import type { SleeperLeague } from '@/types/sleeper';

export function LeagueDashboard({
  initialLeagueId, allLeagueGroups, userId, userDisplayName, userAvatar, onBack, onChangeUser,
}: {
  initialLeagueId: string;
  allLeagueGroups: [string, SleeperLeague[]][];
  userId: string;
  userDisplayName: string;
  userAvatar: string | null;
  onBack: () => void;
  onChangeUser: () => void;
}) {
  const [leagueId, setLeagueId] = useState(initialLeagueId);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [leagueSheetOpen, setLeagueSheetOpen] = useState(false);
  const [showCareerStats, setShowCareerStats] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  const { league, currentWeek, isOffseason, isLoading, computed } = useDashboardData(leagueId);

  const rootLeagueIds = allLeagueGroups.map(([, group]) =>
    [...group].sort((a, b) => Number(b.season) - Number(a.season))[0].league_id
  );
  const crossStats = useCrossLeagueStats(userId, rootLeagueIds);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#managers/')) {
      const uid = hash.slice('#managers/'.length);
      if (uid) { setActiveTab('managers'); setSelectedManagerId(uid); }
    }
  }, []);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handle = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node))
        setAvatarMenuOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [avatarMenuOpen]);

  const handleSelectManager = (uid: string) => {
    setSelectedManagerId(uid);
    window.history.pushState(null, '', `${window.location.pathname}#managers/${uid}`);
  };

  const handleBackFromProfile = () => {
    setSelectedManagerId(null);
    window.history.pushState(null, '', window.location.pathname + window.location.search);
  };

  const handleTabChange = (id: TabId) => {
    setShowCareerStats(false);
    setActiveTab(id);
    if (id !== 'managers') {
      setSelectedManagerId(null);
      window.history.pushState(null, '', window.location.pathname + window.location.search);
    }
  };

  const handleChangeLeague = (id: string) => {
    setLeagueId(id);
    setActiveTab('overview');
    setSelectedManagerId(null);
  };

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

  const sidebarProps: SidebarNavProps = {
    league, leagueId, activeTab, allLeagueGroups, isOffseason, currentWeek,
    onChangeLeague: handleChangeLeague,
    onTabChange: handleTabChange,
    onBack,
    showCareerStats,
    onShowCareerStats: () => setShowCareerStats(true),
    onViewMyProfile: () => { handleSelectManager(userId); handleTabChange('managers'); },
    userId,
  };

  const activeLabel = TABS.find((t) => t.id === activeTab)?.label ?? 'Overview';
  const showingManagerProfile = activeTab === 'managers' && selectedManagerId;

  return (
    <div className="relative min-h-screen bg-base-bg text-white font-sans">
      <div className="relative z-10 flex min-h-screen flex-col xl:flex-row">

        {/* Desktop Sidebar */}
        <aside className="hidden xl:flex xl:w-72 flex-shrink-0 border-r border-card-border/80 bg-base-bg/85 h-screen sticky top-0 backdrop-blur-md flex-col">
          <SidebarNav {...sidebarProps} />
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0">

          {/* Mobile Top Header */}
          <header className="xl:hidden h-14 border-b border-card-border px-4 flex items-center bg-base-bg/80 backdrop-blur-md sticky top-0 z-10">
            {showCareerStats ? (
              <>
                <button
                  onClick={() => setShowCareerStats(false)}
                  className="text-gray-400 hover:text-white transition-colors p-2 -ml-2"
                  aria-label="Back"
                >
                  <ChevronLeft size={22} />
                </button>
                <span className="text-sm font-bold text-white ml-1">Career Stats</span>
              </>
            ) : showingManagerProfile ? (
              <>
                <button
                  onClick={handleBackFromProfile}
                  className="text-gray-400 hover:text-white transition-colors p-2 -ml-2"
                  aria-label="Back to managers"
                >
                  <ChevronLeft size={22} />
                </button>
                <span className="text-sm font-bold text-white ml-1">Manager Profile</span>
              </>
            ) : (
              <div className="flex-1 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 leading-none mb-0.5">
                  recordbook.fyi
                </div>
                <div className="text-sm font-bold text-white leading-tight">{activeLabel}</div>
              </div>
            )}
          </header>

          {/* Desktop Top Header */}
          <header className="hidden xl:flex h-20 border-b border-card-border px-8 items-center justify-between bg-base-bg/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-6 text-sm font-medium text-gray-400">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-yellow-500" /> League Record Book
              </div>
              <div className="flex items-center gap-2">
                <BookOpen size={16} /> {isOffseason ? 'Offseason' : `Wk ${currentWeek}`}
              </div>
            </div>
            <div className="relative" ref={avatarMenuRef}>
              <button
                onClick={() => setAvatarMenuOpen((o) => !o)}
                className="w-10 h-10 rounded-full border border-card-border hover:border-gray-500 flex items-center justify-center bg-card-bg overflow-hidden transition-colors"
                aria-label="User menu"
              >
                {userAvatar ? (
                  <img src={avatarUrl(userAvatar) ?? ''} alt={userDisplayName} className="w-full h-full object-cover" />
                ) : (
                  <UserCircle size={20} className="text-muted-foreground" />
                )}
              </button>
              {avatarMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-card-bg border border-card-border rounded-xl shadow-2xl z-30 overflow-hidden py-1">
                  <div className="px-3 py-2.5 border-b border-card-border/60">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Signed in as</div>
                    <div className="text-sm font-semibold text-white truncate">{userDisplayName}</div>
                  </div>
                  <button
                    onClick={() => { setAvatarMenuOpen(false); setShowCareerStats(false); handleSelectManager(userId); handleTabChange('managers'); }}
                    className="w-full text-left px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2.5"
                  >
                    <UserCircle size={15} className="text-gray-500 flex-shrink-0" /> My Profile
                  </button>
                  <button
                    onClick={() => { setAvatarMenuOpen(false); setShowCareerStats(true); }}
                    className="w-full text-left px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2.5"
                  >
                    <BarChart2 size={15} className="text-gray-500 flex-shrink-0" /> Career Stats
                  </button>
                  <div className="border-t border-card-border/60 my-1" />
                  <button
                    onClick={() => { setAvatarMenuOpen(false); onBack(); }}
                    className="w-full text-left px-3 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2.5"
                  >
                    <Layers size={15} className="text-gray-500 flex-shrink-0" /> All Leagues
                  </button>
                  <button
                    onClick={() => { setAvatarMenuOpen(false); onChangeUser(); }}
                    className="w-full text-left px-3 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2.5"
                  >
                    <LogOut size={15} className="text-gray-500 flex-shrink-0" /> Switch User
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Dynamic Content */}
          <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-24 xl:pb-8 flex-1 overflow-y-auto">
            <div className="max-w-[1200px] mx-auto">

              {showCareerStats ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowCareerStats(false)}
                      className="hidden xl:flex text-gray-400 hover:text-white transition-colors p-1 -ml-1"
                      aria-label="Back"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div>
                      <h2 className="text-xl font-bold text-white">Career Stats</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Your stats across all leagues</p>
                    </div>
                  </div>
                  <CrossLeagueStats
                    stats={crossStats.data}
                    isLoading={crossStats.isLoading}
                    leagueCount={allLeagueGroups.length}
                  />
                </div>
              ) : null}

              {!showCareerStats && activeTab === 'overview' && (
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
                    onViewMyProfile={() => { handleSelectManager(userId); handleTabChange('managers'); }}
                    onSelectManager={(uid) => { handleSelectManager(uid); handleTabChange('managers'); }}
                  />
                  <LeagueTables
                    computed={computed}
                    leagueId={leagueId}
                    onSelectManager={(uid) => { handleSelectManager(uid); handleTabChange('managers'); }}
                  />
                </div>
              )}

              {!showCareerStats && activeTab === 'records' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Record Book</h2>
                  <AllTimeRecords
                    leagueId={leagueId}
                    onSelectManager={(uid) => { handleSelectManager(uid); handleTabChange('managers'); }}
                  />
                </div>
              )}

              {!showCareerStats && activeTab === 'managers' && (
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
                      <p className="text-gray-400 text-sm mb-6">
                        Click any manager to view their full career stats and trophy case.
                      </p>
                      <ManagersList leagueId={leagueId} onSelectManager={handleSelectManager} />
                    </div>
                  )}
                </div>
              )}

              {!showCareerStats && activeTab === 'h2h' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Head-to-Head</h2>
                  <p className="text-gray-400 text-sm mb-6">
                    Compare any two managers across all seasons of league history.
                  </p>
                  <TeamComparison leagueId={leagueId} />
                </div>
              )}

            </div>
          </div>

          {/* Mobile Bottom Tab Bar */}
          <nav className="xl:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-card-border bg-base-bg/95 backdrop-blur-md">
            <div className="flex h-16">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleTabChange(id)}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                    activeTab === id ? 'text-brand-cyan' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Icon size={20} className={activeTab === id ? 'text-brand-cyan' : 'text-gray-500'} />
                  <span>{label}</span>
                </button>
              ))}
              <button
                onClick={() => setLeagueSheetOpen(true)}
                className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors text-gray-500 hover:text-gray-300"
              >
                <Layers size={20} />
                <span>League</span>
              </button>
            </div>
          </nav>

        </main>
      </div>

      {/* Mobile League Sheet */}
      <Sheet open={leagueSheetOpen} onOpenChange={setLeagueSheetOpen}>
        <SheetContent
          side="bottom"
          className="xl:hidden bg-base-bg text-white border-t border-card-border rounded-t-2xl p-0 max-h-[85vh] overflow-y-auto [&>button]:hidden"
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-700" />
          </div>

          <div className="px-5 pb-8 space-y-5">
            {/* User */}
            <div className="flex items-center justify-between py-3 border-b border-gray-800">
              <div className="flex items-center gap-3">
                {userAvatar ? (
                  <img
                    src={avatarUrl(userAvatar) ?? ''}
                    alt={userDisplayName}
                    className="w-9 h-9 rounded-full border border-card-border"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center">
                    <UserCircle size={18} className="text-brand-cyan/70" />
                  </div>
                )}
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Signed in as</div>
                  <div className="text-sm font-semibold text-white">{userDisplayName}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setLeagueSheetOpen(false); setShowCareerStats(false); handleSelectManager(userId); handleTabChange('managers'); }}
                  className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors"
                >
                  My Profile
                </button>
                <button
                  onClick={() => { setLeagueSheetOpen(false); onChangeUser(); }}
                  className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Current league */}
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2">
                Current League
              </div>
              <div className="flex items-center gap-3 bg-card-bg rounded-xl p-3 border border-card-border">
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
                <div className="min-w-0">
                  <div className="font-semibold text-white text-sm truncate">{league?.name}</div>
                  <div className="text-xs text-gray-500">
                    {league?.season} · {isOffseason ? 'Offseason' : `Wk ${currentWeek}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Switch League */}
            {allLeagueGroups.filter(([, group]) => !group.some((g) => g.league_id === leagueId)).length > 0 && (
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2">
                  Switch League
                </div>
                <div className="space-y-2">
                  {allLeagueGroups
                    .filter(([, group]) => !group.some((g) => g.league_id === leagueId))
                    .map(([name, group]) => {
                      const latest = [...group].sort((a, b) => Number(b.season) - Number(a.season))[0];
                      return (
                        <button
                          key={latest.league_id}
                          onClick={() => { handleChangeLeague(latest.league_id); setLeagueSheetOpen(false); }}
                          className="w-full flex items-center gap-3 rounded-xl p-3 text-sm text-left transition-colors bg-card-bg border border-card-border text-gray-300 hover:border-gray-500 hover:text-white"
                        >
                          {latest.avatar ? (
                            <img
                              src={avatarUrl(latest.avatar) ?? ''}
                              alt={name}
                              className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-brand-purple/20 flex items-center justify-center text-brand-purple text-xs font-bold flex-shrink-0 border border-brand-purple/20">
                              {name.slice(0, 2)}
                            </div>
                          )}
                          <span className="font-medium truncate flex-1">{name}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Career Stats inline */}
            <button
              onClick={() => { setLeagueSheetOpen(false); setShowCareerStats(true); }}
              className="w-full flex items-center justify-between bg-card-bg rounded-xl p-4 border border-card-border hover:border-gray-500 transition-colors group"
            >
              <div className="text-left">
                <div className="font-medium text-white text-sm">Career Stats</div>
                <div className="text-xs text-gray-500 mt-0.5">Your stats across all leagues</div>
              </div>
              <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 flex-shrink-0" />
            </button>

            {/* All Leagues (escape hatch) */}
            <button
              onClick={() => { setLeagueSheetOpen(false); onBack(); }}
              className="w-full flex items-center justify-between rounded-xl px-4 py-2 transition-colors group"
            >
              <span className="text-xs text-gray-500 group-hover:text-gray-300">All Leagues</span>
              <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
