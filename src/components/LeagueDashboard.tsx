import { useState, useEffect } from 'react';
import { BookOpen, Trophy, Menu, ChevronLeft, UserCircle, Loader2 } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useDashboardData } from '@/hooks/useLeagueData';
import { Overview } from '@/components/Overview';
import { AllTimeRecords } from '@/components/AllTimeRecords';
import { ManagersList } from '@/components/ManagersList';
import { ManagerProfile } from '@/components/ManagerProfile';
import { TeamComparison } from '@/components/TeamComparison';
import { LeagueTables } from '@/components/LeagueTables';
import { SidebarNav, type SidebarNavProps } from '@/components/SidebarNav';
import { TABS, type TabId } from '@/lib/tabs';
import type { SleeperLeague } from '@/types/sleeper';

export function LeagueDashboard({
  initialLeagueId, allLeagueGroups, userId, onBack,
}: {
  initialLeagueId: string;
  allLeagueGroups: [string, SleeperLeague[]][];
  userId: string;
  onBack: () => void;
}) {
  const [leagueId, setLeagueId] = useState(initialLeagueId);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { league, currentWeek, isOffseason, isLoading, computed } = useDashboardData(leagueId);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#managers/')) {
      const uid = hash.slice('#managers/'.length);
      if (uid) { setActiveTab('managers'); setSelectedManagerId(uid); }
    }
  }, []);

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
    setMobileMenuOpen(false);
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
  };

  const activeLabel = TABS.find((t) => t.id === activeTab)?.label ?? 'Overview';

  return (
    <div className="relative min-h-screen bg-base-bg text-white font-sans">
      <div className="relative z-10 flex min-h-screen flex-col xl:flex-row">

        {/* Desktop Sidebar */}
        <aside className="hidden xl:flex xl:w-72 flex-shrink-0 border-r border-card-border/80 bg-base-bg/85 h-screen sticky top-0 backdrop-blur-md flex-col">
          <SidebarNav {...sidebarProps} />
        </aside>

        {/* Mobile Sidebar Drawer */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent
            side="left"
            className="p-0 bg-base-bg text-white border-r border-card-border w-72 max-w-[85vw] [&>button]:hidden"
          >
            <SidebarNav {...sidebarProps} onClose={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0">

          {/* Mobile Top Header */}
          <header className="xl:hidden h-14 border-b border-card-border px-4 flex items-center justify-between bg-base-bg/80 backdrop-blur-md sticky top-0 z-10">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="text-gray-400 hover:text-white transition-colors p-2 -ml-2"
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>
            <div className="text-center min-w-0 mx-3 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 leading-none mb-0.5">
                recordbook.fyi
              </div>
              <div className="text-sm font-bold text-white truncate leading-tight">
                {activeTab === 'managers' && selectedManagerId ? 'Manager Profile' : activeLabel}
              </div>
            </div>
            <button
              onClick={onBack}
              className="text-gray-500 hover:text-white transition-colors p-2 -mr-2"
              aria-label="Back to leagues"
            >
              <ChevronLeft size={22} />
            </button>
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
            <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center bg-card-bg">
              <UserCircle size={20} className="text-muted-foreground" />
            </div>
          </header>

          {/* Dynamic Content */}
          <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-24 xl:pb-8 flex-1 overflow-y-auto">
            <div className="max-w-[1200px] mx-auto">

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

              {activeTab === 'records' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Record Book</h2>
                  <AllTimeRecords
                    leagueId={leagueId}
                    onSelectManager={(uid) => { handleSelectManager(uid); handleTabChange('managers'); }}
                  />
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
                      <p className="text-gray-400 text-sm mb-6">
                        Click any manager to view their full career stats and trophy case.
                      </p>
                      <ManagersList leagueId={leagueId} onSelectManager={handleSelectManager} />
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'h2h' && (
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
            </div>
          </nav>

        </main>
      </div>
    </div>
  );
}
