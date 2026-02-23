import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { TABS, type TabId } from '@/lib/tabs';
import { avatarUrl } from '@/utils/calculations';
import type { SleeperLeague } from '@/types/sleeper';

export type SidebarNavProps = {
  league: SleeperLeague | null | undefined;
  leagueId: string;
  activeTab: TabId;
  allLeagueGroups: [string, SleeperLeague[]][];
  isOffseason: boolean;
  currentWeek: number;
  onChangeLeague: (id: string) => void;
  onTabChange: (tab: TabId) => void;
  onBack: () => void;
  onClose?: () => void;
};

export function SidebarNav({
  league, leagueId, activeTab, allLeagueGroups, isOffseason, currentWeek,
  onChangeLeague, onTabChange, onBack, onClose,
}: SidebarNavProps) {
  const [leagueDropdownOpen, setLeagueDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null!);
  const hasMultipleLeagues = allLeagueGroups.length > 1;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLeagueDropdownOpen(false);
      }
    }
    if (leagueDropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [leagueDropdownOpen]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 sm:p-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-cyan/10 flex items-center justify-center border border-brand-cyan/20">
            <span className="text-brand-cyan font-bold text-lg leading-none" style={{ marginTop: '-2px' }}>∞</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-white">recordbook.fyi</span>
        </div>
        <button
          onClick={onClose ?? onBack}
          className="text-gray-500 hover:text-white transition-colors p-1"
          title={onClose ? 'Close menu' : 'Back to Leagues'}
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      <div className="px-4 sm:px-5 mb-5 shrink-0">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={hasMultipleLeagues ? () => setLeagueDropdownOpen((o) => !o) : undefined}
            disabled={!hasMultipleLeagues}
            className={`w-full flex items-center gap-3 bg-card-bg p-3 rounded-2xl border border-card-border text-left transition-colors ${
              hasMultipleLeagues ? 'cursor-pointer hover:border-card-border/60' : 'cursor-default'
            }`}
          >
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
              <div className="flex items-center gap-1 min-w-0">
                <h2 className="text-sm font-bold text-white truncate leading-tight">{league?.name ?? 'League'}</h2>
                {hasMultipleLeagues && <ChevronDown size={12} className="text-gray-400 flex-shrink-0 ml-0.5" />}
              </div>
              <span className="text-xs text-gray-500">
                {league?.season}{isOffseason ? ' · Offseason' : ` · Wk ${currentWeek}`}
              </span>
            </div>
          </button>

          {leagueDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-card-bg border border-card-border rounded-xl shadow-2xl z-30 py-1 overflow-hidden">
              {allLeagueGroups.map(([name, group]) => {
                const latest = [...group].sort((a, b) => Number(b.season) - Number(a.season))[0];
                const isActive = group.some((g) => g.league_id === leagueId);
                return (
                  <button
                    key={latest.league_id}
                    onClick={() => {
                      onChangeLeague(latest.league_id);
                      setLeagueDropdownOpen(false);
                      onClose?.();
                    }}
                    className={`w-full text-left px-3 py-2.5 text-xs transition-colors flex items-center gap-2.5 ${
                      isActive
                        ? 'bg-brand-cyan/20 text-brand-cyan font-medium'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {latest.avatar ? (
                      <img
                        src={avatarUrl(latest.avatar) ?? ''}
                        alt={name}
                        className="w-5 h-5 rounded-md object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-md bg-brand-purple/20 flex items-center justify-center text-brand-purple font-bold text-[10px] flex-shrink-0 border border-brand-purple/20">
                        {name.slice(0, 2)}
                      </div>
                    )}
                    <span className="truncate">{name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 sm:px-4 pb-6 flex flex-col gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { onTabChange(id); onClose?.(); }}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 justify-start relative ${
              activeTab === id
                ? 'bg-brand-cyan/10 text-brand-cyan before:absolute before:left-0 before:top-[10%] before:h-[80%] before:w-1 before:bg-brand-cyan before:rounded-r-full'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <Icon size={18} className={activeTab === id ? 'text-brand-cyan' : 'text-gray-500'} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
