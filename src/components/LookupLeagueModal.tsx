'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search, Loader2, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { Button } from '@/components/ui/button';
import { sleeperApi } from '@/api/sleeper';
import { saveSessionUser } from '@/hooks/useSessionUser';
import { avatarUrl } from '@/utils/calculations';
import type { SleeperLeague } from '@/types/sleeper';

interface LookupLeagueModalProps {
  onClose: () => void;
}

export function LookupLeagueModal({ onClose }: LookupLeagueModalProps) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leagueGroups, setLeagueGroups] = useState<[string, SleeperLeague[]][] | null>(null);
  const [foundUser, setFoundUser] = useState<{
    userId: string;
    username: string;
    displayName: string;
    avatar: string | null;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setLeagueGroups(null);
    setFoundUser(null);

    try {
      const sleeperUser = await sleeperApi.getUser(trimmed);
      if (!sleeperUser?.user_id) throw new Error('Sleeper user not found');

      const [l2024, l2025] = await Promise.all([
        sleeperApi.getUserLeagues(sleeperUser.user_id, '2024').catch(() => []),
        sleeperApi.getUserLeagues(sleeperUser.user_id, '2025').catch(() => []),
      ]);

      const allLeagues = [...(l2024 ?? []), ...(l2025 ?? [])];
      if (allLeagues.length === 0) throw new Error('No leagues found for this user');

      const grouped = allLeagues.reduce<Record<string, typeof allLeagues>>((acc, l) => {
        (acc[l.name] ??= []).push(l);
        return acc;
      }, {});
      const byRecent = Object.entries(grouped).sort(([, a], [, b]) => {
        const maxA = Math.max(...a.map((l) => Number(l.season)));
        const maxB = Math.max(...b.map((l) => Number(l.season)));
        return maxB - maxA;
      });

      setFoundUser({
        userId: sleeperUser.user_id,
        username: trimmed,
        displayName: sleeperUser.display_name ?? trimmed,
        avatar: sleeperUser.avatar ?? null,
      });
      setLeagueGroups(byRecent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
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
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full sm:max-w-md bg-card-bg border border-card-border rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl">
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-0">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-card-border/60">
          <div className="flex items-center gap-2">
            <Search size={15} className="text-brand-cyan flex-shrink-0" />
            <h2 className="text-sm font-bold text-white">Look up a user</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="px-5 pt-4 pb-3 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(null); setLeagueGroups(null); setFoundUser(null); }}
            placeholder="Sleeper username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={loading}
            className="flex-1 bg-base-bg border border-card-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/20 disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={!username.trim() || loading}
            size="sm"
            className="shrink-0 h-auto py-2.5 px-4"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : 'Search'}
          </Button>
        </form>

        {error && (
          <p className="px-5 pb-3 text-xs text-red-400">{error}</p>
        )}

        {/* Results */}
        {leagueGroups && foundUser && (
          <div className="border-t border-card-border/40 max-h-64 overflow-y-auto">
            <div className="px-5 py-2.5 flex items-center gap-2 border-b border-card-border/20">
              {foundUser.avatar && (
                <img
                  src={avatarUrl(foundUser.avatar) ?? ''}
                  alt={foundUser.displayName}
                  className="w-5 h-5 rounded-full object-cover"
                />
              )}
              <span className="text-xs font-medium text-gray-300">{foundUser.displayName}</span>
              <span className="text-xs text-gray-600">· {leagueGroups.length} league{leagueGroups.length !== 1 ? 's' : ''}</span>
            </div>
            {leagueGroups.map(([name, group]) => {
              const latest = [...group].sort((a, b) => Number(b.season) - Number(a.season))[0];
              return (
                <button
                  key={latest.league_id}
                  onClick={() => handleSelectLeague(group)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors text-left"
                >
                  {latest.avatar ? (
                    <img
                      src={avatarUrl(latest.avatar) ?? ''}
                      alt={name}
                      className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-brand-purple/20 flex items-center justify-center text-brand-purple font-bold text-xs flex-shrink-0 border border-brand-purple/20">
                      {name.slice(0, 2)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{name}</div>
                    <div className="text-xs text-gray-500">
                      {latest.season} · {group.length} season{group.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-600 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {/* Safe area bottom padding on mobile */}
        <div className="sm:hidden pb-6" />
      </div>
    </div>
  );
}
