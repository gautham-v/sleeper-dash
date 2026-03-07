'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronRight, Lock, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { sleeperApi } from '@/api/sleeper';
import { saveSessionUser } from '@/hooks/useSessionUser';
import { avatarUrl } from '@/utils/calculations';
import { fetchUserLeaguesGrouped } from '@/utils/leagueSeasons';
import type { SleeperLeague } from '@/types/sleeper';

interface FoundUser {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
}

interface HeaderUserSearchProps {
  isPro?: boolean;
  onUpgrade?: () => void;
}

export function HeaderUserSearch({ isPro = false, onUpgrade }: HeaderUserSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leagueGroups, setLeagueGroups] = useState<[string, SleeperLeague[]][] | null>(null);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Auto-focus input when opened; reset state when closed
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 210);
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setUsername('');
      setLeagueGroups(null);
      setFoundUser(null);
      setError(null);
      setShowDropdown(false);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [isOpen]);

  const performSearch = async (query: string) => {
    setLoading(true);
    setShowDropdown(true);
    setLeagueGroups(null);
    setFoundUser(null);
    setError(null);

    try {
      const sleeperUser = await sleeperApi.getUser(query);
      if (!sleeperUser?.user_id) throw new Error('Sleeper user not found');

      const byRecent = await fetchUserLeaguesGrouped(sleeperUser.user_id);

      setFoundUser({
        userId: sleeperUser.user_id,
        username: query,
        displayName: sleeperUser.display_name ?? query,
        avatar: sleeperUser.avatar ?? null,
      });
      setLeagueGroups(byRecent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    setError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setLeagueGroups(null);
      setFoundUser(null);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void performSearch(value.trim());
    }, 300);
  };

  const handleClearInput = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setUsername('');
    setLeagueGroups(null);
    setFoundUser(null);
    setError(null);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleSelectLeague = (group: SleeperLeague[]) => {
    if (!foundUser || !leagueGroups) return;
    const latest = [...group].sort((a, b) => Number(b.season) - Number(a.season))[0];

    saveSessionUser({
      username: foundUser.username,
      userId: foundUser.userId,
      displayName: foundUser.displayName,
      avatar: foundUser.avatar,
      leagueGroups,
    });

    posthog.capture('lookup_user_navigated', {
      target_username: foundUser.username,
      league_id: latest.league_id,
    });

    router.push(`/league/${latest.league_id}/overview`);
    setIsOpen(false);
  };

  return (
    <div className="relative flex items-center" ref={containerRef}>
      {/* Idle state: ghost text button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-all duration-200 whitespace-nowrap ${
          isOpen ? 'opacity-0 pointer-events-none w-0 overflow-hidden' : 'opacity-100'
        }`}
      >
        <Search size={14} />
        Look up a user
      </button>

      {/* Active state: expanding input */}
      <div
        className={`flex items-center gap-2 transition-all duration-200 ease-out overflow-hidden ${
          isOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={username}
            onChange={handleInputChange}
            placeholder="Sleeper username..."
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full h-8 pl-7 pr-7 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          {username && (
            <button
              onClick={handleClearInput}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0 p-0.5"
        >
          <X size={15} />
        </button>
      </div>

      {/* Dropdown panel */}
      {isOpen && showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-40 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="animate-spin text-gray-500" />
            </div>
          )}

          {!loading && error && (
            <div className="py-8 text-center text-sm text-gray-500 px-4">{error}</div>
          )}

          {!loading && !error && showDropdown && !foundUser && (
            <div className="py-8 text-center text-sm text-gray-500">No results</div>
          )}

          {!loading && foundUser && leagueGroups && (
            <>
              {/* User header */}
              <div className="px-4 py-2.5 flex items-center gap-2 border-b border-zinc-800">
                {foundUser.avatar && (
                  <img
                    src={avatarUrl(foundUser.avatar) ?? ''}
                    alt={foundUser.displayName}
                    className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                  />
                )}
                <span className="text-xs font-medium text-gray-200">{foundUser.displayName}</span>
                <span className="text-xs text-gray-600 ml-auto">
                  {leagueGroups.length} league{leagueGroups.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* League rows */}
              <div className="max-h-72 overflow-y-auto">
                {leagueGroups.map(([name, group], index) => {
                  const latest = [...group].sort((a, b) => Number(b.season) - Number(a.season))[0];
                  const locked = !isPro && index > 0;
                  return (
                    <button
                      key={latest.league_id}
                      onClick={() => {
                        if (locked) {
                          setIsOpen(false);
                          onUpgrade?.();
                        } else {
                          handleSelectLeague(group);
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        locked ? 'opacity-60 hover:bg-white/[0.03]' : 'hover:bg-white/5'
                      }`}
                    >
                      {latest.avatar ? (
                        <img
                          src={avatarUrl(latest.avatar) ?? ''}
                          alt={name}
                          className={`w-7 h-7 rounded-lg object-cover flex-shrink-0 ${locked ? 'opacity-50' : ''}`}
                        />
                      ) : (
                        <div
                          className={`w-7 h-7 rounded-lg bg-brand-purple/20 flex items-center justify-center text-brand-purple font-bold text-xs flex-shrink-0 border border-brand-purple/20 ${locked ? 'opacity-50' : ''}`}
                        >
                          {name.slice(0, 2)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${locked ? 'text-gray-500' : 'text-white'}`}>
                          {name}
                        </div>
                        <div className="text-xs text-gray-600">
                          {latest.season} · {group.length} season{group.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      {locked ? (
                        <Lock size={13} className="text-gray-600 flex-shrink-0" />
                      ) : (
                        <ChevronRight size={14} className="text-gray-600 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
