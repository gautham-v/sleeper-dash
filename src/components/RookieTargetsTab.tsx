'use client';

import { Loader2 } from 'lucide-react';
import { useFranchiseOutlook } from '@/hooks/useFranchiseOutlook';
import { useRosters, useLeagueUsers } from '@/hooks/useLeagueData';
import { useSessionUser } from '@/hooks/useSessionUser';
import { useState, useMemo } from 'react';
import { PosBadge } from '@/components/ui/badges';

interface RookieTargetsTabProps {
  leagueId: string;
}

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

  const rookieDraftTargets = outlookData?.outlookMap.get(effectiveUserId)?.rookieDraftTargets ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-60 text-brand-cyan">
        <Loader2 className="animate-spin mr-2" size={22} />
        <span className="text-sm">Loading rookie targets…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {managers.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 flex-shrink-0">Viewing:</span>
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

      {rookieDraftTargets.length > 0 ? (
        <div className="bg-card-bg border border-card-border rounded-2xl p-5">
          <div className="text-sm font-semibold text-white mb-1">Rookie Draft Targets</div>
          <div className="text-xs text-gray-500 mb-4">
            Top incoming prospects at your weakest positions, ranked by dynasty value
          </div>
          <div className="space-y-2.5">
            {rookieDraftTargets.map((t, i) => (
              <div key={i} className="flex items-start gap-2">
                <PosBadge pos={t.position} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-200 truncate flex-1">{t.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">#{t.positionRank} {t.position}</span>
                    <span className="text-xs font-medium text-yellow-400 tabular-nums shrink-0">
                      {t.dynastyValue.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{t.reason}</div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-brand-cyan/80">
                      ~{t.estimatedPeakWAR.toFixed(1)} est. peak WAR
                    </span>
                    <span className="text-xs text-gray-600">·</span>
                    <span className="text-xs text-gray-400">{t.impactSummary}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
          <div className="text-sm font-medium text-gray-300">No rookie targets available</div>
          <div className="text-xs text-gray-500 mt-1">
            Rookie targets are generated based on your roster weaknesses and FantasyCalc dynasty values.
          </div>
        </div>
      )}
    </div>
  );
}
