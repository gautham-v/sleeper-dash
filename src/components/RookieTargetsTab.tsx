'use client';

import { Loader2, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useFranchiseOutlook } from '@/hooks/useFranchiseOutlook';
import { useRosters, useLeagueUsers } from '@/hooks/useLeagueData';
import { useSessionUser } from '@/hooks/useSessionUser';
import { useState, useMemo } from 'react';
import { PosBadge } from '@/components/ui/badges';
import type { DraftBoardRequest, DraftBoardTarget } from '@/types/sleeper';
import type { CompPlayer } from '@/types/prospects';

interface RookieTargetsTabProps {
  leagueId: string;
}

interface DraftBoardResponse {
  targets: DraftBoardTarget[];
  isPreDraft: boolean;
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
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-zinc-700 text-zinc-400">
      Value
    </span>
  );
}

function TargetScoreBadge({ score }: { score: number }) {
  const rounded = score.toFixed(0);
  const colorCls =
    score >= 70 ? 'text-green-400' :
    score >= 45 ? 'text-yellow-400' :
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
          displayName: user?.metadata?.team_name || user?.display_name || `Team ${r.roster_id}`,
        };
      })
      .filter((m) => !!m.userId);
  }, [rosters, leagueUsers]);

  const sessionUser = useSessionUser();
  const [selectedUserId, setSelectedUserId] = useState('');
  const defaultUserId = managers.find((m) => m.userId === sessionUser?.userId)?.userId ?? managers[0]?.userId ?? '';
  const effectiveUserId = selectedUserId || defaultUserId;

  const userOutlook = outlookData?.outlookMap.get(effectiveUserId);

  // Build the request body for the draft-board API
  // Always defined when effectiveUserId is available; falls back gracefully when outlook is missing
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

  const anyLoading = isLoading || draftBoardLoading;

  if (anyLoading) {
    return (
      <div className="flex items-center justify-center h-60 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={22} />
        <span className="text-sm">Loading rookie targets…</span>
      </div>
    );
  }

  const targets = draftBoardData?.targets ?? [];
  const isPreDraft = draftBoardData?.isPreDraft ?? false;

  return (
    <div className="space-y-4">
      {/* Manager selector */}
      {managers.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground flex-shrink-0">Viewing:</span>
          <select
            value={effectiveUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="bg-card-bg border border-card-border rounded-lg px-3 py-2 text-sm text-white"
          >
            {managers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.displayName}
              </option>
            ))}
          </select>
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
      {!draftBoardError && targets.length > 0 ? (
        <div className="bg-card-bg border border-card-border rounded-2xl p-5">
          <div className="text-sm font-semibold text-white mb-1">Rookie Draft Targets</div>
          <div className="text-xs text-muted-foreground mb-3">
            Ranked by fit for your roster — balances dynasty value, positional need, and timeline
          </div>
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-card-border/50">
            <span className="text-[11px] text-zinc-600">Score = need + value fit</span>
            <span className="text-[11px] text-zinc-600">· Impact = when they contribute</span>
            <span className="text-[11px] text-zinc-600">· Comps = similar historical rookies</span>
          </div>
          <div className="space-y-4">
            {targets.map((t, i) => (
              <div key={i} className="flex items-start gap-2.5">
                {/* Rank number */}
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-card-border flex items-center justify-center mt-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground">{i + 1}</span>
                </div>

                {/* Position badge */}
                <PosBadge pos={t.position} />

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  {/* Row 1: name + badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-200 truncate">
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
                      #{t.overallRank} ovr · #{t.positionRank} {t.position}
                    </span>
                    <span className="text-zinc-700 text-xs">·</span>
                    <TimelineBadge badge={t.timelineBadge} />
                    {t.surplusFlag && (
                      <span className="text-xs text-green-400 font-medium">↑ Value</span>
                    )}
                  </div>

                  {/* Row 3: probability + confidence */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-zinc-400">
                      <span className="font-semibold">{Math.round(t.pStarter)}%</span>
                      <span className="text-zinc-600 ml-0.5">starter</span>
                    </span>
                    <span className="text-zinc-700 text-xs">·</span>
                    <span className="text-xs text-zinc-400">
                      <span className="font-semibold">{Math.round(t.pElite)}%</span>
                      <span className="text-zinc-600 ml-0.5">elite</span>
                    </span>
                    <ConfidenceDot confidence={t.confidence} />
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
            ))}
          </div>
        </div>
      ) : (
        !draftBoardError && !anyLoading && (
          <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
            <div className="text-sm font-medium text-zinc-300">No rookie targets available</div>
            <div className="text-xs text-muted-foreground mt-1">
              Rookie targets are generated based on your roster weaknesses and FantasyCalc dynasty values.
            </div>
          </div>
        )
      )}
    </div>
  );
}
