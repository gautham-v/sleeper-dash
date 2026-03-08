'use client';

import { Loader2, Zap, ChevronLeft, ChevronRight, ChevronDown, ArrowRightLeft, HelpCircle, Users } from 'lucide-react';
import { RookieMethodologySheet } from './methodology/RookieMethodologySheet';
import { useQuery } from '@tanstack/react-query';
import { useFranchiseOutlook } from '@/hooks/useFranchiseOutlook';
import { useRosters, useLeagueUsers } from '@/hooks/useLeagueData';
import { useSessionUser } from '@/hooks/useSessionUser';
import { useState, useMemo, useEffect, useRef } from 'react';
import posthog from 'posthog-js';
import { PosBadge } from '@/components/ui/badges';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import type { DraftBoardRequest, DraftBoardTarget } from '@/types/sleeper';
import type { CompPlayer } from '@/types/prospects';
import { sleeperApi } from '@/api/sleeper';

const PAGE_SIZE = 10;
const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE'];
const ROUND_LABELS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' };

interface RookieTargetsTabProps {
  leagueId: string;
}

interface DraftBoardResponse {
  targets: DraftBoardTarget[];
  isPreDraft: boolean;
}

interface DraftCapitalPick {
  round: number;
  slot?: number;
  isOwn: boolean;
  fromTeam?: string;
}

interface TradedAwayPick {
  round: number;
  slot?: number;
  toTeam: string;
}

// ---- Availability probability ----

function computeAvailability(prospectRank: number, pickPosition: number): number {
  // P(available at pick P | prospect ranked R)
  // The prospect is gone if they were taken by a pick before yours.
  // Only (pickPosition - 1) teams pick before you, and they take the top-ranked prospects.
  // If prospectRank > (pickPosition - 1), they can't have been taken yet.
  // Logistic smooth: sigma increases with rank (later prospects have more variance).
  const picksBefore = pickPosition - 1;
  if (picksBefore === 0) return 1; // first pick — everyone is available
  const sigma = Math.max(1.5, 1 + prospectRank * 0.06);
  return 1 / (1 + Math.exp((picksBefore - prospectRank) / sigma));
}

function formatPickLabel(slot: number, numTeams: number): string {
  const round = Math.ceil(slot / numTeams);
  const pick = ((slot - 1) % numTeams) + 1;
  return `${round}.${String(pick).padStart(2, '0')}`;
}

function slotToClassRank(slot: number, numTeams: number): number {
  const round = Math.ceil(slot / numTeams);
  const pickInRound = ((slot - 1) % numTeams) + 1;
  return (round - 1) * numTeams + pickInRound;
}

// ---- Helper sub-components ----

function NeedBadge({ label }: { label: DraftBoardTarget['needLabel'] }) {
  if (label === 'Critical Need') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
        Critical
      </span>
    );
  }
  if (label === 'Need') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400/80 border border-amber-500/20">
        Need
      </span>
    );
  }
  // "Value" — no badge, absence means value pick
  return null;
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className="flex items-center gap-1 shrink-0">
      <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">Score</span>
      <span className={`text-xs font-bold tabular-nums ${score >= 70 ? 'text-foreground' : 'text-muted-foreground'}`}>
        {score.toFixed(0)}
      </span>
    </span>
  );
}

function TimelineBadge({ badge }: { badge: DraftBoardTarget['timelineBadge'] }) {
  if (badge === 'immediate') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-foreground font-medium">
        <Zap size={10} className="shrink-0" />
        Day-1 impact
      </span>
    );
  }
  if (badge === 'year2') {
    return <span className="text-xs text-muted-foreground">Yr 2 impact</span>;
  }
  return <span className="text-xs text-muted-foreground/60">Yr 3+ impact</span>;
}

