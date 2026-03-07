'use client';

import { Loader2, Zap, ChevronLeft, ChevronRight, ArrowRightLeft } from 'lucide-react';
import { RookieMethodologySheet } from './methodology/RookieMethodologySheet';
import { useQuery } from '@tanstack/react-query';
import { useFranchiseOutlook } from '@/hooks/useFranchiseOutlook';
import { useRosters, useLeagueUsers } from '@/hooks/useLeagueData';
import { useSessionUser } from '@/hooks/useSessionUser';
import { useState, useMemo, useEffect, useRef } from 'react';
import posthog from 'posthog-js';
import { PosBadge } from '@/components/ui/badges';
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
  fromTeam?: string; // team name if acquired
}

interface TradedAwayPick {
  round: number;
  slot?: number;
  toTeam: string;
}

// ---- Availability probability ----

function computeAvailability(prospectRank: number, pickPosition: number): number {
  // Logistic model: P(available at pick P | prospect ranked R)
  // Higher rank = picked earlier, so if R < P the prospect is likely gone
  const sigma = Math.max(1.5, 1 + prospectRank * 0.08);
  return 1 / (1 + Math.exp(-(prospectRank - pickPosition) / sigma));
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

function NeedLabelBadge({ label }: { label: DraftBoardTarget['needLabel'] }) {
  if (label === 'Critical Need') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
        Critical Need
      </span>
    );
  }
  if (label === 'Need') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
        Need
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-zinc-700 text-zinc-400 dark:bg-zinc-700 dark:text-zinc-400">
      Value
    </span>
  );
}

function TargetScoreBadge({ score }: { score: number }) {
  const rounded = score.toFixed(0);
  const colorCls =
    score >= 80 ? 'text-green-400' :
    score >= 60 ? 'text-yellow-400' :
    'text-zinc-500';
  return (
    <span className={`text-xs font-bold tabular-nums ${colorCls}`} title="Roster fit score (0–100)">
      {rounded}
    </span>
  );
}

function TimelineBadge({ badge }: { badge: DraftBoardTarget['timelineBadge'] }) {
  if (badge === 'immediate') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-green-400">
        <Zap size={10} className="flex-shrink-0" />
        Day-1 impact
      </span>
    );
  }
  if (badge === 'year2') {
    return <span className="text-xs text-yellow-400">Yr 2 impact</span>;
  }
  return <span className="text-xs text-zinc-500">Yr 3+ impact</span>;
}

function ConfidenceDot({ confidence }: { confidence: DraftBoardTarget['confidence'] }) {
  const colorCls =
    confidence === 'high' ? 'bg-green-500' :
    confidence === 'medium' ? 'bg-yellow-500' :
    'bg-red-500';
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${colorCls} flex-shrink-0`}
      title={`Confidence: ${confidence}`}
    />
  );
}

function CompPills({ comps, isArchetype }: { comps: CompPlayer[]; isArchetype?: boolean }) {
  if (isArchetype || comps.length === 0) return null;
  const shown = comps.slice(0, 3);
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1">
      <span className="text-xs text-zinc-600">Comps:</span>
      {shown.map((c, i) => {
        const pts = c.year2PPR ?? c.year1PPR;
        const label = pts != null
          ? `${c.name} (${c.year2PPR != null ? 'Y2' : 'Y1'}: ${pts.toFixed(1)}pts)`
          : c.name;
        return (
          <span
            key={i}
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700"
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

function AvailabilityBadge({
  prospectRank,
  userPickSlots,
  numTeams,
}: {
  prospectRank: number;
  userPickSlots: number[];
  numTeams: number;
}) {
  if (userPickSlots.length === 0) return null;

  // Compute availability at each user pick, show only the best (earliest with meaningful chance)
  const pickAvailabilities = userPickSlots.map((slot) => {
    const classRank = slotToClassRank(slot, numTeams);
    const pAvail = computeAvailability(prospectRank, classRank);
    return { slot, classRank, pAvail, label: formatPickLabel(slot, numTeams) };
  });

  // Find the earliest pick where availability is >= 5%
  const best = pickAvailabilities.find((p) => p.pAvail >= 0.05);
  if (!best) return null;

  // Round to nearest 5% for less false precision
  const pct = Math.round(best.pAvail * 20) * 5;
  if (pct === 0) return null;

  const colorCls =
    pct >= 65 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
    pct >= 30 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
    'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border tabular-nums ${colorCls}`}
      title={`~${pct}% chance this prospect is still available at pick ${best.label}`}
    >
      ~{pct}% at {best.label}
    </span>
  );
}

