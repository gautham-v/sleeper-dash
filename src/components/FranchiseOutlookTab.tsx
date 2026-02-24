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
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import type { FranchiseOutlookResult, FranchiseTier, RiskCategory } from '../types/sleeper';

interface FranchiseOutlookTabProps {
  userId: string;
  data: Map<string, FranchiseOutlookResult>;
}

// ── Color helpers ────────────────────────────────────────────────────────────

function tierColors(tier: FranchiseTier) {
  switch (tier) {
    case 'Contender':
      return {
        bg: 'bg-emerald-900/20',
        border: 'border-emerald-700/40',
        text: 'text-emerald-400',
        badge: 'bg-emerald-900/40 border-emerald-700/40 text-emerald-300',
      };
    case 'Fringe':
      return {
        bg: 'bg-yellow-900/20',
        border: 'border-yellow-700/40',
        text: 'text-yellow-400',
        badge: 'bg-yellow-900/40 border-yellow-700/40 text-yellow-300',
      };
    case 'Rebuilding':
      return {
        bg: 'bg-red-900/20',
        border: 'border-red-700/40',
        text: 'text-red-400',
        badge: 'bg-red-900/40 border-red-700/40 text-red-300',
      };
  }
}

function riskBarColor(category: RiskCategory): string {
  switch (category) {
    case 'Low':      return '#10b981'; // emerald-500
    case 'Moderate': return '#f59e0b'; // amber-500
    case 'High':     return '#f97316'; // orange-500
    case 'Extreme':  return '#ef4444'; // red-500
  }
}

function ageBucketColor(bucket: string): string {
  switch (bucket) {
    case '22–24': return '#10b981'; // young → green
    case '25–27': return '#06b6d4'; // prime → cyan
    case '28–30': return '#f59e0b'; // aging → amber
    case '31+':   return '#ef4444'; // decline → red
    default:      return '#6b7280';
  }
}

