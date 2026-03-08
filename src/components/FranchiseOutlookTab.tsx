'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import posthog from 'posthog-js';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type {
  FranchiseOutlookResult,
  FranchiseTier,
  StrategyMode,
  FranchiseOutlookRawContext,
} from '../types/sleeper';
import { MetricTooltip } from '@/components/MetricTooltip';
import { PosBadge, TierBadge } from '@/components/ui/badges';
import { Share2, ChevronDown, HelpCircle } from 'lucide-react';
import { FranchiseCardModal } from '@/components/FranchiseCardModal';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import type { FranchiseShareCardProps } from '@/components/FranchiseShareCard';

interface FranchiseOutlookTabProps {
  userId: string;
  data: Map<string, FranchiseOutlookResult>;
  leagueId?: string;
  rawContext?: FranchiseOutlookRawContext;
}

// ── Color helpers ────────────────────────────────────────────────────────────

function tierTextColor(tier: FranchiseTier): string {
  switch (tier) {
    case 'Contender':  return 'text-emerald-700 dark:text-emerald-400';
    case 'Fringe':     return 'text-yellow-700 dark:text-yellow-400';
    case 'Rebuilding': return 'text-red-700 dark:text-red-400';
  }
}

function tierBorderColor(tier: FranchiseTier): string {
  switch (tier) {
    case 'Contender':  return '#22c55e';
    case 'Fringe':     return '#eab308';
    case 'Rebuilding': return '#ef4444';
  }
}

function strategyModeColor(mode: StrategyMode): string {
  switch (mode) {
    case 'Push All-In Now':    return 'text-red-400';
    case 'Win-Now Pivot':      return 'text-orange-400';
    case 'Steady State':       return 'text-emerald-400';
    case 'Asset Accumulation': return 'text-brand-cyan';
    case 'Full Rebuild':       return 'text-yellow-400';
  }
}

function urgencyBarColor(score: number): string {
  if (score >= 75) return 'bg-red-500';
  if (score >= 50) return 'bg-orange-500';
  if (score >= 25) return 'bg-yellow-500';
  return 'bg-emerald-500';
}

function peakYearLabel(yearOffset: number): string {
  if (yearOffset === 0) return 'This Year';
  return `+${yearOffset} Year${yearOffset > 1 ? 's' : ''}`;
}


// ── Main component ───────────────────────────────────────────────────────────