function DraftCapitalCard({
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

  return (
    <div className="bg-card-bg border border-card-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <ArrowRightLeft size={14} className="text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">2026 Draft Capital</span>
      </div>

      {/* Owned picks */}
      {sortedOwned.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-2">
          {sortedOwned.map((p, i) => {
            const slotLabel = p.slot
              ? formatPickLabel(p.slot, numTeams)
              : null;
            const borderCls = p.isOwn
              ? 'border-blue-500/20 bg-blue-500/5'
              : 'border-emerald-500/20 bg-emerald-500/5';
            return (
              <div
                key={`own-${i}`}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${borderCls}`}
              >
                <span className="text-xs font-semibold text-foreground">
                  {ROUND_LABELS[p.round] ?? `${p.round}th`}
                </span>
                {slotLabel && (
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    ({slotLabel})
                  </span>
                )}
                {p.isOwn ? (
                  <span className="text-[10px] text-zinc-500">own</span>
                ) : (
                  <span className="text-[10px] text-emerald-400">
                    via {p.fromTeam}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic mb-2">
          No 2026 picks — all draft capital has been traded away.
        </p>
      )}

      {/* Traded away picks */}
      {sortedTraded.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sortedTraded.map((p, i) => {
            const slotLabel = p.slot
              ? formatPickLabel(p.slot, numTeams)
              : null;
            return (
              <div
                key={`away-${i}`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-500/15 bg-red-500/5 opacity-60"
              >
                <span className="text-xs font-medium text-muted-foreground line-through">
                  {ROUND_LABELS[p.round] ?? `${p.round}th`}
                </span>
                {slotLabel && (
                  <span className="text-[10px] text-muted-foreground tabular-nums line-through">
                    ({slotLabel})
                  </span>
                )}
                <span className="text-[10px] text-red-400">
                  to {p.toTeam}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
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

  // Build rosterId → team name map for pick provenance
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

  // Build the request body for the draft-board API
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
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Fetch upcoming 2026 dynasty draft to determine the user's pick slots
  const { data: drafts } = useQuery({
    queryKey: ['league-drafts', leagueId],
    queryFn: () => sleeperApi.getDrafts(leagueId),
    enabled: !!leagueId,
    staleTime: 60 * 60 * 1000,
  });

  // Find an upcoming / pre-draft rookie draft for 2026
  const upcomingDraft = useMemo(() => {
    if (!drafts) return null;
    return drafts.find(
      (d) => d.season === '2026' && (d.status === 'pre_draft' || d.status === 'paused'),
    ) ?? null;
  }, [drafts]);

  // Determine which pick slot(s) the user's roster has in this draft
  const userPickSlots = useMemo(() => {
    if (!upcomingDraft?.slot_to_roster_id || !effectiveManager) return [];
    const slots: number[] = [];
    for (const [slot, rosterId] of Object.entries(upcomingDraft.slot_to_roster_id)) {
      if (rosterId === effectiveManager.rosterId) {
        slots.push(Number(slot));
      }
    }
    return slots.sort((a, b) => a - b);
  }, [upcomingDraft, effectiveManager]);

  const numTeams = upcomingDraft?.settings.teams ?? 12;

  // Build draft capital: owned picks + traded-away picks for 2026
  const { ownedPicks, tradedAwayPicks } = useMemo(() => {
    const owned: DraftCapitalPick[] = [];
    const tradedAway: TradedAwayPick[] = [];
    const myRosterId = effectiveManager?.rosterId;
    if (!myRosterId) return { ownedPicks: owned, tradedAwayPicks: tradedAway };

    // Picks this user owns for 2026 (from franchise outlook data)
    const futurePicks = userOutlook?.futurePicks ?? [];
    for (const pick of futurePicks) {
      if (pick.season !== '2026') continue;
      owned.push({
        round: pick.round,
        slot: pick.slot,
        isOwn: pick.roster_id === myRosterId,
        fromTeam: pick.roster_id !== myRosterId
          ? rosterIdToName.get(pick.roster_id) ?? `Team ${pick.roster_id}`
          : undefined,
      });
    }

    // Picks traded away: scan all rosters' picks for ones originally from myRosterId
    const picksByRosterId = outlookData?.rawContext?.picksByRosterId;
    if (picksByRosterId) {
      for (const [ownerId, picks] of picksByRosterId) {
        if (ownerId === myRosterId) continue;
        for (const pick of picks) {
          if (pick.season !== '2026') continue;
          if (pick.roster_id === myRosterId) {
            tradedAway.push({
              round: pick.round,
              slot: pick.slot,
              toTeam: rosterIdToName.get(ownerId) ?? `Team ${ownerId}`,
            });
          }
        }
      }
    }

    return { ownedPicks: owned, tradedAwayPicks: tradedAway };
  }, [effectiveManager, userOutlook, outlookData?.rawContext?.picksByRosterId, rosterIdToName]);

  const [page, setPage] = useState(0);
  const [positionFilter, setPositionFilter] = useState<string>('All');
  const [rookieSheetOpen, setRookieSheetOpen] = useState(false);

  // Which class ranks are within reach of the user's pick slot(s)?
  // Must be before any early returns to satisfy Rules of Hooks.
  const reachableRanks = useMemo(() => {
    if (userPickSlots.length === 0) return new Set<number>();
    const set = new Set<number>();
    for (const slot of userPickSlots) {
      const classRank = slotToClassRank(slot, numTeams);
      for (let r = classRank - 2; r <= classRank + 3; r++) {
        if (r >= 1) set.add(r);
      }
    }
    return set;
  }, [userPickSlots, numTeams]);

  const anyLoading = isLoading || draftBoardLoading;

  const allTargets = draftBoardData?.targets ?? [];
  const isPreDraft = draftBoardData?.isPreDraft ?? false;

  // Position filter: counts and available positions
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
    <div className="space-y-4">
      {/* Manager selector */}
      {managers.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground flex-shrink-0">Viewing:</span>
          <select
            value={effectiveUserId}
            onChange={(e) => { setSelectedUserId(e.target.value); setPage(0); }}
            className="bg-card-bg border border-card-border rounded-lg px-3 py-2 text-sm text-foreground"
          >
            {managers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Position filter pills */}
      {availablePositions.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {availablePositions.map(pos => (
            <button
              key={pos}
              onClick={() => { setPositionFilter(pos); setPage(0); }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
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

      {/* Pre-draft disclaimer */}
      {isPreDraft && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <span className="text-amber-400 text-xs leading-relaxed">
            <span className="font-semibold">Pre-draft rankings</span> — values are consensus estimates. Will auto-update with real pick data after the NFL Draft (April 24).
          </span>
        </div>
      )}

      {/* Draft Capital Card */}
      {(ownedPicks.length > 0 || tradedAwayPicks.length > 0) && (
        <DraftCapitalCard
          owned={ownedPicks}
          tradedAway={tradedAwayPicks}
          numTeams={numTeams}
        />
      )}

      {/* Error state */}
      {draftBoardError && !anyLoading && (
        <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
          <div className="text-sm font-medium text-zinc-300">Could not load draft board</div>
          <div className="text-xs text-muted-foreground mt-1">
            Please try again later.
          </div>
        </div>
      )}

      {/* Targets list */}
      {!draftBoardError && allTargets.length > 0 && targets.length === 0 && (
        <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
          <div className="text-sm font-medium text-zinc-300">No {positionFilter} prospects in the current class</div>
          <div className="text-xs text-muted-foreground mt-1">
            Try selecting a different position or view all prospects.
          </div>
        </div>
      )}

      {!draftBoardError && targets.length > 0 ? (
        <div className="bg-card-bg border border-card-border rounded-2xl p-5">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <div className="text-sm font-semibold text-foreground">Your Draft Board</div>
            <button
              onClick={() => setRookieSheetOpen(true)}
              className="text-xs text-muted-foreground hover:text-white transition-colors flex-shrink-0"
            >
              How rankings work →
            </button>
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            Dynasty value is the primary driver — need and timeline provide a modest fit adjustment
          </div>
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-card-border/50">
            <span className="text-[11px] text-zinc-600">Score = dynasty value + roster fit</span>
            <span className="text-[11px] text-zinc-600">· Impact = when they contribute</span>
            <span className="text-[11px] text-zinc-600">· Comps = historical players at same position rank</span>
          </div>

          <div className="space-y-4">
            {pageTargets.map((t, i) => {
              const globalIdx = page * PAGE_SIZE + i;
              const isHighlighted = reachableRanks.has(t.overallRank);
              return (
                <div
                  key={globalIdx}
                  className={`flex items-start gap-2.5 ${isHighlighted ? 'bg-blue-500/5 -mx-2 px-2 py-1 rounded-lg' : ''}`}
                >
                  {/* Rank number */}
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${isHighlighted ? 'bg-blue-500/30' : 'bg-card-border'}`}>
                    <span className="text-[10px] font-semibold text-muted-foreground">{globalIdx + 1}</span>
                  </div>

                  {/* Position badge */}
                  <PosBadge pos={t.position} />

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    {/* Row 1: name + badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-foreground truncate">
                        {t.isArchetype ? `~${t.name}` : t.name}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                        <NeedLabelBadge label={t.needLabel} />
                        <TargetScoreBadge score={t.targetScore} />
                      </div>
                    </div>

                    {/* Row 2: rank info + timeline + surplus */}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-zinc-500">
                        #{t.overallRank} in class · #{t.positionRank} {t.position}
                      </span>
                      <span className="text-zinc-600 text-xs">·</span>
                      <TimelineBadge badge={t.timelineBadge} />
                      {t.surplusFlag && (
                        <span className="text-xs text-green-400 font-medium">↑ Value</span>
                      )}
                    </div>

                    {/* Row 3: probability + confidence + availability */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-zinc-400">
                        <span className="font-semibold">{Math.round(t.pStarter)}%</span>
                        <span className="text-zinc-600 ml-0.5">starter</span>
                      </span>
                      <span className="text-zinc-600 text-xs">·</span>
                      <span className="text-xs text-zinc-400">
                        <span className="font-semibold">{Math.round(t.pElite)}%</span>
                        <span className="text-zinc-600 ml-0.5">elite</span>
                      </span>
                      <ConfidenceDot confidence={t.confidence} />
                      {userPickSlots.length > 0 && (
                        <>
                          <span className="text-zinc-600 text-xs">·</span>
                          <AvailabilityBadge
                            prospectRank={t.overallRank}
                            userPickSlots={userPickSlots}
                            numTeams={numTeams}
                          />
                        </>
                      )}
                    </div>

                    {/* Reason text */}
                    {t.reason && (
                      <div className="text-xs text-zinc-500 mt-0.5 leading-snug">{t.reason}</div>
                    )}

                    {/* Impact summary */}
                    {t.impactSummary && (
                      <div className="text-xs text-zinc-500 mt-0.5 leading-snug">{t.impactSummary}</div>
                    )}

                    {/* Comp pills */}
                    <CompPills comps={t.comps} isArchetype={t.isArchetype} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-card-border/50">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <span className="text-xs text-zinc-500">
                {page + 1} / {totalPages} · {targets.length}{positionFilter !== 'All' ? ` ${positionFilter}` : ''} prospect{targets.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          )}
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
