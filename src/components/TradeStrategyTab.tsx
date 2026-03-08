'use client';

import { Loader2, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { useFranchiseOutlook } from '@/hooks/useFranchiseOutlook';
import { useRosters, useLeagueUsers } from '@/hooks/useLeagueData';
import { useSessionUser } from '@/hooks/useSessionUser';
import { useState, useMemo } from 'react';
import type { TradeTargetPlayer, TradeTargetPick } from '@/types/sleeper';
import { PosBadge, StatusBadge } from '@/components/ui/badges';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [expandedTarget, setExpandedTarget] = useState<number | null>(0);
  const [expandedPick, setExpandedPick] = useState<number | null>(null);
  const [expandedPartner, setExpandedPartner] = useState<number | null>(null);
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
        <div className="flex items-center gap-1.5 shrink-0">
          <Users size={14} className="text-muted-foreground" />
          <Select value={effectiveUserId} onValueChange={(v) => setSelectedUserId(v)}>
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

      {!result ? (
        <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
          <div className="text-sm font-medium text-foreground">Trade strategy unavailable</div>
          <div className="text-xs text-muted-foreground mt-1">No roster or player data found for this manager.</div>
        </div>
      ) : (
        <>
          {(tradeTargets.players.length > 0 || tradeTargets.picks.length > 0) && (
            <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
              <div className="px-3 sm:px-4 pt-3 pb-2">
                <div className="text-sm font-semibold text-foreground">Trade Targets</div>
                <div className="text-xs text-muted-foreground mt-0.5">Players on other rosters that address your position weaknesses</div>
              </div>

              {tradeTargets.players.length > 0 && (
                <div className="divide-y divide-card-border/40">
                  {tradeTargets.players.map((t, i) => {
                    const topBadge =
                      t.htcSignal === 'motivated-seller' ? 'motivated-seller' as const :
                      t.urgencyFlag === 'buy-low' ? 'buy-low' as const :
                      t.urgencyFlag === 'closing-window' ? 'closing-window' as const :
                      t.timelineMatch === 'ideal' ? 'ideal-fit' as const :
                      t.timelineMatch === 'good' ? 'good-fit' as const :
                      t.htcSignal === 'reluctant-seller' ? 'reluctant-seller' as const :
                      null;
                    const isExpanded = expandedTarget === i;
                    return (
                      <div key={i}>
                        <button
                          onClick={() => setExpandedTarget(isExpanded ? null : i)}
                          className="w-full flex items-center gap-2 px-3 sm:px-4 py-2.5 hover:bg-muted/10 transition-colors text-left"
                        >
                          <PosBadge pos={t.position} />
                          <span className="text-sm text-foreground truncate flex-1 min-w-0">{t.name}</span>
                          {t.age > 0 && <span className="text-xs text-muted-foreground">age {t.age}</span>}
                          {topBadge && <StatusBadge variant={topBadge} />}
                          {t.dynastyValue != null && (
                            <span className="text-xs font-medium text-yellow-400 tabular-nums">
                              {t.dynastyValue.toLocaleString()}
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="px-3 sm:px-4 pb-3 space-y-1.5">
                            <div className="text-xs text-muted-foreground/80 leading-snug pl-7">
                              {t.reason}
                              {t.ownerDisplayName && (
                                <> &bull; <span className="text-muted-foreground">{t.ownerDisplayName}</span></>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap pl-7">
                              {t.htcSignal === 'motivated-seller' && t.htcTradeType && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-900/40 text-green-400">
                                  {t.htcTradeType === 'sell-high' ? '📈 Sell-High Candidate' : '📉 Sell Before Decline'}
                                </span>
                              )}
                              {t.htcSignal !== 'motivated-seller' && t.urgencyFlag && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                  t.urgencyFlag === 'buy-low'
                                    ? 'bg-amber-900/40 text-amber-400'
                                    : 'bg-orange-800/60 text-orange-200'
                                }`}>
                                  {t.urgencyFlag === 'buy-low' ? '⬇ Buy Low' : '⏱ Act Soon'}
                                </span>
                              )}
                              {t.sellerContext && (
                                <span className="text-[11px] text-muted-foreground">
                                  {t.sellerContext}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {tradeTargets.picks.length > 0 && (
                <>
                  <div className="px-3 sm:px-4 pt-3 pb-2 border-t border-card-border/40">
                    <div className="text-xs text-muted-foreground font-medium">Draft Capital to Target</div>
                  </div>
                  <div className="divide-y divide-card-border/40">
                    {tradeTargets.picks.map((p, i) => {
                      const isExpanded = expandedPick === i;
                      return (
                        <div key={i}>
                          <button
                            onClick={() => setExpandedPick(isExpanded ? null : i)}
                            className="w-full flex items-center gap-2 px-3 sm:px-4 py-2.5 hover:bg-muted/10 transition-colors text-left"
                          >
                            <PosBadge pos="PICK" />
                            <span className="text-sm text-foreground flex-1 min-w-0">{p.season} Rd {p.round}</span>
                            <span className="text-xs text-muted-foreground">{p.projectedSlotLabel}</span>
                            {p.estimatedValue > 0 && (
                              <span className="text-xs font-medium text-yellow-400 tabular-nums">
                                ~{p.estimatedValue.toLocaleString()}
                              </span>
                            )}
                            {isExpanded ? (
                              <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                            )}
                          </button>
                          {isExpanded && (
                            <div className="px-3 sm:px-4 pb-3 space-y-1.5">
                              <div className="text-xs text-muted-foreground/80 leading-snug pl-7">
                                {p.reason} &bull; owned by{' '}
                                <span className="text-muted-foreground">{p.ownerDisplayName}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {result.tradePartners.length > 0 && (
            <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
              <div className="px-3 sm:px-4 pt-3 pb-2">
                <div className="text-sm font-semibold text-foreground">Best Trade Partners</div>
                <div className="text-xs text-muted-foreground mt-0.5">Managers whose strengths match your weaknesses — and vice versa</div>
              </div>
              <div className="divide-y divide-card-border/40">
                {result.tradePartners.map((p, i) => {
                  const windowAlignment = p.windowAlignment ?? 'neutral';
                  const valueBalance = p.valueBalance ?? 'fair';
                  const myBenefit = p.myBenefit ?? '';
                  const theirBenefit = p.theirBenefit ?? '';

                  const windowColor: Record<string, string> = {
                    ideal: 'text-emerald-400',
                    complementary: 'text-blue-400',
                    neutral: 'text-muted-foreground',
                    poor: 'text-orange-400',
                  };
                  const windowLabel: Record<string, string> = {
                    ideal: 'Ideal window',
                    complementary: 'Complementary',
                    neutral: 'Similar windows',
                    poor: 'Competing',
                  };

                  const isExpanded = expandedPartner === i;

                  return (
                    <div key={p.userId}>
                      <button
                        onClick={() => setExpandedPartner(isExpanded ? null : i)}
                        className="w-full flex items-center gap-2 px-3 sm:px-4 py-2.5 hover:bg-muted/10 transition-colors text-left"
                      >
                        <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">{p.displayName}</span>
                        <span className={`text-xs ${windowColor[windowAlignment] ?? windowColor.neutral}`}>
                          {windowLabel[windowAlignment] ?? 'Similar windows'}
                        </span>
                        <span className="text-muted-foreground">&middot;</span>
                        <span className={`text-xs ${valueBalance === 'fair' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                          {valueBalance === 'fair' ? 'Fair value' : 'Slight gap'}
                        </span>
                        <span className="text-xs font-bold text-foreground tabular-nums shrink-0">
                          {p.compatibilityScore}/100
                        </span>
                        {isExpanded ? (
                          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="px-3 sm:px-4 pb-3 space-y-2 pl-5">
                          {(myBenefit || theirBenefit) && (
                            <div className="space-y-0.5">
                              {myBenefit && (
                                <div className="text-xs line-clamp-1">
                                  <span className="text-muted-foreground">You: </span>
                                  <span className="text-foreground">{myBenefit}</span>
                                </div>
                              )}
                              {theirBenefit && (
                                <div className="text-xs line-clamp-1">
                                  <span className="text-muted-foreground">Them: </span>
                                  <span className="text-muted-foreground">{theirBenefit}</span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex gap-6 text-xs">
                            {p.theyCanOffer.length > 0 && (
                              <div>
                                <div className="text-muted-foreground mb-1.5">They offer →</div>
                                <div className="space-y-1.5">
                                  {[...p.theyCanOffer].sort((a, b) => b.delta - a.delta).map((o, oi) => (
                                    <div key={`${o.position}-${oi}`} className="flex items-start gap-1.5">
                                      <PosBadge pos={o.position} />
                                      <div>
                                        {o.topPlayer && (
                                          <div className="flex items-baseline gap-1.5 flex-wrap">
                                            <span className="text-foreground font-medium">{o.topPlayer}</span>
                                            {o.topPlayerValue != null && o.topPlayerValue > 0 && (
                                              <span className="text-yellow-400 tabular-nums">{Math.round(o.topPlayerValue).toLocaleString()}</span>
                                            )}
                                            {o.motivatedSeller && (
                                              <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-700/40">
                                                motivated
                                              </span>
                                            )}
                                          </div>
                                        )}
                                        {!(o.rank === 0 && o.delta === 0) && (
                                          <span className="text-muted-foreground">#{o.rank} · +{o.delta.toFixed(1)} WAR</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {p.youCanOffer.length > 0 && (
                              <div>
                                <div className="text-muted-foreground mb-1.5">You offer →</div>
                                <div className="space-y-1.5">
                                  {[...p.youCanOffer].sort((a, b) => b.delta - a.delta).map((o, oi) => (
                                    <div key={`${o.position}-${oi}`} className="flex items-start gap-1.5">
                                      <PosBadge pos={o.position} />
                                      <div>
                                        {o.topPlayer && (
                                          <div className="flex items-baseline gap-1.5">
                                            <span className="text-foreground font-medium">{o.topPlayer}</span>
                                            {o.topPlayerValue != null && o.topPlayerValue > 0 && (
                                              <span className="text-yellow-400 tabular-nums">{Math.round(o.topPlayerValue).toLocaleString()}</span>
                                            )}
                                          </div>
                                        )}
                                        {!(o.rank === 0 && o.delta === 0) && (
                                          <span className="text-muted-foreground">#{o.rank} · +{o.delta.toFixed(1)} WAR</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tradeTargets.players.length === 0 && tradeTargets.picks.length === 0 && result.tradePartners.length === 0 && (
            <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
              <div className="text-sm font-medium text-foreground">No trade strategy data available</div>
              <div className="text-xs text-muted-foreground mt-1">
                Trade targets and partner recommendations require FantasyCalc dynasty values to be loaded.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