export function FranchiseOutlookTab({ userId, data, leagueId, rawContext }: FranchiseOutlookTabProps) {
  const [cardModalOpen, setCardModalOpen] = useState(false);

  const outlookTracked = useRef(false);
  const result = data.get(userId);

  useEffect(() => {
    if (result && !outlookTracked.current) {
      outlookTracked.current = true;
      posthog.capture('franchise_outlook_viewed', { league_id: leagueId, manager_id: userId });
    }
  }, [result, leagueId, userId]);

  // Merge keyPlayers + youngAssets into a single top-5 list
  const topAssets = useMemo(() => {
    if (!result) return [];
    const seen = new Set<string>();
    const merged: Array<{ name: string; position: string; age: number | null; dynastyValue: number | null; war: number; isYoung: boolean }> = [];
    for (const p of result.keyPlayers) {
      if (!seen.has(p.name)) {
        seen.add(p.name);
        merged.push({ name: p.name, position: p.position, age: p.age ?? null, dynastyValue: p.dynastyValue ?? null, war: p.war, isYoung: (p.age ?? 99) <= 24 });
      }
    }
    for (const p of result.youngAssets) {
      if (!seen.has(p.name)) {
        seen.add(p.name);
        merged.push({ name: p.name, position: p.position, age: p.age, dynastyValue: p.dynastyValue ?? null, war: p.war, isYoung: true });
      }
    }
    merged.sort((a, b) => (b.dynastyValue ?? 0) - (a.dynastyValue ?? 0) || b.war - a.war);
    return merged.slice(0, 5);
  }, [result]);

  if (!result) {
    return (
      <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
        <div className="text-2xl mb-3">🔭</div>
        <div className="text-sm font-medium text-foreground/80">Franchise outlook unavailable</div>
        <div className="text-xs text-muted-foreground mt-1">No roster or player data found for this manager.</div>
      </div>
    );
  }

  const {
    tier, weightedAge, ageCategory,
    riskScore, riskCategory, currentWAR, projectedWAR,
    contenderThreshold, windowLength, peakYearOffset,
    futurePicks, isSeasonComplete,
    warByPosition, wins, losses, warRank, luckScore, focusAreas,
    strategyRecommendation,
  } = result;

  const totalManagers = data.size;
  const displayName = rawContext?.userDisplayNames?.get(userId) ?? 'My Team';

  const cardProps: FranchiseShareCardProps = {
    displayName,
    totalManagers,
    tier,
    warRank,
    wins,
    losses,
    luckScore,
    windowLength,
    peakYearOffset,
    currentWAR,
    strategyMode: strategyRecommendation.mode,
    strategyHeadline: strategyRecommendation.headline,
    rationale: strategyRecommendation.rationale,
    keyPlayers: result.keyPlayers,
  };

  const currentYear = new Date().getFullYear();
  const chartData = [
    { label: `${currentYear} (Now)`, totalWAR: currentWAR, yearOffset: 0 },
    ...projectedWAR.map((p) => ({ label: `${currentYear + p.yearOffset}`, totalWAR: p.totalWAR })),
  ];
  const allWARValues = chartData.map((d) => d.totalWAR);
  const yMin = Math.floor(Math.min(...allWARValues, contenderThreshold) - 5);
  const yMax = Math.ceil(Math.max(...allWARValues, contenderThreshold) + 5);

  // Future picks grouped by year
  const picksByYear = new Map<string, typeof futurePicks>();
  for (const pick of futurePicks) {
    const arr = picksByYear.get(pick.season) ?? [];
    arr.push(pick);
    picksByYear.set(pick.season, arr);
  }
  const sortedPickYears = [...picksByYear.keys()].sort();

  // Collapsible alert + rationale count
  const alertCount = focusAreas.length + strategyRecommendation.rationale.length;

  // Position strength/weakness summary for collapsed state
  const strengths = warByPosition.filter(p => (p.war - p.leagueAvgWAR) > 0).map(p => p.position);
  const weaknesses = warByPosition.filter(p => (p.war - p.leagueAvgWAR) < 0).map(p => p.position);

  return (
    <div className="space-y-4">

      {/* ── Hero Command Center Card ── */}
      <div
        className="bg-card-bg border border-card-border rounded-2xl p-4 sm:p-5 border-l-4"
        style={{ borderLeftColor: tierBorderColor(tier) }}
      >
        {/* Two-column: Tier & Strategy (left) + Franchise Score (right) */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            {/* Current Tier */}
            <div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Current Tier</div>
              <TierBadge tier={tier} size="md" label={`${tier === 'Contender' ? '🏆' : tier === 'Fringe' ? '⚡' : '🔨'} ${tier}`} />
              <div className={`text-xs mt-1 ${tierTextColor(tier)}`}>
                {tier === 'Contender' && `Contender window: ${windowLength} year${windowLength !== 1 ? 's' : ''}`}
                {tier === 'Fringe' && 'Above league median — on the cusp'}
                {tier === 'Rebuilding' && 'Below league median — focused on future'}
              </div>
            </div>

            {/* Recommended Strategy */}
            <div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Recommended Strategy</div>
              <div className={`text-base sm:text-lg font-bold ${strategyModeColor(strategyRecommendation.mode)}`}>
                {strategyRecommendation.mode}
              </div>
              <div className="text-xs text-foreground/80 mt-0.5 line-clamp-2">{strategyRecommendation.headline}</div>
            </div>
          </div>

          {/* Franchise Score */}
          <div className="text-right shrink-0">
            <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
              Franchise Score
              <MetricTooltip metricKey="franchiseScore" side="left" />
            </div>
            <div className="text-2xl font-bold text-brand-cyan tabular-nums leading-tight">
              {currentWAR > 0 ? currentWAR.toFixed(1) : '—'}
            </div>
            {totalManagers > 0 && (
              <div className="text-xs text-muted-foreground mt-0.5">
                #{warRank} of {totalManagers} &bull; {wins}–{losses}
                {luckScore >= 2 && <span className="ml-1 text-emerald-400">Running hot</span>}
                {luckScore <= -2 && <span className="ml-1 text-red-400">Unlucky record</span>}
              </div>
            )}
            <button
              onClick={() => setCardModalOpen(true)}
              className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground border border-card-border hover:border-muted-foreground rounded-full px-2 py-0.5 transition-colors ml-auto"
            >
              <Share2 size={9} />
              Share
            </button>
          </div>
        </div>

        {/* Urgency bar */}
        <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="text-[10px] text-muted-foreground shrink-0">Action Urgency</div>
            <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${urgencyBarColor(strategyRecommendation.urgencyScore)}`}
                style={{ width: `${strategyRecommendation.urgencyScore}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums shrink-0">
              {strategyRecommendation.urgencyScore}/100
            </div>
          </div>
        </div>

        {/* Key Metrics — inline compact grid */}
        <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-4 gap-y-2">
            <div>
              <div className="text-sm font-bold text-foreground tabular-nums">{weightedAge}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Roster Age</div>
              <div className={`text-[10px] font-medium ${
                ageCategory === 'Young' ? 'text-emerald-400'
                  : ageCategory === 'Prime' ? 'text-brand-cyan' : 'text-orange-400'
              }`}>{ageCategory}</div>
            </div>
            <div>
              <div className="text-sm font-bold text-foreground tabular-nums">
                {windowLength}<span className="text-[10px] font-normal text-muted-foreground"> yr{windowLength !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                Window <MetricTooltip metricKey="contenderWindow" side="bottom" />
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">{peakYearLabel(peakYearOffset)}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Peak Year</div>
            </div>
            <div>
              <div className="text-sm font-bold text-foreground tabular-nums">{riskScore}</div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                Age Risk <MetricTooltip metricKey="rosterAgeRisk" side="bottom" />
              </div>
              <div className={`text-[10px] font-medium ${
                riskCategory === 'Low' ? 'text-emerald-400'
                  : riskCategory === 'Moderate' ? 'text-yellow-400'
                  : riskCategory === 'High' ? 'text-orange-400' : 'text-red-400'
              }`}>{riskCategory}</div>
            </div>
            <div>
              <div className="text-sm font-bold text-foreground tabular-nums">
                {futurePicks.length > 0 ? futurePicks.length : '—'}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Picks</div>
              {futurePicks.length > 0 && (
                <div className="text-[10px] text-muted-foreground truncate">
                  {sortedPickYears.map((year) => {
                    const picks = [...(picksByYear.get(year) ?? [])].sort((a, b) => a.round - b.round);
                    return `${year}: ${picks.map(p => `Rd${p.round}`).join(',')}`;
                  }).join(' · ')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alerts & rationale collapsible */}
        {alertCount > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-3 cursor-pointer">
              View alerts &amp; rationale ({alertCount})
              {focusAreas.some(a => a.severity === 'warning') && <span className="w-2 h-2 rounded-full bg-yellow-400" />}
              {focusAreas.some(a => a.severity === 'positive') && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
              <ChevronDown size={12} className="shrink-0 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 mt-2">
                {/* Focus areas */}
                {focusAreas.map((area, i) => (
                  <div
                    key={`focus-${i}`}
                    className={`rounded-lg px-3 py-2 border ${
                      area.severity === 'warning'
                        ? 'bg-yellow-900/20 border-yellow-700/40'
                        : area.severity === 'positive'
                        ? 'bg-emerald-800/20 border-emerald-800/40'
                        : 'bg-muted/5 border-card-border'
                    }`}
                  >
                    <div className={`text-xs font-medium ${
                      area.severity === 'warning' ? 'text-yellow-400'
                        : area.severity === 'positive' ? 'text-emerald-400'
                        : 'text-foreground/80'
                    }`}>
                      {area.severity === 'warning' ? '⚠ ' : area.severity === 'positive' ? '✓ ' : 'ℹ '}
                      {area.signal}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{area.detail}</div>
                  </div>
                ))}
                {/* Strategy rationale */}
                {strategyRecommendation.rationale.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {strategyRecommendation.rationale.map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-2">
                        <span className="text-brand-cyan shrink-0 mt-0.5">•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* ── Top Assets (compact) ── */}
      {topAssets.length > 0 && (
        <div className="bg-card-bg border border-card-border rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-foreground">Top Assets</div>
            <span className="text-xs text-muted-foreground">View full roster in Players tab</span>
          </div>
          <div className="space-y-2">
            {topAssets.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground/60 w-4 text-right tabular-nums">{i + 1}</span>
                <PosBadge pos={p.position} />
                <span className="text-sm text-foreground/80 flex-1 truncate">{p.name}</span>
                {p.isYoung && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Age ≤24" />}
                {p.age != null && <span className="text-xs text-muted-foreground">age {p.age}</span>}
                {p.dynastyValue != null ? (
                  <span className="text-xs font-medium text-yellow-400 tabular-nums">
                    {p.dynastyValue.toLocaleString()}
                  </span>
                ) : (
                  <span className={`text-xs font-medium tabular-nums ${p.war >= 0 ? 'text-brand-cyan' : 'text-red-400'}`}>
                    {p.war >= 0 ? '+' : ''}{p.war.toFixed(1)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Performance Trend ── */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="group w-full bg-card-bg border border-card-border rounded-2xl p-4 sm:p-5 hover:bg-muted/10 transition-colors text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Performance Trend</span>
            <span className="text-xs text-muted-foreground flex-1 truncate">
              {chartData.length > 1
                ? `Projected ${chartData[chartData.length - 1].totalWAR.toFixed(1)} WAR by ${chartData[chartData.length - 1].label}${
                    chartData[chartData.length - 1].totalWAR >= contenderThreshold ? ' (above threshold)' : ' (below threshold)'
                  }`
                : isSeasonComplete ? '3-year age-curve projection' : 'Full Season Pace'}
            </span>
            <ChevronDown size={14} className="text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="bg-card-bg border border-card-border border-t-0 rounded-b-2xl -mt-2 px-4 sm:px-5 pb-4 pt-2">
            <div className="text-xs text-muted-foreground mb-1">
              Trend shows whether your team is improving or declining based on player age curves.
            </div>
            <div className="text-xs text-muted-foreground/60 mb-3">
              Dashed line = contender threshold ({contenderThreshold.toFixed(1)})
            </div>
            <div className="h-[160px] sm:h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: '#4b5563' }} tickLine={false} />
                  <YAxis domain={[yMin, yMax]} tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb', fontSize: 12 }}
                    formatter={(value: number) => [`${value.toFixed(1)}`, 'Franchise Score']}
                  />
                  <ReferenceLine y={contenderThreshold} stroke="#6366f1" strokeDasharray="6 3" strokeWidth={1.5}
                    label={{ value: 'Contender', position: 'insideTopRight', fill: '#818cf8', fontSize: 10 }} />
                  <Line type="monotone" dataKey="totalWAR" stroke="#06b6d4" strokeWidth={2.5}
                    dot={{ r: 5, fill: '#06b6d4', stroke: '#0e7490', strokeWidth: 1.5 }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── Position Breakdown ── */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="group w-full bg-card-bg border border-card-border rounded-2xl p-4 sm:p-5 hover:bg-muted/10 transition-colors text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Position Breakdown</span>
            <span className="text-xs text-muted-foreground flex-1 truncate">
              {strengths.length > 0 && `Strong: ${strengths.join(', ')}`}
              {strengths.length > 0 && weaknesses.length > 0 && ' · '}
              {weaknesses.length > 0 && `Weak: ${weaknesses.join(', ')}`}
            </span>
            <ChevronDown size={14} className="text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="bg-card-bg border border-card-border border-t-0 rounded-b-2xl -mt-2 px-4 sm:px-5 pb-4 pt-2">
            <div className="text-xs text-muted-foreground mb-3">WAR rank vs league average, with roster age trend</div>
            <div className="space-y-3">
              {warByPosition.map((pos) => {
                const delta = pos.war - pos.leagueAvgWAR;
                const ageTrend = pos.avgAge === 0 ? null
                  : pos.avgAge <= 25 ? { label: '↑ Rising', cls: 'text-emerald-400' }
                  : pos.avgAge <= 28 ? { label: '→ Prime', cls: 'text-brand-cyan' }
                  : { label: '↓ Aging', cls: 'text-orange-400' };
                return (
                  <div key={pos.position} className="flex items-center gap-3">
                    <PosBadge pos={pos.position} />
                    <span className="text-xs text-muted-foreground w-16 shrink-0">#{pos.rank} in league</span>
                    <span className={`text-xs font-medium tabular-nums w-16 shrink-0 ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(1)} vs avg
                    </span>
                    {ageTrend && <span className={`text-xs ${ageTrend.cls}`}>{ageTrend.label} (avg {pos.avgAge})</span>}
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">{pos.war.toFixed(1)} WAR</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── Methodology link ── */}
      <div className="flex items-center justify-center py-2.5">
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
          title="Franchise Score = current season points minus positional replacement level. Projections use age-curve multipliers (PPR era). Future pick value discounted 85%/yr. Dynasty values from FantasyCalc (24h cache)."
        >
          <HelpCircle size={12} />
          How franchise scoring works
        </button>
      </div>

      <FranchiseCardModal
        open={cardModalOpen}
        onClose={() => setCardModalOpen(false)}
        cardProps={cardProps}
      />

    </div>
  );
}
