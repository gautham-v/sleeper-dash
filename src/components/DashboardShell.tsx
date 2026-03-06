'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import posthog from 'posthog-js';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  BookOpen,
  ChevronLeft,
  UserCircle,
  Layers,
  LogOut,
  Info,
  Mail,
  Scale,
  ClipboardList,
  FlaskConical,
  Lock,
  CreditCard,
  Zap,
  Search,
} from 'lucide-react';
import { AboutModal } from '@/components/AboutModal';
import { ContactModal } from '@/components/ContactModal';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useDashboardData } from '@/hooks/useLeagueData';
import { SidebarNav, type SidebarNavProps } from '@/components/SidebarNav';
import { TABS, type TabId } from '@/lib/tabs';
import { avatarUrl } from '@/utils/calculations';
import { useSessionUser, clearSessionUser } from '@/hooks/useSessionUser';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuthContext } from '@/context/auth';
import { UpgradeModal } from '@/components/UpgradeModal';
import { LookupLeagueModal } from '@/components/LookupLeagueModal';
import { createClient } from '@/lib/supabase-browser';

interface OwnProfile {
  sleeper_user_id: string;
  sleeper_display_name: string | null;
  sleeper_avatar: string | null;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const params = useParams<{ leagueId: string; userId?: string }>();
  const { leagueId } = params;
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const activeTab = useMemo((): TabId => {
    const segments = pathname.split('/');
    const leagueIdIndex = segments.indexOf(leagueId);
    const tabSegment = segments[leagueIdIndex + 1];
    return (TABS.find((t) => t.id === tabSegment)?.id ?? 'overview') as TabId;
  }, [pathname, leagueId]);

