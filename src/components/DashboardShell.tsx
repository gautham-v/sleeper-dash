'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Trophy,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Layers,
  BarChart2,
  LogOut,
  Info,
  Mail,
} from 'lucide-react';
import { AboutModal } from '@/components/AboutModal';
import { ContactModal } from '@/components/ContactModal';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useDashboardData, useCrossLeagueStats } from '@/hooks/useLeagueData';
import { CrossLeagueStats } from '@/components/CrossLeagueStats';
import { SidebarNav, type SidebarNavProps } from '@/components/SidebarNav';
import { TABS, type TabId } from '@/lib/tabs';
import { avatarUrl } from '@/utils/calculations';
import { useSessionUser, clearSessionUser } from '@/hooks/useSessionUser';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const params = useParams<{ leagueId: string; userId?: string }>();
  const { leagueId } = params;
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Derive active tab from the URL segment following leagueId
  const activeTab = useMemo((): TabId => {
    const segments = pathname.split('/');
    const leagueIdIndex = segments.indexOf(leagueId);
    const tabSegment = segments[leagueIdIndex + 1];
    return (TABS.find((t) => t.id === tabSegment)?.id ?? 'overview') as TabId;
  }, [pathname, leagueId]);

  // True when we're on a manager profile sub-route
  const showingManagerProfile = !!params.userId;

  // User context from sessionStorage (set when user logs in via /user/[username])
  const sessionUser = useSessionUser();

  const [showCareerStats, setShowCareerStats] = useState(false);
  const [leagueSheetOpen, setLeagueSheetOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  const { league, currentWeek, isOffseason } = useDashboardData(leagueId);

  const allLeagueGroups = sessionUser?.leagueGroups ?? [];
  const rootLeagueIds = allLeagueGroups.map(
    ([, group]) => [...group].sort((a, b) => Number(b.season) - Number(a.season))[0].league_id,
  );
  const crossStats = useCrossLeagueStats(sessionUser?.userId, rootLeagueIds);

  // Close avatar menu on outside click
  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handle = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [avatarMenuOpen]);

  const handleTabChange = (id: TabId) => {
    setShowCareerStats(false);
    router.push(`/league/${leagueId}/${id}`);
  };

  const handleChangeLeague = (id: string) => {
    router.push(`/league/${id}/overview`);
  };

  const handleSelectManager = (uid: string) => {
    router.push(`/league/${leagueId}/managers/${uid}`);
  };

  const handleBackFromProfile = () => {
    router.push(`/league/${leagueId}/managers`);
  };

  const handleBack = () => {
    if (sessionUser?.username) {
      router.push(`/user/${encodeURIComponent(sessionUser.username)}`);
    } else {
      router.push('/');
    }
  };

  const handleChangeUser = () => {
    queryClient.clear();
    clearSessionUser();
    router.push('/');
  };

  const userId = sessionUser?.userId;
  const userDisplayName = sessionUser?.displayName ?? '';
  const userAvatar = sessionUser?.avatar ?? null;

  const sidebarProps: SidebarNavProps = {
    league,
    leagueId,
    activeTab,
    allLeagueGroups,
    isOffseason,
    currentWeek,
    onChangeLeague: handleChangeLeague,
    onTabChange: handleTabChange,
    onBack: handleBack,
    showCareerStats,
    onShowCareerStats: sessionUser ? () => setShowCareerStats(true) : undefined,
    onViewMyProfile: sessionUser && userId
      ? () => { handleSelectManager(userId); handleTabChange('managers'); }
      : undefined,
    userId,
  };

  const activeLabel = TABS.find((t) => t.id === activeTab)?.label ?? 'Overview';

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
                <span className="text-sm font-bold text-white ml-1">{userDisplayName ? `${userDisplayName} Career Stats` : 'Career Stats'}</span>
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
            {sessionUser && (
              <div className="relative" ref={avatarMenuRef}>
                <button
                  onClick={() => setAvatarMenuOpen((o) => !o)}
                  className="w-10 h-10 rounded-full border border-card-border hover:border-gray-500 flex items-center justify-center bg-card-bg overflow-hidden transition-colors"
                  aria-label="User menu"
                >
                  {userAvatar ? (
                    <img
                      src={avatarUrl(userAvatar) ?? ''}
                      alt={userDisplayName}
                      className="w-full h-full object-cover"
                    />
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
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        setShowCareerStats(false);
                        if (userId) handleSelectManager(userId);
                        handleTabChange('managers');
                      }}
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
                      onClick={() => { setAvatarMenuOpen(false); handleBack(); }}
                      className="w-full text-left px-3 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2.5"
                    >
                      <Layers size={15} className="text-gray-500 flex-shrink-0" /> All Leagues
                    </button>
                    <button
                      onClick={() => { setAvatarMenuOpen(false); handleChangeUser(); }}
                      className="w-full text-left px-3 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2.5"
                    >
                      <LogOut size={15} className="text-gray-500 flex-shrink-0" /> Switch User
                    </button>
                  </div>
                )}
              </div>
            )}
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
                      <h2 className="text-xl font-bold text-white">{userDisplayName ? `${userDisplayName} Career Stats` : 'Career Stats'}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Stats across all leagues</p>
                    </div>
                  </div>
                  <CrossLeagueStats
                    stats={crossStats.data}
                    isLoading={crossStats.isLoading}
                    leagueCount={allLeagueGroups.length}
                    displayName={userDisplayName || undefined}
                  />
                </div>
              ) : (
                children
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
            {/* User section — only if logged in */}
            {sessionUser && (
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
                    onClick={() => {
                      setLeagueSheetOpen(false);
                      setShowCareerStats(false);
                      if (userId) handleSelectManager(userId);
                      handleTabChange('managers');
                    }}
                    className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    My Profile
                  </button>
                  <button
                    onClick={() => { setLeagueSheetOpen(false); handleChangeUser(); }}
                    className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}

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

            {/* Career Stats — only if logged in */}
            {sessionUser && (
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
            )}

            {/* All Leagues */}
            {sessionUser && (
              <button
                onClick={() => { setLeagueSheetOpen(false); handleBack(); }}
                className="w-full flex items-center justify-between rounded-xl px-4 py-2 transition-colors group"
              >
                <span className="text-xs text-gray-500 group-hover:text-gray-300">All Leagues</span>
                <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
              </button>
            )}

            {/* About / Contact */}
            <div className="border-t border-gray-800 pt-3 flex items-center gap-1">
              <AboutModal>
                <button className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5">
                  <Info size={12} />
                  About
                </button>
              </AboutModal>
              <span className="text-gray-700 text-xs">·</span>
              <ContactModal>
                <button className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5">
                  <Mail size={12} />
                  Contact
                </button>
              </ContactModal>
              <span className="text-[10px] text-gray-700 ml-auto">Built in Seattle 🌧️</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
