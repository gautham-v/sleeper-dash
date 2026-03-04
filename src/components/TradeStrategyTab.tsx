'use client';

import { Loader2 } from 'lucide-react';
import { useFranchiseOutlook } from '@/hooks/useFranchiseOutlook';
import { useRosters, useLeagueUsers } from '@/hooks/useLeagueData';
import { useSessionUser } from '@/hooks/useSessionUser';
import { useState, useMemo } from 'react';
import type { TradeTargetPlayer, TradeTargetPick } from '@/types/sleeper';
import { PosBadge, StatusBadge } from '@/components/ui/badges';

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

  // Normalize tradeTargets to always be {players, picks} regardless of data format
  const tradeTargets = useMemo((): { players: TradeTargetPlayer[]; picks: TradeTargetPick[] } => {
    if (!result?.tradeTargets) return { players: [], picks: [] };
    if (Array.isArray(result.tradeTargets)) {
      return { players: result.tradeTargets as TradeTargetPlayer[], picks: [] };
    }
    return result.tradeTargets as { players: TradeTargetPlayer[]; picks: TradeTargetPick[] };
  }, [result?.tradeTargets]);

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
          {(tradeTargets.players.length > 0 || tradeTargets.picks.length > 0) && (
            <div className="bg-card-bg border border-card-border rounded-2xl p-5">
              <div className="text-sm font-semibold text-white mb-1">Trade Targets</div>
              <div className="text-xs text-gray-500 mb-4">
                Players on other rosters that address your position weaknesses
              </div>

              {tradeTargets.players.length > 0 && (
                <div className="space-y-3">
                  {tradeTargets.players.map((t, i) => {
                    const urgencyVariant =
                      t.urgencyFlag === 'buy-low' ? 'buy-low' as const
                      : t.urgencyFlag === 'closing-window' ? 'closing-window' as const
                      : null;
                    const timelineVariant = !urgencyVariant
                      ? t.timelineMatch === 'ideal' ? 'ideal-fit' as const
                        : t.timelineMatch === 'good' ? 'good-fit' as const
                        : null
                      : null;
                    const badgeVariant = urgencyVariant ?? timelineVariant;
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <PosBadge pos={t.position} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm text-gray-200 truncate">{t.name}</span>
                            {t.age > 0 && <span className="text-xs text-gray-500">age {t.age}</span>}
                            {badgeVariant && <StatusBadge variant={badgeVariant} />}
                            {t.dynastyValue != null && (
                              <span className="text-xs font-medium text-yellow-400 tabular-nums ml-auto">
                                {t.dynastyValue.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-2 sm:line-clamp-1">
                            {t.reason}
                            {t.ownerDisplayName && (
                              <> &bull; <span className="text-gray-400">{t.ownerDisplayName}</span></>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {tradeTargets.picks.length > 0 && (
                <>
                  <div className="text-xs text-gray-500 font-medium mt-4 mb-2">Draft Capital to Target</div>
                  <div className="space-y-3">
                    {tradeTargets.picks.map((p, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <PosBadge pos="PICK" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm text-gray-200">{p.season} Rd {p.round}</span>
                            <span className="text-xs text-gray-400">{p.projectedSlotLabel}</span>
                            {p.estimatedValue > 0 && (
                              <span className="text-xs font-medium text-yellow-400 tabular-nums ml-auto">
                                ~{p.estimatedValue.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {p.reason} &bull; owned by{' '}
                            <span className="text-gray-400">{p.ownerDisplayName}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {result.tradePartners.length > 0 && (
            <div className="bg-card-bg border border-card-border rounded-2xl p-5">
              <div className="text-sm font-semibold text-white mb-1">Best Trade Partners</div>
              <div className="text-xs text-gray-500 mb-4">
                Managers whose strengths match your weaknesses — and vice versa
              </div>
              <div className="space-y-3">
                {result.tradePartners.map((p) => {
                  const windowAlignment = p.windowAlignment ?? 'neutral';
                  const valueBalance = p.valueBalance ?? 'fair';
                  const myBenefit = p.myBenefit ?? '';
                  const theirBenefit = p.theirBenefit ?? '';

                  const windowColor: Record<string, string> = {
                    ideal: 'text-emerald-400',
                    complementary: 'text-blue-400',
                    neutral: 'text-gray-500',
                    poor: 'text-orange-400',
                  };
                  const windowLabel: Record<string, string> = {
                    ideal: 'Ideal window',
                    complementary: 'Complementary',
                    neutral: 'Similar windows',
                    poor: 'Competing',
                  };

                  return (
                    <div key={p.userId} className="border border-gray-700/50 rounded-xl p-4">
                      {/* Header: name + score + window + balance in two compact rows */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-200 leading-tight">{p.displayName}</span>
                        <span className="text-xs font-bold text-brand-cyan tabular-nums shrink-0">
                          {p.compatibilityScore}/100
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs mb-2">
                        <span className={windowColor[windowAlignment] ?? windowColor.neutral}>
                          {windowLabel[windowAlignment] ?? 'Similar windows'}
                        </span>
                        <span className="text-gray-700">&middot;</span>
                        <span className={valueBalance === 'fair' ? 'text-emerald-400' : 'text-yellow-400'}>
                          {valueBalance === 'fair' ? 'Fair value' : 'Slight gap'}
                        </span>
                      </div>

                      {/* Why it works — compact 2-line context, no header */}
                      {(myBenefit || theirBenefit) && (
                        <div className="mb-3 space-y-0.5">
                          {myBenefit && (
                            <div className="text-xs line-clamp-1">
                              <span className="text-gray-500">You: </span>
                              <span className="text-gray-300">{myBenefit}</span>
                            </div>
                          )}
                          {theirBenefit && (
                            <div className="text-xs line-clamp-1">
                              <span className="text-gray-500">Them: </span>
                              <span className="text-gray-400">{theirBenefit}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Player columns */}
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
                                    {!(o.rank === 0 && o.delta === 0) && (
                                      <span className="text-emerald-500">#{o.rank} · +{o.delta.toFixed(1)} WAR</span>
                                    )}
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
                                    {!(o.rank === 0 && o.delta === 0) && (
                                      <span className="text-brand-cyan/60">#{o.rank} · +{o.delta.toFixed(1)} WAR</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tradeTargets.players.length === 0 && tradeTargets.picks.length === 0 && result.tradePartners.length === 0 && (
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