  const showingManagerProfile = !!params.userId;
  const sessionUser = useSessionUser();
  const { isPro, cancelAtPeriodEnd, periodEnd } = useSubscription();
  const { user: supabaseUser } = useAuthContext();

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLookupModal, setShowLookupModal] = useState(false);
  const [leagueSheetOpen, setLeagueSheetOpen] = useState(false);
  const [leaguePickerOpen, setLeaguePickerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  // Own Supabase profile — always reflects the authenticated user, regardless of
  // which Sleeper username is currently being viewed in sessionUser.
  const [ownProfile, setOwnProfile] = useState<OwnProfile | null>(null);
  useEffect(() => {
    if (!supabaseUser) { setOwnProfile(null); return; }
    createClient()
      .from('user_profiles')
      .select('sleeper_user_id, sleeper_display_name, sleeper_avatar')
      .eq('id', supabaseUser.id)
      .maybeSingle()
      .then(({ data }) => setOwnProfile(data));
  }, [supabaseUser?.id]);

  // Auto-link Sleeper account when an anonymous session user signs in with Google.
  useEffect(() => {
    if (!supabaseUser || !sessionUser) return;
    const supabase = createClient();
    supabase
      .from('user_profiles')
      .select('sleeper_user_id')
      .eq('id', supabaseUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.sleeper_user_id) {
          // Already linked — refresh own profile state
          setOwnProfile((prev) => prev ?? null);
          return;
        }
        return supabase.from('user_profiles').upsert({
          id: supabaseUser.id,
          sleeper_user_id: sessionUser.userId,
          sleeper_username: sessionUser.username,
          sleeper_display_name: sessionUser.displayName,
          sleeper_avatar: sessionUser.avatar,
        }).then(() => {
          // Refresh own profile after linking
          setOwnProfile({
            sleeper_user_id: sessionUser.userId,
            sleeper_display_name: sessionUser.displayName,
            sleeper_avatar: sessionUser.avatar,
          });
        });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseUser?.id, sessionUser?.userId]);

  // When authenticated: the header always shows the own (Google-linked) profile.
  // sessionUser may point to a different Sleeper user when "Look up another league" was used.
  const isViewingOther = !!supabaseUser && !!ownProfile && !!sessionUser &&
    sessionUser.userId !== ownProfile.sleeper_user_id;

  const headerAvatar = supabaseUser && ownProfile ? ownProfile.sleeper_avatar : (sessionUser?.avatar ?? null);
  const headerDisplayName = supabaseUser && ownProfile
    ? (ownProfile.sleeper_display_name ?? '')
    : (sessionUser?.displayName ?? '');

  const { league, currentWeek, isOffseason } = useDashboardData(leagueId);
  const allLeagueGroups = sessionUser?.leagueGroups ?? [];

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
    posthog.capture('tab_viewed', { tab: id, league_id: leagueId, league_name: league?.name });
    router.push(`/league/${leagueId}/${id}`);
  };

  const handleChangeLeague = (id: string) => {
    if (!isPro) {
      setLeaguePickerOpen(false);
      setLeagueSheetOpen(false);
      setUserMenuOpen(false);
      setTimeout(() => setShowUpgradeModal(true), 150);
      return;
    }
    posthog.capture('league_switched', { from_league_id: leagueId, to_league_id: id });
    router.push(`/league/${id}/overview`);
  };

  const handleManageSubscription = async () => {
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    if (!res.ok) return;
    const { url } = await res.json() as { url: string };
    if (url) window.location.href = url;
  };

  const handleSelectManager = (uid: string) => {
    router.push(`/league/${leagueId}/managers/${uid}`);
  };

  const handleBackFromProfile = () => {
    router.push(`/league/${leagueId}/managers`);
  };

  const handleCareerStats = () => {
    if (userId) {
      router.push(`/league/${leagueId}/managers/${userId}/career-stats`);
    }
  };

  const handleChangeUser = async () => {
    queryClient.clear();
    clearSessionUser();
    if (supabaseUser) {
      await createClient().auth.signOut();
    }
    router.push('/');
  };

  const handleSignInWithGoogle = () => {
    void createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(pathname)}`,
        queryParams: { prompt: 'select_account' },
      },
    });
  };

  const isCareerRoute = pathname.endsWith('/career') || pathname.endsWith('/career-stats');
  const userId = sessionUser?.userId;
  const isMyProfileRoute = showingManagerProfile && !!userId && params.userId === userId && !pathname.endsWith('/career-stats');
  const totalLeagueCount = allLeagueGroups.length;

  const sidebarProps: SidebarNavProps = {
    league,
    leagueId,
    activeTab,
    allLeagueGroups,
    isOffseason,
    currentWeek,
    isPro,
    cancelAtPeriodEnd,
    periodEnd,
    onChangeLeague: handleChangeLeague,
    onLockedLeague: () => {
      setLeaguePickerOpen(false);
      setLeagueSheetOpen(false);
      setUserMenuOpen(false);
      setTimeout(() => setShowUpgradeModal(true), 150);
    },
    onTabChange: handleTabChange,
    onCareerStats: sessionUser ? handleCareerStats : undefined,
    careerStatsActive: isCareerRoute,
    onViewMyProfile: sessionUser && userId
      ? () => { handleSelectManager(userId); }
      : undefined,
    myProfileActive: isMyProfileRoute,
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
          <header className="xl:hidden h-14 border-b border-card-border px-3 flex items-center justify-between gap-2 bg-base-bg/80 backdrop-blur-md sticky top-0 z-10">
            <div className="w-10 flex items-center">
              {showingManagerProfile ? (
                <button
                  onClick={handleBackFromProfile}
                  className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
                  aria-label="Back to managers"
                >
                  <ChevronLeft size={22} />
                </button>
              ) : (
                <button
                  onClick={() => setLeaguePickerOpen(true)}
                  className="w-8 h-8 rounded-lg border border-card-border hover:border-gray-500 transition-colors overflow-hidden flex-shrink-0 flex items-center justify-center bg-card-bg"
                  aria-label="League picker"
                >
                  {league?.avatar ? (
                    <img src={avatarUrl(league.avatar) ?? ''} alt={league.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold text-brand-purple">{league?.name?.slice(0, 2) ?? '??'}</span>
                  )}
                </button>
              )}
            </div>

            <div className="flex-1 text-center">
              <div className="text-sm font-bold text-white leading-tight">
                {showingManagerProfile ? 'Manager Profile' : isCareerRoute ? 'Career Stats' : activeLabel}
              </div>
              {isViewingOther && (
                <div className="text-[10px] text-gray-500 leading-none mt-0.5">
                  Viewing {sessionUser?.displayName}
                </div>
              )}
            </div>

            <div className="w-10 flex items-center justify-end">
              <button
                onClick={() => setUserMenuOpen(true)}
                className="w-8 h-8 rounded-full border border-card-border hover:border-gray-500 transition-colors overflow-hidden flex-shrink-0 flex items-center justify-center bg-card-bg"
                aria-label="User menu"
              >
                {headerAvatar ? (
                  <img src={avatarUrl(headerAvatar) ?? ''} alt={headerDisplayName} className="w-full h-full object-cover" />
                ) : (
                  <UserCircle size={18} className="text-muted-foreground" />
                )}
              </button>
            </div>
          </header>

          {/* Desktop Top Header */}
          <header className="hidden xl:flex h-14 border-b border-card-border px-8 items-center justify-between bg-base-bg/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
                <BookOpen size={16} /> {isOffseason ? 'Offseason' : `Wk ${currentWeek}`}
              </div>
              {isViewingOther && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-card-border/40">
                  <Search size={11} className="text-gray-500" />
                  <span className="text-[11px] text-gray-400">Viewing <span className="text-gray-300 font-medium">{sessionUser?.displayName}</span></span>
                </div>
              )}
            </div>
            {sessionUser ? (
              <div className="relative" ref={avatarMenuRef}>
                <button
                  onClick={() => setAvatarMenuOpen((o) => !o)}
                  className="relative w-10 h-10 rounded-full border border-card-border hover:border-gray-500 flex items-center justify-center bg-card-bg overflow-visible transition-colors"
                  aria-label="User menu"
                >
                  <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
                    {headerAvatar ? (
                      <img
                        src={avatarUrl(headerAvatar) ?? ''}
                        alt={headerDisplayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UserCircle size={20} className="text-muted-foreground" />
                    )}
                  </div>
                  {isPro && (
                    <div className="absolute -bottom-1 -right-1 bg-amber-400 text-amber-900 text-[8px] font-black px-1 rounded-full leading-tight">PRO</div>
                  )}
                </button>
                {avatarMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-card-bg border border-card-border rounded-xl shadow-2xl z-30 overflow-hidden py-1">
                    <div className="px-3 py-2.5 border-b border-card-border/60">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">Signed in as</div>
                      <div className="text-sm font-semibold text-white truncate">{headerDisplayName}</div>
                    </div>
                    {isPro && cancelAtPeriodEnd && periodEnd && (
                      <div className="px-3 py-2 border-b border-card-border/60 flex items-center gap-2">
                        <Zap size={12} className="text-amber-400 flex-shrink-0" />
                        <span className="text-[11px] text-amber-400">
                          Access until {new Date(periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => { setAvatarMenuOpen(false); handleChangeUser(); }}
                      className="w-full text-left px-3 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2.5"
                    >
                      <LogOut size={15} className="text-gray-500 flex-shrink-0" />
                      {supabaseUser ? 'Sign Out' : 'Switch User'}
                    </button>
                    <button
                      onClick={() => { setAvatarMenuOpen(false); setShowLookupModal(true); }}
                      className="w-full text-left px-3 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2.5"
                    >
                      <Search size={15} className="text-gray-500 flex-shrink-0" /> Look up another league
                    </button>
                    {isPro && (
                      <button
                        onClick={() => { setAvatarMenuOpen(false); void handleManageSubscription(); }}
                        className="w-full text-left px-3 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2.5"
                      >
                        <CreditCard size={15} className="text-gray-500 flex-shrink-0" /> Manage subscription
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleSignInWithGoogle}
                className="text-sm font-medium text-brand-cyan border border-brand-cyan/40 hover:border-brand-cyan hover:bg-brand-cyan/10 rounded-lg px-4 py-2 transition-colors"
              >
                Sign in
              </button>
            )}
          </header>

          {/* Dynamic Content */}
          <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-24 xl:pb-8 flex-1 overflow-y-auto">
            <div className="max-w-[1200px] mx-auto">
              {children}
            </div>
          </div>

          {/* Mobile Bottom Tab Bar */}
          <nav className="xl:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-card-border bg-base-bg/95 backdrop-blur-md">
            <div className="flex h-16">
              {TABS.filter(({ id }) => !['h2h', 'records', 'draft', 'trades'].includes(id)).map(({ id, label, icon: Icon }) => (
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
                className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                  ['h2h', 'records', 'draft', 'trades'].includes(activeTab) ? 'text-brand-cyan' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Layers size={20} />
                <span>More</span>
              </button>
            </div>
          </nav>

        </main>
      </div>

      {/* Mobile League Sheet */}
      <Sheet open={leagueSheetOpen} onOpenChange={setLeagueSheetOpen}>
        <SheetContent
          side="bottom"
          className="xl:hidden bg-base-bg text-white border-t border-card-border rounded-t-2xl p-0 overflow-hidden [&>button]:hidden"
        >
          <SheetTitle className="sr-only">More navigation options</SheetTitle>
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-700" />
          </div>

          <div className="px-4 pb-4 space-y-3">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2">
                More Pages
              </div>
              <div className="flex flex-col divide-y divide-card-border/40 border border-card-border rounded-xl overflow-hidden bg-card-bg">
                <button
                  onClick={() => { handleTabChange('trades'); setLeagueSheetOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors w-full ${activeTab === 'trades' ? 'text-brand-cyan bg-brand-cyan/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                >
                  <ArrowLeftRight size={17} className={`flex-shrink-0 ${activeTab === 'trades' ? 'text-brand-cyan' : 'text-gray-500'}`} />
                  <span className="flex-1">Trades</span>
                  <ChevronLeft size={15} className="text-gray-600 flex-shrink-0 rotate-180" />
                </button>
                <button
                  onClick={() => { handleTabChange('draft'); setLeagueSheetOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors w-full ${activeTab === 'draft' ? 'text-brand-cyan bg-brand-cyan/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                >
                  <ClipboardList size={17} className={`flex-shrink-0 ${activeTab === 'draft' ? 'text-brand-cyan' : 'text-gray-500'}`} />
                  <span className="flex-1">Draft</span>
                  <ChevronLeft size={15} className="text-gray-600 flex-shrink-0 rotate-180" />
                </button>
                <button
                  onClick={() => { handleTabChange('h2h'); setLeagueSheetOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors w-full ${activeTab === 'h2h' ? 'text-brand-cyan bg-brand-cyan/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                >
                  <Scale size={17} className={`flex-shrink-0 ${activeTab === 'h2h' ? 'text-brand-cyan' : 'text-gray-500'}`} />
                  <span className="flex-1">Head-to-Head</span>
                  <ChevronLeft size={15} className="text-gray-600 flex-shrink-0 rotate-180" />
                </button>
                <button
                  onClick={() => { handleTabChange('records'); setLeagueSheetOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors w-full ${activeTab === 'records' ? 'text-brand-cyan bg-brand-cyan/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                >
                  <BookOpen size={17} className={`flex-shrink-0 ${activeTab === 'records' ? 'text-brand-cyan' : 'text-gray-500'}`} />
                  <span className="flex-1">Records</span>
                  <ChevronLeft size={15} className="text-gray-600 flex-shrink-0 rotate-180" />
                </button>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-2 flex items-center gap-1 flex-wrap">
              <AboutModal>
                <button className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5">
                  <Info size={12} /> About
                </button>
              </AboutModal>
              <span className="text-gray-700 text-xs">·</span>
              <a href="/how-it-works" className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5" onClick={() => setLeagueSheetOpen(false)}>
                <FlaskConical size={12} /> How It Works
              </a>
              <span className="text-gray-700 text-xs">·</span>
              <ContactModal>
                <button className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5">
                  <Mail size={12} /> Contact
                </button>
              </ContactModal>
              <span className="text-gray-700 text-xs">·</span>
              <a href="/terms" className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5" onClick={() => setLeagueSheetOpen(false)}>
                Terms
              </a>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Upgrade modal */}
      {showUpgradeModal && (
        <UpgradeModal
          leagueCount={totalLeagueCount}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}

      {/* League lookup modal */}
      {showLookupModal && (
        <LookupLeagueModal onClose={() => setShowLookupModal(false)} />
      )}

      {/* Mobile League Picker Sheet */}
      <Sheet open={leaguePickerOpen} onOpenChange={setLeaguePickerOpen}>
        <SheetContent
          side="bottom"
          className="xl:hidden bg-base-bg text-white border-t border-card-border rounded-t-2xl p-0 overflow-hidden [&>button]:hidden"
        >
          <SheetTitle className="sr-only">League selector</SheetTitle>
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-700" />
          </div>
          <div className="px-4 pb-4 space-y-3">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2">Current League</div>
              <div className="flex items-center gap-3 bg-card-bg rounded-xl p-2.5 border border-card-border">
                {league?.avatar ? (
                  <img src={avatarUrl(league.avatar) ?? ''} alt={league.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-brand-purple/20 flex items-center justify-center text-brand-purple font-bold text-base flex-shrink-0 border border-brand-purple/30">
                    {league?.name?.slice(0, 2) ?? '??'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-white text-sm truncate">{league?.name}</div>
                  <div className="text-xs text-gray-500">{league?.season} · {isOffseason ? 'Offseason' : `Wk ${currentWeek}`}</div>
                </div>
              </div>
            </div>

            {allLeagueGroups.filter(([, group]) => !group.some((g) => g.league_id === leagueId)).length > 0 && (
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2">Switch League</div>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {allLeagueGroups
                    .filter(([, group]) => !group.some((g) => g.league_id === leagueId))
                    .map(([name, group]) => {
                      const latest = [...group].sort((a, b) => Number(b.season) - Number(a.season))[0];
                      const locked = !isPro;
                      return (
                        <button
                          key={latest.league_id}
                          onClick={() => { handleChangeLeague(latest.league_id); if (isPro) setLeaguePickerOpen(false); }}
                          className={`flex-shrink-0 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-left transition-colors bg-card-bg border min-w-0 ${locked ? 'border-card-border text-gray-500 opacity-70' : 'border-card-border text-gray-300 hover:border-gray-500 hover:text-white'}`}
                          style={{ maxWidth: '180px' }}
                        >
                          {latest.avatar ? (
                            <img src={avatarUrl(latest.avatar) ?? ''} alt={name} className={`w-6 h-6 rounded-lg object-cover flex-shrink-0 ${locked ? 'opacity-40' : ''}`} />
                          ) : (
                            <div className={`w-6 h-6 rounded-lg bg-brand-purple/20 flex items-center justify-center text-brand-purple text-xs font-bold flex-shrink-0 border border-brand-purple/20 ${locked ? 'opacity-40' : ''}`}>
                              {name.slice(0, 2)}
                            </div>
                          )}
                          <span className="font-medium truncate">{name}</span>
                          {locked && <Lock size={11} className="text-gray-600 flex-shrink-0 ml-auto" />}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile User Menu Sheet */}
      <Sheet open={userMenuOpen} onOpenChange={setUserMenuOpen}>
        <SheetContent
          side="bottom"
          className="xl:hidden bg-base-bg text-white border-t border-card-border rounded-t-2xl p-0 overflow-hidden [&>button]:hidden"
        >
          <SheetTitle className="sr-only">Account menu</SheetTitle>
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-700" />
          </div>
          <div className="px-4 pb-4 space-y-3">
            {sessionUser ? (
              <>
                {/* User info — always shows authenticated user if signed in */}
                <div className="flex items-center gap-3 py-1">
                  {headerAvatar ? (
                    <img src={avatarUrl(headerAvatar) ?? ''} alt={headerDisplayName} className="w-10 h-10 rounded-full border border-card-border flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center flex-shrink-0">
                      <UserCircle size={20} className="text-brand-cyan/70" />
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Signed in as</div>
                    <div className="text-sm font-semibold text-white">{headerDisplayName}</div>
                  </div>
                </div>

                {/* Viewing other user indicator */}
                {isViewingOther && (
                  <div className="flex items-center gap-2 bg-white/5 border border-card-border/40 rounded-xl px-3 py-2">
                    <Search size={12} className="text-gray-500 flex-shrink-0" />
                    <span className="text-xs text-gray-400">Viewing <span className="text-white font-medium">{sessionUser.displayName}</span></span>
                  </div>
                )}

                {/* Pro status */}
                {isPro && (
                  <div className="flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2">
                    <Zap size={13} className="text-amber-400 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-amber-400">Pro — Active</div>
                      <div className="text-[10px] text-gray-500">
                        {cancelAtPeriodEnd && periodEnd
                          ? `Access until ${new Date(periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : 'Multi-league access'}
                      </div>
                    </div>
                  </div>
                )}

                {isPro && (
                  <button
                    onClick={() => { setUserMenuOpen(false); void handleManageSubscription(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-400 hover:text-white bg-card-bg border border-card-border rounded-xl hover:border-gray-500 transition-colors"
                  >
                    <CreditCard size={15} className="text-gray-500 flex-shrink-0" />
                    Manage subscription
                  </button>
                )}

                {userId && (
                  <button
                    onClick={() => { setUserMenuOpen(false); router.push(`/league/${leagueId}/managers/${userId}`); }}
                    className="w-full flex items-center justify-between bg-card-bg rounded-xl p-3 border border-card-border hover:border-gray-500 transition-colors group"
                  >
                    <div className="text-left">
                      <div className="font-medium text-white text-sm">My Profile</div>
                      <div className="text-xs text-gray-500 mt-0.5">Your manager stats and history</div>
                    </div>
                    <ChevronLeft size={16} className="text-gray-500 group-hover:text-gray-300 flex-shrink-0 rotate-180" />
                  </button>
                )}

                <button
                  onClick={() => { setUserMenuOpen(false); handleCareerStats(); }}
                  className="w-full flex items-center justify-between bg-card-bg rounded-xl p-3 border border-card-border hover:border-gray-500 transition-colors group"
                >
                  <div className="text-left">
                    <div className="font-medium text-white text-sm">Career Stats</div>
                    <div className="text-xs text-gray-500 mt-0.5">Your stats across all leagues</div>
                  </div>
                  <ChevronLeft size={16} className="text-gray-500 group-hover:text-gray-300 flex-shrink-0 rotate-180" />
                </button>

                {!supabaseUser && (
                  <div className="bg-card-bg border border-card-border rounded-xl p-3 space-y-2">
                    <div className="text-xs text-gray-400">Sign in to save your leagues and unlock Pro</div>
                    <button
                      onClick={() => { setUserMenuOpen(false); handleSignInWithGoogle(); }}
                      className="w-full text-sm font-medium text-brand-cyan border border-brand-cyan/40 hover:border-brand-cyan hover:bg-brand-cyan/10 rounded-lg px-4 py-2.5 transition-colors"
                    >
                      Continue with Google
                    </button>
                  </div>
                )}

                <button
                  onClick={() => { setUserMenuOpen(false); handleChangeUser(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-400 hover:text-white bg-card-bg border border-card-border rounded-xl hover:border-gray-500 transition-colors"
                >
                  <LogOut size={15} className="text-gray-500 flex-shrink-0" />
                  {supabaseUser ? 'Sign Out' : 'Switch User'}
                </button>

                <button
                  onClick={() => { setUserMenuOpen(false); setShowLookupModal(true); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-400 hover:text-white bg-card-bg border border-card-border rounded-xl hover:border-gray-500 transition-colors"
                >
                  <Search size={15} className="text-gray-500 flex-shrink-0" />
                  Look up another league
                </button>
              </>
            ) : (
              <div className="py-2 space-y-3">
                <div className="text-sm text-gray-400 text-center">Not signed in</div>
                <button
                  onClick={() => { setUserMenuOpen(false); router.push('/'); }}
                  className="w-full text-sm font-medium text-brand-cyan border border-brand-cyan/40 hover:border-brand-cyan hover:bg-brand-cyan/10 rounded-xl px-4 py-3 transition-colors"
                >
                  Sign in
                </button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
