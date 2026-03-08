'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useLeagueRosters } from '@/hooks/useLeagueRosters';
import { useDashboardData } from '@/hooks/useLeagueData';
import { useSessionUser } from '@/hooks/useSessionUser';
import { usePlayerRecommendations } from '@/hooks/usePlayerRecommendations';
import { usePickRecommendations } from '@/hooks/usePickRecommendations';
import type { PlayerRecommendation, PickRecommendation, PickVerdict } from '@/types/recommendations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlayerCareerPanel } from '@/components/PlayerCareerPanel';
import { avatarUrl } from '@/utils/calculations';
import { PosBadge, VerdictBadge, verdictTextColor, verdictPanelClasses } from '@/components/ui/badges';
import type { VerdictVariant } from '@/components/ui/badges';

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DST'];
type PositionFilter = 'All' | string;

function PickRow({ rec }: { rec: PickRecommendation }) {
  const [expanded, setExpanded] = useState(false);
  const pickLabel = rec.pick.slot != null
    ? `${rec.pick.season} ${rec.pick.round}.${rec.pick.slot.toString().padStart(2, '0')}`
    : `${rec.pick.season} Rd ${rec.pick.round}`;

  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 hover:bg-muted/10 transition-colors text-left"
      >
        <PosBadge pos="PICK" />
        <span className="text-sm font-medium text-foreground flex-1">{pickLabel}</span>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {rec.contextualWAR.toFixed(1)} cWAR
        </span>
        <VerdictBadge verdict={rec.verdict} size="xs" />
        {expanded
          ? <ChevronDown size={14} className="text-muted-foreground shrink-0" />
          : <ChevronRight size={14} className="text-muted-foreground shrink-0" />
        }
      </button>
      {expanded && (
        <div className="px-3 sm:px-5 pb-3">
          <div className={`rounded-lg px-3 py-2 text-xs ${verdictPanelClasses(rec.verdict)}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-semibold ${verdictTextColor(rec.verdict)}`}>
                {rec.verdict === 'TRADE_UP' ? 'TRADE UP' : rec.verdict === 'TRADE_DOWN' ? 'TRADE DOWN' : rec.verdict}
              </span>
              <span className="text-muted-foreground">{rec.reason}</span>
            </div>
            {rec.overrideApplied && (
              <div className="mt-1 text-[10px] text-muted-foreground/50 italic">
                Rule applied: {rec.overrideApplied.replace(/-/g, ' ')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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

  // HTC recommendations — only for the current season (not historical)
  const isCurrentSeason = !selectedSeasonLeagueId || selectedSeasonLeagueId === leagueId;
  const recommendations = usePlayerRecommendations(
    isCurrentSeason ? leagueId : null,
    effectiveUserId || null,
  );
  const pickRecs = usePickRecommendations(isCurrentSeason ? leagueId : null, effectiveUserId || null);

  const recMap = useMemo(() => {
    const m = new Map<string, PlayerRecommendation>();
    if (!recommendations.data) return m;
    for (const r of recommendations.data.players) m.set(r.playerId, r);
    return m;
  }, [recommendations.data]);

  const managers = useMemo(() => {
    if (!computed) return [];
    return computed.standings
      .filter(s => !!s.userId)
      .map(s => ({ userId: s.userId, displayName: s.displayName, avatar: s.avatar }));
  }, [computed]);

  const selectedManager = rostersData.data?.managers.find(m => m.userId === effectiveUserId);

  // Positions that actually appear on this manager's roster
  const availablePositions = useMemo((): PositionFilter[] => {
    if (!selectedManager) return ['All'];
    const posSet = new Set(selectedManager.players.map(p => p.position === 'DST' ? 'DEF' : p.position));
    const sorted = POSITION_ORDER.filter(pos => posSet.has(pos));
    return ['All', ...sorted];
  }, [selectedManager]);

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

  const hasRecs = isCurrentSeason && recommendations.data != null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Players &amp; Assets</h2>
        <p className="text-sm text-muted-foreground mt-1">Roster, draft capital, and asset recommendations by team</p>
      </div>

      {/* Merged filter bar: team selector + season selector + position pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Team selector */}
        <Select value={effectiveUserId} onValueChange={v => { setSelectedUserId(v); setPositionFilter('All'); }}>
          <SelectTrigger className="bg-card-bg border-card-border text-foreground w-52 h-9">
            <SelectValue placeholder="Select a team" />
          </SelectTrigger>
          <SelectContent className="bg-card-bg border-card-border text-foreground">
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
            <SelectTrigger className="bg-card-bg border-card-border text-foreground w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card-bg border-card-border text-foreground">
              {[...rostersData.data.seasons].reverse().map(s => (
                <SelectItem key={s.leagueId} value={s.leagueId}>
                  {s.season}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Position filter pills — inline with selectors */}
        {availablePositions.length > 1 && (
          <div className="flex gap-1.5 flex-wrap">
            {availablePositions.map(pos => (
              <button
                key={pos}
                onClick={() => setPositionFilter(pos)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  positionFilter === pos
                    ? 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40'
                    : 'bg-card-bg text-muted-foreground border-card-border hover:text-foreground'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* HTC Summary bar */}
      {hasRecs && (
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Hold</span>
            <span className="font-semibold text-foreground">{recommendations.data!.summary.holdCount}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">Trade</span>
            <span className="font-semibold text-foreground">{recommendations.data!.summary.tradeCount}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Cut</span>
            <span className="font-semibold text-foreground">{recommendations.data!.summary.cutCount}</span>
          </span>
          {recommendations.data!.summary.tradeableValue > 0 && (
            <span className="ml-auto text-muted-foreground">
              Tradeable value: <span className="text-amber-400 font-medium">{Math.round(recommendations.data!.summary.tradeableValue).toLocaleString()}</span>
            </span>
          )}
        </div>
      )}

      {/* Roster table */}
      {rostersData.isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-brand-cyan mr-2" size={24} />
          <span className="text-muted-foreground text-sm">Loading rosters…</span>
        </div>
      ) : selectedManager ? (
        <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-card-border">
            <div className="flex items-center gap-2">
              {selectedManager.avatar && avatarUrl(selectedManager.avatar) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl(selectedManager.avatar)!} alt="" className="w-7 h-7 rounded-full" />
              )}
              <span className="font-semibold text-foreground">{selectedManager.displayName}&apos;s Roster</span>
              <span className="text-sm text-muted-foreground">· {displaySeason}</span>
              <span className="ml-auto text-xs text-muted-foreground/60">({filteredPlayers.length} players)</span>
            </div>
          </div>

          {filteredPlayers.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No players for this filter.</div>
          ) : (
            <div className="divide-y divide-card-border/40">
              {filteredPlayers.map(player => {
                const isExpanded = expandedPlayerId === player.playerId;
                const rec = recMap.get(player.playerId);
                return (
                  <div key={player.playerId}>
                    <button
                      onClick={() => setExpandedPlayerId(isExpanded ? null : player.playerId)}
                      className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 hover:bg-muted/10 transition-colors text-left"
                    >
                      <PosBadge pos={player.position} />
                      <span className="text-sm text-foreground font-medium flex-1 truncate">{player.playerName}</span>
                      {/* Verdict pill */}
                      {hasRecs && rec && <VerdictBadge verdict={rec.verdict} size="xs" title={rec.reason} />}
                      {player.nflTeam && (
                        <span className="text-xs text-muted-foreground/60 shrink-0 hidden sm:inline">{player.nflTeam}</span>
                      )}
                      {player.dynastyValue != null && (
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">{player.dynastyValue.toLocaleString()}</span>
                      )}
                      {isExpanded
                        ? <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                        : <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                      }
                    </button>
                    {isExpanded && (
                      <div className="px-3 sm:px-5 pb-4">
                        {/* Recommendation detail panel */}
                        {rec && (
                          <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${verdictPanelClasses(rec.verdict as VerdictVariant)}`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-semibold ${verdictTextColor(rec.verdict as VerdictVariant)}`}>
                                {rec.verdict}{rec.tradeType ? ` (${rec.tradeType})` : ''}
                              </span>
                              <span className="text-muted-foreground">{rec.reason}</span>
                              <span className="ml-auto text-muted-foreground/60 tabular-nums">
                                {rec.confidence}% confidence
                              </span>
                            </div>
                            {rec.dynastyValue != null && (
                              <div className="flex gap-4 mt-1.5 text-muted-foreground/70">
                                <span>WAR: <span className="text-foreground/80">{rec.playerWAR.toFixed(1)}</span></span>
                                <span>Value: <span className="text-foreground/80">{Math.round(rec.dynastyValue).toLocaleString()}</span></span>
                                <span>Curve: <span className={
                                  rec.ageCurveDirection === 'ascending' ? 'text-emerald-400'
                                    : rec.ageCurveDirection === 'declining' ? 'text-red-400'
                                      : 'text-foreground/80'
                                }>{rec.ageCurveDirection}</span></span>
                              </div>
                            )}
                          </div>
                        )}
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
          <div className="text-sm font-medium text-muted-foreground">Select a team to view their roster</div>
        </div>
      )}

      {/* Draft Capital */}
      {isCurrentSeason && pickRecs.data && pickRecs.data.length > 0 && (
        <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-card-border">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-sm">Draft Capital</span>
              <span className="text-xs text-muted-foreground">{pickRecs.data.length} picks</span>
              <div className="ml-auto flex items-center gap-2">
                {(['HOLD', 'TRADE', 'TRADE_UP', 'TRADE_DOWN'] as PickVerdict[]).map(v => {
                  const count = pickRecs.data!.filter(r => r.verdict === v).length;
                  if (count === 0) return null;
                  return (
                    <VerdictBadge key={v} verdict={v} size="xs" label={`${count} ${v === 'TRADE_UP' ? 'TRADE UP' : v === 'TRADE_DOWN' ? 'TRADE DOWN' : v}`} />
                  );
                })}
              </div>
            </div>
          </div>
          <div className="divide-y divide-card-border/40">
            {[...pickRecs.data]
              .sort((a, b) => Number(a.pick.season) - Number(b.pick.season) || a.pick.round - b.pick.round || (a.pick.slot ?? 99) - (b.pick.slot ?? 99))
              .map((rec, i) => (
                <PickRow key={i} rec={rec} />
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
