'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useLeagueRosters } from '@/hooks/useLeagueRosters';
import { useDashboardData } from '@/hooks/useLeagueData';
import { useSessionUser } from '@/hooks/useSessionUser';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlayerCareerPanel } from '@/components/PlayerCareerPanel';
import { avatarUrl } from '@/utils/calculations';

const POSITION_COLORS: Record<string, string> = {
  QB:  'bg-red-900/50 text-red-300 border-red-800/50',
  RB:  'bg-green-900/50 text-green-300 border-green-800/50',
  WR:  'bg-blue-900/50 text-blue-300 border-blue-800/50',
  TE:  'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
  K:   'bg-gray-700 text-gray-300 border-gray-600',
  DEF: 'bg-purple-900/50 text-purple-300 border-purple-800/50',
  DST: 'bg-purple-900/50 text-purple-300 border-purple-800/50',
};

const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;
type PositionFilter = typeof POSITIONS[number];

export default function PlayersPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const sessionUser = useSessionUser();
  const { computed } = useDashboardData(leagueId);

  // Default to signed-in user or first in standings
  const defaultUserId = useMemo(() => {
    if (!computed) return '';
    const standingIds = computed.standings.map(s => s.userId);
    if (sessionUser?.userId && standingIds.includes(sessionUser.userId)) {
      return sessionUser.userId;
    }
    return standingIds[0] ?? '';
  }, [computed, sessionUser]);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedSeasonLeagueId, setSelectedSeasonLeagueId] = useState('');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('All');
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  const effectiveUserId = selectedUserId || defaultUserId;
  const rostersData = useLeagueRosters(leagueId, selectedSeasonLeagueId || undefined);

  const managers = useMemo(() => {
    if (!computed) return [];
    return computed.standings
      .filter(s => !!s.userId)
      .map(s => ({ userId: s.userId, displayName: s.displayName, avatar: s.avatar }));
  }, [computed]);

  const selectedManager = rostersData.data?.managers.find(m => m.userId === effectiveUserId);

  const filteredPlayers = useMemo(() => {
    if (!selectedManager) return [];
    if (positionFilter === 'All') return selectedManager.players;
    return selectedManager.players.filter(p =>
      p.position === positionFilter || (positionFilter === 'DEF' && p.position === 'DST')
    );
  }, [selectedManager, positionFilter]);

  const displaySeason = rostersData.data?.seasons.find(
    s => s.leagueId === (selectedSeasonLeagueId || leagueId)
  )?.season ?? rostersData.data?.currentSeason ?? '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Players</h2>
        <p className="text-sm text-gray-400 mt-1">Browse current rosters by team and season</p>
      </div>

      {/* Filters row */}
      <div className="flex gap-3 flex-wrap">
        {/* Team selector */}
        <Select value={effectiveUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="bg-card-bg border-card-border text-white w-52">
            <SelectValue placeholder="Select a team" />
          </SelectTrigger>
          <SelectContent className="bg-card-bg border-card-border text-white">
            {managers.map(m => (
              <SelectItem key={m.userId} value={m.userId}>
                <div className="flex items-center gap-2">
                  {m.avatar && avatarUrl(m.avatar) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl(m.avatar)!} alt="" className="w-5 h-5 rounded-full" />
                  )}
                  {m.displayName}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Season selector */}
        {rostersData.data && rostersData.data.seasons.length > 1 && (
          <Select
            value={selectedSeasonLeagueId || leagueId}
            onValueChange={v => { setSelectedSeasonLeagueId(v === leagueId ? '' : v); setExpandedPlayerId(null); }}
          >
            <SelectTrigger className="bg-card-bg border-card-border text-white w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card-bg border-card-border text-white">
              {[...rostersData.data.seasons].reverse().map(s => (
                <SelectItem key={s.leagueId} value={s.leagueId}>
                  {s.season}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Position filter chips */}
      <div className="flex gap-2 flex-wrap">
        {POSITIONS.map(pos => (
          <button
            key={pos}
            onClick={() => setPositionFilter(pos)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              positionFilter === pos
                ? 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40'
                : 'bg-card-bg text-gray-400 border-card-border hover:text-gray-200'
            }`}
          >
            {pos}
          </button>
        ))}
      </div>

      {/* Roster table */}
      {rostersData.isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-brand-cyan mr-2" size={24} />
          <span className="text-gray-400 text-sm">Loading rosters…</span>
        </div>
      ) : selectedManager ? (
        <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-card-border">
            <div className="flex items-center gap-2">
              {selectedManager.avatar && avatarUrl(selectedManager.avatar) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl(selectedManager.avatar)!} alt="" className="w-7 h-7 rounded-full" />
              )}
              <span className="font-semibold text-white">{selectedManager.displayName}&apos;s Roster</span>
              <span className="text-sm text-gray-500">· {displaySeason}</span>
              <span className="ml-auto text-xs text-gray-600">({filteredPlayers.length} players)</span>
            </div>
          </div>

          {filteredPlayers.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">No players for this filter.</div>
          ) : (
            <div className="divide-y divide-card-border/40">
              {filteredPlayers.map(player => {
                const posClass = POSITION_COLORS[player.position] ?? 'bg-gray-700 text-gray-300 border-gray-600';
                const isExpanded = expandedPlayerId === player.playerId;
                return (
                  <div key={player.playerId}>
                    <button
                      onClick={() => setExpandedPlayerId(isExpanded ? null : player.playerId)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors text-left"
                    >
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${posClass}`}>
                        {player.position}
                      </span>
                      <span className="text-sm text-white font-medium flex-1 truncate">{player.playerName}</span>
                      {player.nflTeam && (
                        <span className="text-xs text-gray-500 shrink-0">{player.nflTeam}</span>
                      )}
                      {isExpanded
                        ? <ChevronDown size={14} className="text-gray-500 shrink-0" />
                        : <ChevronRight size={14} className="text-gray-500 shrink-0" />
                      }
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-4">
                        <PlayerCareerPanel
                          leagueId={leagueId}
                          playerId={player.playerId}
                          playerName={player.playerName}
                          position={player.position}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
          <div className="text-2xl mb-3">👥</div>
          <div className="text-sm font-medium text-gray-300">Select a team to view their roster</div>
        </div>
      )}
    </div>
  );
}