function peakYearLabel(yearOffset: number): string {
  if (yearOffset === 0) return 'This Year';
  return `+${yearOffset} Year${yearOffset > 1 ? 's' : ''}`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
        <div className="text-xs text-gray-500 mt-1">
          No roster or player data found for this manager.
        </div>
      </div>
    );
  }

  const {
    tier,
    weightedAge,
    ageCategory,
    leagueAgePercentile,
    riskScore,
    riskCategory,
    currentWAR,
    projectedWAR,
    contenderThreshold,
    windowLength,
    peakYearOffset,
    peakWAR,
    warByAgeBucket,
  } = result;

  const tc = tierColors(tier);

  // Build chart data: Current + 3 projected years
  const currentYear = new Date().getFullYear();
  const chartData = [
    { label: `${currentYear} (Now)`, totalWAR: currentWAR, yearOffset: 0 },
    ...projectedWAR.map((p) => ({
      label: `${currentYear + p.yearOffset}`,
      totalWAR: p.totalWAR,
      yearOffset: p.yearOffset,
    })),
  ];

  // Y-axis domain: give some padding above/below
  const allWARValues = chartData.map((d) => d.totalWAR);
  const yMin = Math.floor(Math.min(...allWARValues, contenderThreshold) - 5);
  const yMax = Math.ceil(Math.max(...allWARValues, contenderThreshold) + 5);

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
            <div className="text-xs text-gray-500">Current Team WAR</div>
            <div className="text-2xl font-bold text-brand-cyan tabular-nums">
              {currentWAR > 0 ? currentWAR.toFixed(1) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Roster Age">
          <div className="text-xl font-bold text-white tabular-nums">{weightedAge}</div>
          <div className={`text-xs font-medium mt-0.5 ${
            ageCategory === 'Young' ? 'text-emerald-400' :
            ageCategory === 'Prime' ? 'text-brand-cyan' : 'text-orange-400'
          }`}>
            {ageCategory}
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            Age %ile: {leagueAgePercentile}th
          </div>
        </SummaryCard>

        <SummaryCard label="Contender Window">
          <div className="text-xl font-bold text-white tabular-nums">
            {windowLength} <span className="text-sm font-normal text-gray-400">yr{windowLength !== 1 ? 's' : ''}</span>
          </div>
          <div className={`text-xs font-medium mt-0.5 ${
            windowLength >= 3 ? 'text-emerald-400' :
            windowLength >= 1 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {windowLength === 0 ? 'Outside window' :
             windowLength >= 3 ? 'Multi-year threat' : 'Narrow window'}
          </div>
        </SummaryCard>

        <SummaryCard label="Peak Year">
          <div className="text-xl font-bold text-white">{peakYearLabel(peakYearOffset)}</div>
          <div className="text-xs text-brand-cyan tabular-nums mt-0.5">
            {peakWAR.toFixed(1)} projected WAR
          </div>
        </SummaryCard>

        <SummaryCard label="Age Curve Risk">
          <div className="text-xl font-bold text-white tabular-nums">{riskScore}</div>
          <div className={`text-xs font-medium mt-0.5 ${
            riskCategory === 'Low' ? 'text-emerald-400' :
            riskCategory === 'Moderate' ? 'text-yellow-400' :
            riskCategory === 'High' ? 'text-orange-400' : 'text-red-400'
          }`}>
            {riskCategory}
          </div>
        </SummaryCard>
      </div>

      {/* ── WAR Projection Chart ── */}
      <div className="bg-card-bg border border-card-border rounded-2xl p-5">
        <div className="mb-1">
          <span className="text-sm font-semibold text-white">WAR Trajectory</span>
          <span className="ml-2 text-xs text-gray-500">3-year age-curve projection</span>
        </div>
        <div className="text-xs text-gray-600 mb-4">
          Dashed line = contender threshold ({contenderThreshold.toFixed(1)} WAR)
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={{ stroke: '#4b5563' }}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#f9fafb',
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value.toFixed(1)} WAR`, 'Team WAR']}
            />
            <ReferenceLine
              y={contenderThreshold}
              stroke="#6366f1"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{
                value: 'Contender',
                position: 'insideTopRight',
                fill: '#818cf8',
                fontSize: 10,
              }}
            />
            <Line
              type="monotone"
              dataKey="totalWAR"
              stroke="#06b6d4"
              strokeWidth={2.5}
              dot={{ r: 5, fill: '#06b6d4', stroke: '#0e7490', strokeWidth: 1.5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Age Curve Risk Score ── */}
      <div className="bg-card-bg border border-card-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm font-semibold text-white">Age Curve Risk</span>
            <div className="text-xs text-gray-500 mt-0.5">
              Estimated WAR decay over 2 years relative to current output
            </div>
          </div>
          <div className={`text-right`}>
            <div className="text-2xl font-bold tabular-nums" style={{ color: riskBarColor(riskCategory) }}>
              {riskScore}
            </div>
            <div className="text-xs text-gray-500">/ 100</div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${riskScore}%`,
              backgroundColor: riskBarColor(riskCategory),
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600 mt-1.5">
          <span>Low Risk</span>
          <span>Moderate</span>
          <span>High</span>
          <span>Extreme</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {(['Low', 'Moderate', 'High', 'Extreme'] as const).map((cat) => (
            <div
              key={cat}
              className={`text-xs py-1 rounded ${riskCategory === cat ? 'font-semibold' : 'opacity-30'}`}
              style={{ color: riskBarColor(cat) }}
            >
              {cat}
            </div>
          ))}
        </div>
      </div>

      {/* ── WAR by Age Bucket ── */}
      <div className="bg-card-bg border border-card-border rounded-2xl p-5">
        <div className="mb-1">
          <span className="text-sm font-semibold text-white">WAR by Age Group</span>
          <span className="ml-2 text-xs text-gray-500">Current season production by age range</span>
        </div>
        <div className="text-xs text-gray-600 mb-4">
          Skill positions only (QB / RB / WR / TE)
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={warByAgeBucket} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis
              dataKey="bucket"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={{ stroke: '#4b5563' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#f9fafb',
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value.toFixed(1)} WAR`, 'Team WAR']}
            />
            <Bar dataKey="war" radius={[4, 4, 0, 0]}>
              {warByAgeBucket.map((entry) => (
                <Cell key={entry.bucket} fill={ageBucketColor(entry.bucket)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {warByAgeBucket.map(({ bucket, war }) => (
            <div key={bucket} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: ageBucketColor(bucket) }}
              />
              <span className="text-gray-400">{bucket}</span>
              <span className="text-gray-300 font-medium tabular-nums">
                ({war > 0 ? '+' : ''}{war.toFixed(1)})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Methodology note ── */}
      <div className="text-xs text-gray-700 px-1">
        Projections use static age-curve multipliers derived from historical fantasy production (PPR era).
        WAR = current season points minus positional replacement level. Results are deterministic — no ML.
      </div>
    </div>
  );
}
