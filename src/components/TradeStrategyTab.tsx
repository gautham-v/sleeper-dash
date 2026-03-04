'use client';

import { Loader2 } from 'lucide-react';
import { useFranchiseOutlook } from '@/hooks/useFranchiseOutlook';
import { useRosters, useLeagueUsers } from '@/hooks/useLeagueData';
import { useSessionUser } from '@/hooks/useSessionUser';
import { useState, useMemo } from 'react';

const POSITION_COLORS: Record<string, string> = {
  QB: 'bg-red-900/50 text-red-300 border-red-800/50',
  RB: 'bg-green-900/50 text-green-300 border-green-800/50',
  WR: 'bg-blue-900/50 text-blue-300 border-blue-800/50',
  TE: 'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
  PICK: 'bg-purple-900/50 text-purple-300 border-purple-800/50',
};

function PosBadge({ pos }: { pos: string }) {
  const cls = POSITION_COLORS[pos] ?? 'bg-gray-800/50 text-gray-400 border-gray-700/50';
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold border ${cls} w-8 text-center shrink-0`}>
      {pos}
    </span>
  );
}

interface TradeStrategyTabProps {
  leagueId: string;
}

export function TradeStrategyTab({ leagueId }: TradeStrategyTabProps) {
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
  // Default to signed-in user if they're in this league, else first manager
  const defaultUserId = managers.find((m) => m.userId === sessionUser?.userId)?.userId ?? managers[0]?.userId ?? '';
  const effectiveUserId = selectedUserId || defaultUserId;

  const outlookMap = outlookData?.outlookMap;
  const result = outlookMap?.get(effectiveUserId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-60 text-brand-cyan">
        <Loader2 className="animate-spin mr-2" size={22} />
        <span className="text-sm">Computing trade strategy…</span>
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

      {!result ? (
        <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
          <div className="text-sm font-medium text-gray-300">Trade strategy unavailable</div>
          <div className="text-xs text-gray-500 mt-1">No roster or player data found for this manager.</div>
        </div>
      ) : (
        <>
          {result.tradeTargets.length > 0 && (
            <div className="bg-card-bg border border-card-border rounded-2xl p-5">
              <div className="text-sm font-semibold text-white mb-1">Trade Targets</div>
              <div className="text-xs text-gray-500 mb-4">
                Players on other rosters that address your position weaknesses
              </div>
              <div className="space-y-3">
                {result.tradeTargets.map((t, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <PosBadge pos={t.position} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-gray-200 truncate">{t.name}</span>
                        {t.age > 0 && <span className="text-xs text-gray-500">age {t.age}</span>}
                        {t.dynastyValue != null && (
                          <span className="text-xs font-medium text-yellow-400 tabular-nums ml-auto">
                            {t.dynastyValue.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {t.reason} &bull; owned by{' '}
                        <span className="text-gray-400">{t.ownerDisplayName}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.tradePartners.length > 0 && (
            <div className="bg-card-bg border border-card-border rounded-2xl p-5">
              <div className="text-sm font-semibold text-white mb-1">Best Trade Partners</div>
              <div className="text-xs text-gray-500 mb-4">
                Managers whose strengths match your weaknesses — and vice versa
              </div>
              <div className="space-y-3">
                {result.tradePartners.map((p) => (
                  <div key={p.userId} className="border border-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-200">{p.displayName}</span>
                      <span className="text-xs font-bold text-brand-cyan tabular-nums">
                        {p.compatibilityScore}/100 match
                      </span>
                    </div>
                    <div className="flex gap-6 text-xs">
                      {p.theyCanOffer.length > 0 && (
                        <div>
                          <div className="text-gray-600 mb-1.5">They offer →</div>
                          <div className="space-y-1.5">
                            {[...p.theyCanOffer].sort((a, b) => b.delta - a.delta).map((o) => (
                              <div key={o.position} className="flex items-start gap-1.5">
                                <PosBadge pos={o.position} />
                                <div>
                                  {o.topPlayer && (
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="text-emerald-300 font-medium">{o.topPlayer}</span>
                                      {o.topPlayerValue != null && o.topPlayerValue > 0 && (
                                        <span className="text-yellow-400 tabular-nums">{Math.round(o.topPlayerValue).toLocaleString()}</span>
                                      )}
                                    </div>
                                  )}
                                  <span className="text-emerald-500">#{o.rank} · +{o.delta.toFixed(1)} WAR</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {p.youCanOffer.length > 0 && (
                        <div>
                          <div className="text-gray-600 mb-1.5">You offer →</div>
                          <div className="space-y-1.5">
                            {[...p.youCanOffer].sort((a, b) => b.delta - a.delta).map((o) => (
                              <div key={o.position} className="flex items-start gap-1.5">
                                <PosBadge pos={o.position} />
                                <div>
                                  {o.topPlayer && (
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="text-brand-cyan font-medium">{o.topPlayer}</span>
                                      {o.topPlayerValue != null && o.topPlayerValue > 0 && (
                                        <span className="text-yellow-400 tabular-nums">{Math.round(o.topPlayerValue).toLocaleString()}</span>
                                      )}
                                    </div>
                                  )}
                                  <span className="text-brand-cyan/60">#{o.rank} · +{o.delta.toFixed(1)} WAR</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.tradeTargets.length === 0 && result.tradePartners.length === 0 && (
            <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
              <div className="text-sm font-medium text-gray-300">No trade strategy data available</div>
              <div className="text-xs text-gray-500 mt-1">
                Trade targets and partner recommendations require FantasyCalc dynasty values to be loaded.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
