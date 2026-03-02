'use client';
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
} from '../types/sleeper';
import { MetricTooltip } from '@/components/MetricTooltip';

interface FranchiseOutlookTabProps {
  userId: string;
  data: Map<string, FranchiseOutlookResult>;
}

// ── Color helpers ────────────────────────────────────────────────────────────

function tierColors(tier: FranchiseTier) {
  switch (tier) {
    case 'Contender':
      return {
        bg: 'bg-emerald-900/20', border: 'border-emerald-700/40',
        text: 'text-emerald-400', badge: 'bg-emerald-900/40 border-emerald-700/40 text-emerald-300',
      };
    case 'Fringe':
      return {
        bg: 'bg-yellow-900/20', border: 'border-yellow-700/40',
        text: 'text-yellow-400', badge: 'bg-yellow-900/40 border-yellow-700/40 text-yellow-300',
      };
    case 'Rebuilding':
      return {
        bg: 'bg-red-900/20', border: 'border-red-700/40',
        text: 'text-red-400', badge: 'bg-red-900/40 border-red-700/40 text-red-300',
      };
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

const POSITION_COLORS: Record<string, string> = {
  QB: 'bg-red-900/50 text-red-300 border-red-800/50',
  RB: 'bg-green-900/50 text-green-300 border-green-800/50',
  WR: 'bg-blue-900/50 text-blue-300 border-blue-800/50',
  TE: 'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
};

function PosBadge({ pos }: { pos: string }) {
  const cls = POSITION_COLORS[pos] ?? 'bg-gray-800/50 text-gray-400 border-gray-700/50';
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold border ${cls} w-8 text-center shrink-0`}>
      {pos}
    </span>
  );
}

function SummaryCard({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">{label}</div>
      {children}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function FranchiseOutlookTab({ userId, data }: FranchiseOutlookTabProps) {
  const result = data.get(userId);

  if (!result) {
    return (
      <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
        <div className="text-2xl mb-3">🔭</div>
        <div className="text-sm font-medium text-gray-300">Franchise outlook unavailable</div>
        <div className="text-xs text-gray-500 mt-1">No roster or player data found for this manager.</div>
      </div>
    );
  }

  const {
    tier, weightedAge, ageCategory, leagueAgePercentile,
    riskScore, riskCategory, currentWAR, projectedWAR,
    contenderThreshold, windowLength, peakYearOffset, peakWAR,
    futurePicks, isSeasonComplete, keyPlayers, youngAssets,
    warByPosition, wins, losses, warRank, luckScore, focusAreas,
    strategyRecommendation, rookieDraftTargets, tradeTargets, tradePartners,
  } = result;

  const totalManagers = data.size;
  const tc = tierColors(tier);

  const currentYear = new Date().getFullYear();
  const chartData = [
    { label: `${currentYear} (Now)`, totalWAR: currentWAR, yearOffset: 0 },
    ...projectedWAR.map((p) => ({ label: `${currentYear + p.yearOffset}`, totalWAR: p.totalWAR })),
  ];
  const allWARValues = chartData.map((d) => d.totalWAR);
  const yMin = Math.floor(Math.min(...allWARValues, contenderThreshold) - 5);
  const yMax = Math.ceil(Math.max(...allWARValues, contenderThreshold) + 5);

  // Future picks grouped by year
  const picksByYear = new Map<string, number[]>();
  for (const pick of futurePicks) {
    const arr = picksByYear.get(pick.season) ?? [];
    arr.push(pick.round);
    picksByYear.set(pick.season, arr);
  }
  const sortedPickYears = [...picksByYear.keys()].sort();

  return (
    <div className="space-y-4">

      {/* ── Tier banner ── */}
      <div className={`${tc.bg} ${tc.border} border rounded-2xl p-5`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold border ${tc.badge}`}>
              {tier === 'Contender' ? '🏆' : tier === 'Fringe' ? '⚡' : '🔨'} {tier}
            </span>
            <div className={`text-xs mt-1.5 ${tc.text}`}>
              {tier === 'Contender' && `Contender window: ${windowLength} year${windowLength !== 1 ? 's' : ''}`}
              {tier === 'Fringe' && 'Above league median — on the cusp'}
              {tier === 'Rebuilding' && 'Below league median — focused on future'}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-xs text-gray-500">
              Franchise Score
              <MetricTooltip metricKey="franchiseScore" side="left" />
            </div>
            <div className="text-2xl font-bold text-brand-cyan tabular-nums">
              {currentWAR > 0 ? currentWAR.toFixed(1) : '—'}
            </div>
            {totalManagers > 0 && (
              <div className="text-xs text-gray-500 mt-0.5">
                Ranked #{warRank} of {totalManagers} &bull; {wins}–{losses}
                {luckScore >= 2 && <span className="ml-1 text-emerald-400">Running hot</span>}
                {luckScore <= -2 && <span className="ml-1 text-red-400">Unlucky record</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Strategy Recommendation ── */}
      <div className="bg-card-bg border border-card-border rounded-2xl p-5">
        <div className="text-sm font-semibold text-white mb-2">Recommended Strategy</div>
        <div className={`text-lg font-bold mb-1 ${strategyModeColor(strategyRecommendation.mode)}`}>
          {strategyRecommendation.mode}
        </div>
        <div className="text-sm text-gray-300 mb-3">{strategyRecommendation.headline}</div>
        {strategyRecommendation.rationale.length > 0 && (
          <ul className="space-y-1.5 mb-3">
            {strategyRecommendation.rationale.map((r, i) => (
              <li key={i} className="text-xs text-gray-400 flex gap-2">
                <span className="text-brand-cyan shrink-0 mt-0.5">•</span>
                {r}
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2 mt-2">
          <div className="text-xs text-gray-500 shrink-0">Action urgency</div>
          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${urgencyBarColor(strategyRecommendation.urgencyScore)}`}
              style={{ width: `${strategyRecommendation.urgencyScore}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 tabular-nums shrink-0">
            {strategyRecommendation.urgencyScore}/100
          </div>
        </div>
      </div>

      {/* ── Focus Areas ── */}
      {focusAreas.length > 0 && (
        <div className="bg-card-bg border border-card-border rounded-2xl p-5 space-y-3">
          <div className="text-sm font-semibold text-white">Focus Areas</div>
          {focusAreas.map((area, i) => (
            <div
              key={i}
              className={`rounded-lg px-4 py-3 border ${
                area.severity === 'warning'
                  ? 'bg-amber-900/15 border-amber-700/30'
                  : area.severity === 'positive'
                  ? 'bg-emerald-900/15 border-emerald-700/30'
                  : 'bg-gray-800/40 border-gray-700/30'
              }`}
            >
              <div className={`text-sm font-medium ${
                area.severity === 'warning' ? 'text-amber-300'
                  : area.severity === 'positive' ? 'text-emerald-300'
                  : 'text-gray-300'
              }`}>
                {area.severity === 'warning' ? '⚠ ' : area.severity === 'positive' ? '✓ ' : 'ℹ '}
                {area.signal}
              </div>
              <div className="text-xs text-gray-400 mt-1">{area.detail}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard label="Roster Age">
          <div className="text-xl font-bold text-white tabular-nums">{weightedAge}</div>
          <div className={`text-xs font-medium mt-0.5 ${
            ageCategory === 'Young' ? 'text-emerald-400'
              : ageCategory === 'Prime' ? 'text-brand-cyan' : 'text-orange-400'
          }`}>{ageCategory}</div>
          <div className="text-xs text-gray-600 mt-0.5">Age %ile: {leagueAgePercentile}th</div>
        </SummaryCard>

        <SummaryCard label={<span className="flex items-center gap-1">Contender Window <MetricTooltip metricKey="contenderWindow" side="bottom" /></span>}>
          <div className="text-xl font-bold text-white tabular-nums">
            {windowLength} <span className="text-sm font-normal text-gray-400">yr{windowLength !== 1 ? 's' : ''}</span>
          </div>
          <div className={`text-xs font-medium mt-0.5 ${
            windowLength >= 3 ? 'text-emerald-400' : windowLength >= 1 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {windowLength === 0 ? 'Outside window' : windowLength >= 3 ? 'Multi-year threat' : 'Narrow window'}
          </div>
        </SummaryCard>

        <SummaryCard label="Peak Year">
          <div className="text-xl font-bold text-white">{peakYearLabel(peakYearOffset)}</div>
          <div className="text-xs text-brand-cyan tabular-nums mt-0.5">{peakWAR.toFixed(1)} projected score</div>
        </SummaryCard>

        <SummaryCard label={<span className="flex items-center gap-1">Roster Age Risk <MetricTooltip metricKey="rosterAgeRisk" side="bottom" /></span>}>
          <div className="text-xl font-bold text-white tabular-nums">{riskScore}</div>
          <div className={`text-xs font-medium mt-0.5 ${
            riskCategory === 'Low' ? 'text-emerald-400'
              : riskCategory === 'Moderate' ? 'text-yellow-400'
              : riskCategory === 'High' ? 'text-orange-400' : 'text-red-400'
          }`}>{riskCategory}</div>
        </SummaryCard>

        <SummaryCard label="Future Picks">
          <div className="text-xl font-bold text-white tabular-nums">
            {futurePicks.length > 0 ? futurePicks.length : '—'}
          </div>
          {futurePicks.length === 0 ? (
            <div className="text-xs text-gray-600 mt-0.5">None traded</div>
          ) : (
            <div className="mt-1 space-y-0.5">
              {sortedPickYears.map((year) => {
                const rounds = [...(picksByYear.get(year) ?? [])].sort((a, b) => a - b);
                return (
                  <div key={year} className="text-xs text-gray-400 leading-tight">
                    <span className="text-gray-500">{year}:</span>{' '}
                    {rounds.map((r) => `Rd ${r}`).join(', ')}
                  </div>
                );
              })}
            </div>
          )}
        </SummaryCard>
      </div>

      {/* ── Roster Assets ── */}
      <div className="bg-card-bg border border-card-border rounded-2xl p-5">
        <div className="text-sm font-semibold text-white mb-4">Roster Assets</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Franchise Pillars
            </div>
            {keyPlayers.length === 0 ? (
              <div className="text-xs text-gray-600">No production data available.</div>
            ) : (
              <div className="space-y-2">
                {keyPlayers.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-4 text-right tabular-nums">{i + 1}</span>
                    <PosBadge pos={p.position} />
                    <span className="text-sm text-gray-200 flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-gray-500">age {p.age}</span>
                    <span className={`text-xs font-medium tabular-nums ${p.war >= 0 ? 'text-brand-cyan' : 'text-red-400'}`}>
                      {p.war >= 0 ? '+' : ''}{p.war.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Young Pipeline (≤24)
              <MetricTooltip metricKey="youngPipeline" side="top" />
            </div>
            {youngAssets.length === 0 ? (
              <div className="text-xs text-gray-600">
                No players 24 or under — consider acquiring young assets.
              </div>
            ) : (
              <div className="space-y-2">
                {youngAssets.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <PosBadge pos={p.position} />
                    <span className="text-sm text-gray-200 flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-gray-500">age {p.age}</span>
                    {p.dynastyValue != null ? (
                      <span className="text-xs font-medium text-yellow-400 tabular-nums">
                        {p.dynastyValue.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600 tabular-nums">×{p.upsideRatio.toFixed(2)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Performance Trend ── */}
      <div className="bg-card-bg border border-card-border rounded-2xl p-5">
        <div className="mb-1">
          <span className="text-sm font-semibold text-white">Performance Trend</span>
          <span className="ml-2 text-xs text-gray-500">
            {isSeasonComplete ? '3-year age-curve projection' : 'Full Season Pace · 3-year projection'}
          </span>
        </div>
        <div className="text-xs text-gray-500 mb-1">
          Trend shows whether your team is improving or declining based on player age curves.
        </div>
        <div className="text-xs text-gray-600 mb-4">
          Dashed line = contender threshold ({contenderThreshold.toFixed(1)})
        </div>
        <ResponsiveContainer width="100%" height={220}>
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

      {/* ── Position Breakdown ── */}
      <div className="bg-card-bg border border-card-border rounded-2xl p-5">
        <div className="text-sm font-semibold text-white mb-1">Position Breakdown</div>
        <div className="text-xs text-gray-500 mb-4">WAR rank vs league average, with roster age trend</div>
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
                <span className="text-xs text-gray-400 w-16 shrink-0">#{pos.rank} in league</span>
                <span className={`text-xs font-medium tabular-nums w-16 shrink-0 ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)} vs avg
                </span>
                {ageTrend && <span className={`text-xs ${ageTrend.cls}`}>{ageTrend.label} (avg {pos.avgAge})</span>}
                <span className="ml-auto text-xs text-gray-500 tabular-nums">{pos.war.toFixed(1)} WAR</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Rookie Draft Targets ── */}
      {rookieDraftTargets.length > 0 && (
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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Trade Targets ── */}
      {tradeTargets.length > 0 && (
        <div className="bg-card-bg border border-card-border rounded-2xl p-5">
          <div className="text-sm font-semibold text-white mb-1">Trade Targets</div>
          <div className="text-xs text-gray-500 mb-4">
            Players on other rosters that address your position weaknesses
          </div>
          <div className="space-y-3">
            {tradeTargets.map((t, i) => (
              <div key={i} className="flex items-start gap-2">
                <PosBadge pos={t.position} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-200 truncate">{t.name}</span>
                    <span className="text-xs text-gray-500">age {t.age}</span>
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

      {/* ── Trade Partners ── */}
      {tradePartners.length > 0 && (
        <div className="bg-card-bg border border-card-border rounded-2xl p-5">
          <div className="text-sm font-semibold text-white mb-1">Best Trade Partners</div>
          <div className="text-xs text-gray-500 mb-4">
            Managers whose strengths match your weaknesses — and vice versa
          </div>
          <div className="space-y-3">
            {tradePartners.map((p) => (
              <div key={p.userId} className="border border-gray-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-200">{p.displayName}</span>
                  <span className="text-xs font-bold text-brand-cyan tabular-nums">
                    {p.compatibilityScore}/100 match
                  </span>
                </div>
                <div className="text-xs text-gray-500 mb-3">{p.summary}</div>
                <div className="flex gap-6 text-xs">
                  {p.theyCanOffer.length > 0 && (
                    <div>
                      <div className="text-gray-600 mb-1.5">They offer →</div>
                      <div className="space-y-1">
                        {[...p.theyCanOffer].sort((a, b) => b.delta - a.delta).map((o) => (
                          <div key={o.position} className="flex items-center gap-1.5">
                            <PosBadge pos={o.position} />
                            <span className="text-emerald-400">#{o.rank} · +{o.delta.toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {p.youCanOffer.length > 0 && (
                    <div>
                      <div className="text-gray-600 mb-1.5">You offer →</div>
                      <div className="space-y-1">
                        {[...p.youCanOffer].sort((a, b) => b.delta - a.delta).map((o) => (
                          <div key={o.position} className="flex items-center gap-1.5">
                            <PosBadge pos={o.position} />
                            <span className="text-brand-cyan">#{o.rank} · +{o.delta.toFixed(1)}</span>
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

      {/* ── Methodology note ── */}
      <div className="px-1">
        <div className="text-xs text-gray-700">
          Franchise Score = current season points minus positional replacement level (league starter pool × team count).
          {!isSeasonComplete && ' Mid-season scores are normalized to full-season pace.'}
          {' '}Projections use age-curve multipliers (PPR era). Future pick value discounted 85%/yr.
          Dynasty values, rookie rankings, and trade compatibility from FantasyCalc (24h cache).
        </div>
      </div>

    </div>
  );
}