function CompPills({ comps, isArchetype }: { comps: CompPlayer[]; isArchetype?: boolean }) {
  if (isArchetype || comps.length === 0) return null;
  const shown = comps.slice(0, 3);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-muted-foreground/60">Comps:</span>
      {shown.map((c, i) => {
        const pts = c.year2PPR ?? c.year1PPR;
        const label = pts != null
          ? `${c.name} (${c.year2PPR != null ? 'Y2' : 'Y1'}: ${pts.toFixed(1)}pts)`
          : c.name;
        return (
          <span
            key={i}
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-card-bg text-muted-foreground border border-card-border"
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

function AvailabilityInline({
  prospectRank,
  userPickSlots,
  numTeams,
}: {
  prospectRank: number;
  userPickSlots: number[];
  numTeams: number;
}) {
  if (userPickSlots.length === 0) return null;

  const pickAvailabilities = userPickSlots.map((slot) => {
    const classRank = slotToClassRank(slot, numTeams);
    const pAvail = computeAvailability(prospectRank, classRank);
    return { slot, classRank, pAvail, label: formatPickLabel(slot, numTeams) };
  });

  const best = pickAvailabilities.find((p) => p.pAvail >= 0.05);
  if (!best) return null;

  const pct = Math.round(best.pAvail * 20) * 5;
  if (pct === 0) return null;

  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      ~{pct}% at {best.label}
    </span>
  );
}

// ---- Draft Capital (collapsible) ----

function DraftCapitalSection({
  owned,
  tradedAway,
  numTeams,
}: {
  owned: DraftCapitalPick[];
  tradedAway: TradedAwayPick[];
  numTeams: number;
}) {
  const sortedOwned = [...owned].sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    return (a.slot ?? 99) - (b.slot ?? 99);
  });
  const sortedTraded = [...tradedAway].sort((a, b) => a.round - b.round);

  // Build compact summary for collapsed state
  const summaryParts = sortedOwned.map((p) => {
    const label = ROUND_LABELS[p.round] ?? `${p.round}th`;
    const slotLabel = p.slot ? ` (${formatPickLabel(p.slot, numTeams)})` : '';
    return `${label}${slotLabel}`;
  });
  const summaryText = summaryParts.join(', ') || 'No picks';

  return (
    <Collapsible>
      <CollapsibleTrigger className="group w-full flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-card-bg border border-card-border rounded-xl hover:bg-muted/10 transition-colors text-left">
        <ArrowRightLeft size={13} className="text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold text-foreground shrink-0">2026 Capital</span>
        <span className="text-xs text-muted-foreground truncate flex-1">{summaryText}</span>
        <ChevronDown size={14} className="text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 bg-card-bg border border-card-border rounded-xl p-3 space-y-2">
          {/* Owned picks */}
          {sortedOwned.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {sortedOwned.map((p, i) => {
                const slotLabel = p.slot ? formatPickLabel(p.slot, numTeams) : null;
                return (
                  <div
                    key={`own-${i}`}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-card-border bg-muted/5 text-xs"
                  >
                    <span className="font-semibold text-foreground">
                      {ROUND_LABELS[p.round] ?? `${p.round}th`}
                    </span>
                    {slotLabel && (
                      <span className="text-muted-foreground/60 tabular-nums">({slotLabel})</span>
                    )}
                    {p.isOwn ? (
                      <span className="text-muted-foreground/50">own</span>
                    ) : (
                      <span className="text-emerald-400/80">via {p.fromTeam}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No 2026 picks — all draft capital has been traded away.
            </p>
          )}

          {/* Traded away picks */}
          {sortedTraded.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sortedTraded.map((p, i) => {
                const slotLabel = p.slot ? formatPickLabel(p.slot, numTeams) : null;
                return (
                  <div
                    key={`away-${i}`}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-card-border/50 opacity-50 text-xs"
                  >
                    <span className="font-medium text-muted-foreground line-through">
                      {ROUND_LABELS[p.round] ?? `${p.round}th`}
                    </span>
                    {slotLabel && (
                      <span className="text-muted-foreground tabular-nums line-through">({slotLabel})</span>
                    )}
                    <span className="text-red-400/80">to {p.toTeam}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ---- Main component ----

export function RookieTargetsTab({ leagueId }: RookieTargetsTabProps) {
  const { data: outlookData, isLoading: outlookLoading } = useFranchiseOutlook(leagueId);
  const { data: rosters, isLoading: rostersLoading } = useRosters(leagueId);
  const { data: leagueUsers, isLoading: usersLoading } = useLeagueUsers(leagueId);

  const isLoading = outlookLoading || rostersLoading || usersLoading;

  const managers = useMemo(() => {
    if (!rosters || !leagueUsers) return [];
    const userMap = new Map(leagueUsers.map((u) => [u.user_id, u]));
    return rosters
      .filter((r) => !!r.owner_id)
      .map((r) => {
        const user = userMap.get(r.owner_id!);
        return {
          userId: r.owner_id!,
          rosterId: r.roster_id,
          displayName: user?.metadata?.team_name || user?.display_name || `Team ${r.roster_id}`,
        };
      })
      .filter((m) => !!m.userId);
  }, [rosters, leagueUsers]);

  const rosterIdToName = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of managers) {
      map.set(m.rosterId, m.displayName);
    }
    return map;
  }, [managers]);

  const sessionUser = useSessionUser();
  const [selectedUserId, setSelectedUserId] = useState('');
  const defaultUserId = managers.find((m) => m.userId === sessionUser?.userId)?.userId ?? managers[0]?.userId ?? '';
  const effectiveUserId = selectedUserId || defaultUserId;
  const effectiveManager = managers.find((m) => m.userId === effectiveUserId);

  const userOutlook = outlookData?.outlookMap.get(effectiveUserId);

  const draftBoardRequestBody: DraftBoardRequest = {
    draftYear: 2026,
    warByPosition: userOutlook?.warByPosition ?? [],
    tier: userOutlook?.tier ?? 'Fringe',
    peakYearOffset: userOutlook?.peakYearOffset ?? 2,
  };

  const {
    data: draftBoardData,
    isLoading: draftBoardLoading,
    isError: draftBoardError,
  } = useQuery<DraftBoardResponse>({
    queryKey: ['draft-board', leagueId, effectiveUserId],
    queryFn: async () => {
      const res = await fetch('/api/draft-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftBoardRequestBody),
      });
      if (!res.ok) throw new Error('Failed to fetch draft board');
      return res.json() as Promise<DraftBoardResponse>;
    },
    enabled: !isLoading && !!effectiveUserId,
    staleTime: 30 * 60 * 1000,
  });

  const { data: rookieDraftData } = useQuery({
    queryKey: ['rookie-draft-2026', leagueId],
    queryFn: async () => {
      const currentDrafts = await sleeperApi.getDrafts(leagueId);
      const found = currentDrafts.find(
        (d) => d.season === '2026' && (d.status === 'pre_draft' || d.status === 'paused'),
      );
      if (found) return found;

      const users = await sleeperApi.getLeagueUsers(leagueId);
      const anyUserId = users[0]?.user_id;
      if (!anyUserId) return null;

      const userLeagues2026 = await sleeperApi.getUserLeagues(anyUserId, '2026');
      const successor = userLeagues2026.find((l) => l.previous_league_id === leagueId);
      if (!successor) return null;

      const successorDrafts = await sleeperApi.getDrafts(successor.league_id);
      return successorDrafts.find(
        (d) => d.season === '2026' && (d.status === 'pre_draft' || d.status === 'paused'),
      ) ?? null;
    },
    enabled: !!leagueId,
    staleTime: 60 * 60 * 1000,
  });

  const numTeams = rookieDraftData?.settings.teams ?? rosters?.length ?? 12;

  const rosterSlotMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!rookieDraftData) return map;

    if (rookieDraftData.slot_to_roster_id) {
      for (const [slot, rosterId] of Object.entries(rookieDraftData.slot_to_roster_id)) {
        map.set(rosterId, Number(slot));
      }
    } else if (rookieDraftData.draft_order && managers.length > 0) {
      for (const [userId, slot] of Object.entries(rookieDraftData.draft_order)) {
        const manager = managers.find((m) => m.userId === userId);
        if (manager) map.set(manager.rosterId, slot as number);
      }
    }
    return map;
  }, [rookieDraftData, managers]);

  const userPickSlots = useMemo(() => {
    if (rosterSlotMap.size === 0 || !effectiveManager) return [];
    const futurePicks = userOutlook?.futurePicks ?? [];
    const slots: number[] = [];
    const nTeams = numTeams;
    for (const pick of futurePicks) {
      if (pick.season !== '2026') continue;
      const originalSlot = rosterSlotMap.get(pick.roster_id);
      if (originalSlot == null) continue;
      const globalSlot = (pick.round - 1) * nTeams + originalSlot;
      slots.push(globalSlot);
    }
    return slots.sort((a, b) => a - b);
  }, [rosterSlotMap, effectiveManager, userOutlook, numTeams]);

  const { ownedPicks, tradedAwayPicks } = useMemo(() => {
    const owned: DraftCapitalPick[] = [];
    const tradedAway: TradedAwayPick[] = [];
    const myRosterId = effectiveManager?.rosterId;
    if (!myRosterId) return { ownedPicks: owned, tradedAwayPicks: tradedAway };

    const nTeams = numTeams;

    const futurePicks = userOutlook?.futurePicks ?? [];
    for (const pick of futurePicks) {
      if (pick.season !== '2026') continue;
      const originalSlot = rosterSlotMap.get(pick.roster_id);
      const globalSlot = originalSlot != null
        ? (pick.round - 1) * nTeams + originalSlot
        : undefined;
      owned.push({
        round: pick.round,
        slot: globalSlot,
        isOwn: pick.roster_id === myRosterId,
        fromTeam: pick.roster_id !== myRosterId
          ? rosterIdToName.get(pick.roster_id) ?? `Team ${pick.roster_id}`
          : undefined,
      });
    }

    const picksByRosterId = outlookData?.rawContext?.picksByRosterId;
    if (picksByRosterId) {
      for (const [ownerId, picks] of picksByRosterId) {
        if (ownerId === myRosterId) continue;
        for (const pick of picks) {
          if (pick.season !== '2026') continue;
          if (pick.roster_id === myRosterId) {
            const originalSlot = rosterSlotMap.get(pick.roster_id);
            const globalSlot = originalSlot != null
              ? (pick.round - 1) * nTeams + originalSlot
              : undefined;
            tradedAway.push({
              round: pick.round,
              slot: globalSlot,
              toTeam: rosterIdToName.get(ownerId) ?? `Team ${ownerId}`,
            });
          }
        }
      }
    }

    return { ownedPicks: owned, tradedAwayPicks: tradedAway };
  }, [effectiveManager, userOutlook, outlookData?.rawContext?.picksByRosterId, rosterIdToName, rosterSlotMap, numTeams]);

  const [page, setPage] = useState(0);
  const [positionFilter, setPositionFilter] = useState<string>('All');
  const [rookieSheetOpen, setRookieSheetOpen] = useState(false);
  const [expandedProspect, setExpandedProspect] = useState<number | null>(0); // auto-expand first

  const anyLoading = isLoading || draftBoardLoading;

  const allTargets = useMemo(() => draftBoardData?.targets ?? [], [draftBoardData?.targets]);
  const isPreDraft = draftBoardData?.isPreDraft ?? false;

  const positionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of allTargets) {
      counts.set(t.position, (counts.get(t.position) ?? 0) + 1);
    }
    return counts;
  }, [allTargets]);

  const availablePositions = useMemo(() => {
    const positions = POSITION_ORDER.filter(pos => positionCounts.has(pos));
    return ['All', ...positions];
  }, [positionCounts]);

  const targets = useMemo(() => {
    if (positionFilter === 'All') return allTargets;
    return allTargets.filter(t => t.position === positionFilter);
  }, [allTargets, positionFilter]);

  const totalPages = Math.ceil(targets.length / PAGE_SIZE);
  const pageTargets = targets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const draftBoardTracked = useRef(false);
  useEffect(() => {
    if (draftBoardData && !draftBoardTracked.current) {
      draftBoardTracked.current = true;
      posthog.capture('draft_board_viewed', { league_id: leagueId });
    }
  }, [draftBoardData, leagueId]);

  if (anyLoading) {
    return (
      <div className="flex items-center justify-center h-60 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={22} />
        <span className="text-sm">Building draft board…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Merged filter bar: manager selector + position pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {managers.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Users size={14} className="text-muted-foreground" />
            <Select value={effectiveUserId} onValueChange={(v) => { setSelectedUserId(v); setPage(0); setExpandedProspect(0); }}>
              <SelectTrigger className="bg-card-bg border-card-border text-foreground w-52 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card-bg border-card-border">
                {managers.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {availablePositions.length > 1 && (
          <div className="flex gap-1.5 flex-wrap">
            {availablePositions.map(pos => (
              <button
                key={pos}
                onClick={() => { setPositionFilter(pos); setPage(0); setExpandedProspect(0); }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  positionFilter === pos
                    ? 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40'
                    : 'bg-card-bg text-muted-foreground border-card-border hover:text-foreground'
                }`}
              >
                {pos === 'All' ? `All (${allTargets.length})` : `${pos} (${positionCounts.get(pos) ?? 0})`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pre-draft disclaimer — compact inline */}
      {isPreDraft && (
        <p className="text-xs text-amber-400/80 px-1">
          <span className="font-medium">Pre-draft rankings</span> — consensus estimates, auto-updates after NFL Draft (April 24).
        </p>
      )}

      {/* Draft Capital — collapsible, collapsed by default */}
      {(ownedPicks.length > 0 || tradedAwayPicks.length > 0) && (
        <DraftCapitalSection
          owned={ownedPicks}
          tradedAway={tradedAwayPicks}
          numTeams={numTeams}
        />
      )}

      {/* Error state */}
      {draftBoardError && !anyLoading && (
        <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
          <div className="text-sm font-medium text-zinc-300">Could not load draft board</div>
          <div className="text-xs text-muted-foreground mt-1">Please try again later.</div>
        </div>
      )}

      {/* Empty filter state */}
      {!draftBoardError && allTargets.length > 0 && targets.length === 0 && (
        <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
          <div className="text-sm font-medium text-zinc-300">No {positionFilter} prospects in the current class</div>
          <div className="text-xs text-muted-foreground mt-1">Try selecting a different position.</div>
        </div>
      )}

      {/* Prospect list */}
      {!draftBoardError && targets.length > 0 ? (
        <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
          <div className="divide-y divide-card-border/40">
            {pageTargets.map((t, i) => {
              const globalIdx = page * PAGE_SIZE + i;
              const isExpanded = expandedProspect === globalIdx;
              return (
                <div key={globalIdx}>
                  {/* Collapsed row */}
                  <button
                    onClick={() => setExpandedProspect(isExpanded ? null : globalIdx)}
                    className="w-full flex items-center gap-2 px-3 sm:px-4 py-2.5 hover:bg-muted/10 transition-colors text-left"
                  >
                    {/* Rank */}
                    <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold bg-card-border text-muted-foreground">
                      {globalIdx + 1}
                    </span>

                    <PosBadge pos={t.position} />

                    <span className="text-sm text-foreground font-medium flex-1 truncate">
                      {t.isArchetype ? `~${t.name}` : t.name}
                    </span>

                    <NeedBadge label={t.needLabel} />
                    <ScoreBadge score={t.targetScore} />

                    {isExpanded
                      ? <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                      : <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                    }
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-3 sm:px-4 pb-3 space-y-1.5">
                      {/* Rankings & timeline */}
                      <div className="flex items-center gap-2 flex-wrap text-xs pl-7">
                        <span className="text-muted-foreground">
                          #{t.overallRank} in class · #{t.positionRank} {t.position}
                        </span>
                        <span className="text-card-border">·</span>
                        <TimelineBadge badge={t.timelineBadge} />
                        {t.surplusFlag && (
                          <>
                            <span className="text-card-border">·</span>
                            <span className="text-emerald-400 font-medium">Value</span>
                          </>
                        )}
                      </div>

                      {/* Outcome probabilities + availability */}
                      <div className="flex items-center gap-2 flex-wrap text-xs pl-7">
                        <span className="text-muted-foreground">
                          <span className="font-semibold text-foreground">{Math.round(t.pStarter)}%</span> starter
                        </span>
                        <span className="text-card-border">·</span>
                        <span className="text-muted-foreground">
                          <span className="font-semibold text-foreground">{Math.round(t.pElite)}%</span> elite
                        </span>
                        {t.confidence !== 'high' && (
                          <>
                            <span className="text-card-border">·</span>
                            <span className="text-muted-foreground/60">{t.confidence} confidence</span>
                          </>
                        )}
                        {userPickSlots.length > 0 && (
                          <>
                            <span className="text-card-border">·</span>
                            <AvailabilityInline
                              prospectRank={t.overallRank}
                              userPickSlots={userPickSlots}
                              numTeams={numTeams}
                            />
                          </>
                        )}
                      </div>

                      {/* Reason + impact */}
                      {(t.reason || t.impactSummary) && (
                        <div className="text-xs text-muted-foreground/80 leading-snug pl-7">
                          {t.reason}
                          {t.reason && t.impactSummary && ' — '}
                          {t.impactSummary}
                        </div>
                      )}

                      {/* Comps */}
                      <div className="pl-7">
                        <CompPills comps={t.comps} isArchetype={t.isArchetype} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination + methodology link */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-t border-card-border/50">
              <button
                onClick={() => { setPage((p) => Math.max(0, p - 1)); setExpandedProspect(0); }}
                disabled={page === 0}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <span className="text-xs text-muted-foreground/60">
                {page + 1} / {totalPages} · {targets.length} prospect{targets.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => { setPage((p) => Math.min(totalPages - 1, p + 1)); setExpandedProspect(0); }}
                disabled={page === totalPages - 1}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Methodology link in footer */}
          <div className="flex items-center justify-center px-3 sm:px-4 py-2.5 border-t border-card-border/50">
            <button
              onClick={() => setRookieSheetOpen(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <HelpCircle size={12} />
              How rankings work
            </button>
          </div>
        </div>
      ) : (
        !draftBoardError && !anyLoading && allTargets.length === 0 && (
          <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
            <div className="text-sm font-medium text-zinc-300">No rookie targets available</div>
            <div className="text-xs text-muted-foreground mt-1">
              Rookie targets are generated based on your roster weaknesses and FantasyCalc dynasty values.
            </div>
          </div>
        )
      )}

      <RookieMethodologySheet open={rookieSheetOpen} onOpenChange={setRookieSheetOpen} />
    </div>
  );
}
