'use client';
import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
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
import type { TradeSimulatorResult, SimulatorPickAsset, TradeDelta } from '../types/simulator';
import type { FranchiseOutlookResult, FranchiseTier } from '../types/sleeper';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TradeSimulatorPanelProps {
  simulator: TradeSimulatorResult;
  mode?: 'inline' | 'fullpage';
}

// ── Color helpers ─────────────────────────────────────────────────────────────

const POSITION_COLORS: Record<string, string> = {
  QB: 'bg-red-900/50 text-red-300 border-red-800/50',
  RB: 'bg-green-900/50 text-green-300 border-green-800/50',
  WR: 'bg-blue-900/50 text-blue-300 border-blue-800/50',
  TE: 'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
  PICK: 'bg-purple-900/50 text-purple-300 border-purple-800/50',
};

function tierBadgeClass(tier: FranchiseTier): string {
  switch (tier) {
    case 'Contender': return 'bg-emerald-900/40 border-emerald-700/40 text-emerald-300';
    case 'Fringe':    return 'bg-yellow-900/40 border-yellow-700/40 text-yellow-300';
    case 'Rebuilding': return 'bg-red-900/40 border-red-700/40 text-red-300';
  }
}

function pickKey(pick: SimulatorPickAsset): string {
  return `${pick.season}:${pick.round}:${pick.rosterId}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PosBadge({ pos }: { pos: string }) {
  const cls = POSITION_COLORS[pos] ?? 'bg-gray-800/50 text-gray-400 border-gray-700/50';
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold border ${cls} w-8 text-center shrink-0`}>
      {pos}
    </span>
  );
}

function DeltaRow({
  label,
  before,
  after,
  colorClass,
  arrow,
}: {
  label: string;
  before: React.ReactNode;
  after: React.ReactNode;
  colorClass: string;
  arrow: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500 w-32 shrink-0 text-xs">{label}</span>
      <span className="text-gray-300">{before}</span>
      <span className="text-gray-500 text-xs">→</span>
      <span className={colorClass}>{after}</span>
      <span className={`text-xs font-medium ${colorClass}`}>{arrow}</span>
    </div>
  );
}

function WARTrajectoryChart({
  before,
  after,
  label,
}: {
  before: FranchiseOutlookResult;
  after: FranchiseOutlookResult | null;
  label: string;
}) {
  const beforeData = [
    { label: 'Now', beforeWAR: before.currentWAR, afterWAR: after ? after.currentWAR : undefined },
    ...before.projectedWAR.map((p) => ({
      label: `+${p.yearOffset}yr`,
      beforeWAR: p.totalWAR,
      afterWAR: after
        ? (after.projectedWAR.find((ap) => ap.yearOffset === p.yearOffset)?.totalWAR ?? undefined)
        : undefined,
    })),
  ];

  const allValues = [
    ...beforeData.map((d) => d.beforeWAR),
    ...beforeData.map((d) => d.afterWAR ?? 0),
    before.contenderThreshold,
  ];
  const yMin = Math.floor(Math.min(...allValues) - 3);
  const yMax = Math.ceil(Math.max(...allValues) + 3);

  const warImproved = after
    ? after.currentWAR >= before.currentWAR
    : true;
  const afterStroke = warImproved ? '#06b6d4' : '#f87171';

  return (
    <div>
      {label && (
        <div className="text-xs font-medium text-gray-400 mb-2">{label}</div>
      )}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={beforeData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            axisLine={{ stroke: '#4b5563' }}
            tickLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#f9fafb',
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [
              value.toFixed(1),
              name === 'beforeWAR' ? 'Before' : 'After',
            ]}
          />
          <ReferenceLine
            y={before.contenderThreshold}
            stroke="#6366f1"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: 'Contender', position: 'insideTopRight', fill: '#818cf8', fontSize: 10 }}
          />
          <Line
            type="monotone"
            dataKey="beforeWAR"
            stroke="#6b7280"
            strokeWidth={2}
            strokeDasharray="4 2"
            dot={{ r: 4, fill: '#6b7280', stroke: '#6b7280' }}
            activeDot={{ r: 6 }}
          />
          {after && (
            <Line
              type="monotone"
              dataKey="afterWAR"
              stroke={afterStroke}
              strokeWidth={2.5}
              dot={{ r: 4, fill: afterStroke, stroke: afterStroke }}
              activeDot={{ r: 6 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-1 justify-center">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span
            className="inline-block w-4 h-0.5 bg-gray-500"
            style={{ borderTop: '2px dashed #6b7280' }}
          />
          Before
        </div>
        {after && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: afterStroke }}>
            <span className="inline-block w-4 h-0.5" style={{ backgroundColor: afterStroke }} />
            After
          </div>
        )}
      </div>
    </div>
  );
}

function DeltaSummary({
  before,
  after,
  delta,
}: {
  before: FranchiseOutlookResult;
  after: FranchiseOutlookResult;
  delta: TradeDelta;
}) {
  const warColor =
    delta.warChange > 0
      ? 'text-emerald-400'
      : delta.warChange < 0
      ? 'text-red-400'
      : 'text-gray-500';
  const warArrow =
    delta.warChange > 0
      ? `↑ ${delta.warChange > 0 ? '+' : ''}${delta.warChange}`
      : delta.warChange < 0
      ? `↓ ${delta.warChange}`
      : '→ 0';

  const windowColor =
    delta.windowChange > 0
      ? 'text-emerald-400'
      : delta.windowChange < 0
      ? 'text-red-400'
      : 'text-gray-500';
  const windowArrow =
    delta.windowChange > 0
      ? `↑ +${delta.windowChange}yr`
      : delta.windowChange < 0
      ? `↓ ${delta.windowChange}yr`
      : '→ unchanged';

  const ageColor =
    delta.weightedAgeChange < 0
      ? 'text-emerald-400'
      : delta.weightedAgeChange > 0
      ? 'text-orange-400'
      : 'text-gray-500';
  const ageArrow =
    delta.weightedAgeChange > 0
      ? `↑ +${delta.weightedAgeChange}`
      : delta.weightedAgeChange < 0
      ? `↓ ${delta.weightedAgeChange}`
      : '→ unchanged';

  const peakArrow =
    delta.peakYearChange > 0
      ? `↑ +${delta.peakYearChange}yr`
      : delta.peakYearChange < 0
      ? `↓ ${delta.peakYearChange}yr`
      : '→ unchanged';

  return (
    <div className="space-y-2">
      {/* WAR */}
      <DeltaRow
        label="Franchise Score"
        before={before.currentWAR.toFixed(1)}
        after={after.currentWAR.toFixed(1)}
        colorClass={warColor}
        arrow={warArrow}
      />

      {/* Tier */}
      {delta.tierChange ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 w-32 shrink-0 text-xs">Tier</span>
          <span className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${tierBadgeClass(delta.tierChange.from)}`}>
            {delta.tierChange.from}
          </span>
          <span className="text-gray-500 text-xs">→</span>
          <span className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${tierBadgeClass(delta.tierChange.to)}`}>
            {delta.tierChange.to}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 w-32 shrink-0 text-xs">Tier</span>
          <span className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${tierBadgeClass(before.tier)}`}>
            {before.tier}
          </span>
          <span className="text-xs text-gray-600">unchanged</span>
        </div>
      )}

      {/* Window */}
      <DeltaRow
        label="Contender Window"
        before={`${before.windowLength}yr`}
        after={`${after.windowLength}yr`}
        colorClass={windowColor}
        arrow={windowArrow}
      />

      {/* Peak year */}
      <DeltaRow
        label="Peak Year"
        before={before.peakYearOffset === 0 ? 'Now' : `+${before.peakYearOffset}yr`}
        after={after.peakYearOffset === 0 ? 'Now' : `+${after.peakYearOffset}yr`}
        colorClass="text-gray-400"
        arrow={peakArrow}
      />

      {/* Roster age */}
      <DeltaRow
        label="Roster Age"
        before={before.weightedAge}
        after={after.weightedAge}
        colorClass={ageColor}
        arrow={ageArrow}
      />
    </div>
  );
}

// ── Asset column ──────────────────────────────────────────────────────────────

function AssetColumn({
  title,
  disabled,
  players,
  picks,
  selectedPlayerIds,
  selectedPicks,
  onTogglePlayer,
  onTogglePick,
}: {
  title: string;
  disabled: boolean;
  players: TradeSimulatorResult['myAvailablePlayers'];
  picks: SimulatorPickAsset[];
  selectedPlayerIds: string[];
  selectedPicks: SimulatorPickAsset[];
  onTogglePlayer: (id: string) => void;
  onTogglePick: (pick: SimulatorPickAsset) => void;
}) {
  const [search, setSearch] = useState('');

  const selectedPlayerSet = new Set(selectedPlayerIds);
  const selectedPickSet = new Set(selectedPicks.map(pickKey));

  const filteredPlayers = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const unselectedPlayers = filteredPlayers.filter((p) => !selectedPlayerSet.has(p.playerId));
  const unselectedPicks = picks.filter((p) => !selectedPickSet.has(pickKey(p)));

  const selectedPlayers = players.filter((p) => selectedPlayerSet.has(p.playerId));

  return (
    <div className={`flex flex-col gap-3 ${disabled ? 'opacity-40 pointer-events-none select-none' : ''}`}>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</div>

      {/* Selected chips */}
      {(selectedPlayers.length > 0 || selectedPicks.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {selectedPlayers.map((p) => (
            <button
              key={p.playerId}
              onClick={() => onTogglePlayer(p.playerId)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-cyan/15 border border-brand-cyan/40 text-brand-cyan text-xs font-medium hover:bg-brand-cyan/25 transition-colors"
            >
              <span>{p.name}</span>
              <X size={10} className="shrink-0 opacity-70" />
            </button>
          ))}
          {selectedPicks.map((pick) => (
            <button
              key={pickKey(pick)}
              onClick={() => onTogglePick(pick)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-900/30 border border-purple-700/50 text-purple-300 text-xs font-medium hover:bg-purple-900/50 transition-colors"
            >
              <span>{pick.displayLabel}</span>
              <X size={10} className="shrink-0 opacity-70" />
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search players..."
        className="w-full px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700/50 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-cyan/50 focus:bg-gray-800 transition-colors"
      />

      {/* Player list */}
      <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto rounded-lg border border-gray-700/40 bg-gray-800/30">
        {unselectedPlayers.length === 0 && search.length === 0 && (
          <div className="text-xs text-gray-600 px-3 py-3 text-center">No players available</div>
        )}
        {unselectedPlayers.length === 0 && search.length > 0 && (
          <div className="text-xs text-gray-600 px-3 py-3 text-center">No matches</div>
        )}
        {unselectedPlayers.map((p) => (
          <button
            key={p.playerId}
            onClick={() => onTogglePlayer(p.playerId)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700/40 transition-colors text-left"
          >
            <PosBadge pos={p.position} />
            <span className="text-sm text-gray-200 flex-1 truncate">{p.name}</span>
            {p.age != null && (
              <span className="text-xs text-gray-500 shrink-0">age {p.age}</span>
            )}
            <span className="text-xs font-medium text-brand-cyan tabular-nums shrink-0">
              {p.war >= 0 ? '+' : ''}{p.war.toFixed(1)}
            </span>
          </button>
        ))}
      </div>

      {/* Picks section */}
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Draft Picks</div>
        {picks.length === 0 ? (
          <div className="text-xs text-gray-600 py-2 px-3 bg-gray-800/30 rounded-lg border border-gray-700/40">
            No picks available
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 rounded-lg border border-gray-700/40 bg-gray-800/30 max-h-36 overflow-y-auto">
            {unselectedPicks.map((pick) => (
              <button
                key={pickKey(pick)}
                onClick={() => onTogglePick(pick)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700/40 transition-colors text-left"
              >
                <PosBadge pos="PICK" />
                <span className="text-sm text-gray-200">{pick.displayLabel}</span>
              </button>
            ))}
            {unselectedPicks.length === 0 && picks.length > 0 && (
              <div className="text-xs text-gray-600 px-3 py-2 text-center">All picks selected</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TradeSimulatorPanel({ simulator, mode = 'inline' }: TradeSimulatorPanelProps) {
  const {
    myBefore, myAfter, myDelta,
    theirBefore, theirAfter, theirDelta,
    isRecalculating, hasSelection,
    myAvailablePlayers, myAvailablePicks,
    counterpartyAvailablePlayers, counterpartyAvailablePicks,
    managers, counterpartyUserId, selection,
    setCounterparty,
    toggleGivePlayer, toggleGivePick,
    toggleReceivePlayer, toggleReceivePick,
    clearAll,
  } = simulator;

  const hasCounterparty = counterpartyUserId !== null;

  return (
    <div className="space-y-4">

      {/* ── Header / Manager Select ── */}
      <div className="bg-card-bg border border-card-border rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-gray-400">Trading with:</span>
            <select
              value={counterpartyUserId ?? ''}
              onChange={(e) => setCounterparty(e.target.value || null)}
              className="px-3 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/50 text-sm text-gray-200 focus:outline-none focus:border-brand-cyan/50 transition-colors cursor-pointer"
            >
              <option value="">Select manager...</option>
              {managers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>
          {hasSelection && (
            <button
              onClick={clearAll}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded border border-gray-700/40 hover:border-red-800/50"
            >
              Clear all
            </button>
          )}
        </div>

        {/* ── Two-column asset selector ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* You Give */}
          <AssetColumn
            title="You Give"
            disabled={!hasCounterparty}
            players={myAvailablePlayers}
            picks={myAvailablePicks}
            selectedPlayerIds={selection.givePlayers}
            selectedPicks={selection.givePicks}
            onTogglePlayer={toggleGivePlayer}
            onTogglePick={toggleGivePick}
          />

          {/* You Receive */}
          <AssetColumn
            title="You Receive"
            disabled={!hasCounterparty}
            players={counterpartyAvailablePlayers}
            picks={counterpartyAvailablePicks}
            selectedPlayerIds={selection.receivePlayers}
            selectedPicks={selection.receivePicks}
            onTogglePlayer={toggleReceivePlayer}
            onTogglePick={toggleReceivePick}
          />
        </div>
      </div>

      {/* ── Delta + Chart (shown only when hasSelection) ── */}
      {hasSelection && myBefore && (
        <div className="relative">
          {/* Loading overlay */}
          {isRecalculating && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-gray-900/60 backdrop-blur-sm">
              <Loader2 size={28} className="text-brand-cyan animate-spin" />
            </div>
          )}

          <div className="bg-card-bg border border-card-border rounded-2xl p-5 space-y-5">
            <div className="text-sm font-semibold text-white">Your Trade Impact</div>

            {/* Delta summary */}
            {myAfter && myDelta ? (
              <DeltaSummary before={myBefore} after={myAfter} delta={myDelta} />
            ) : (
              <div className="text-xs text-gray-500">Select assets on both sides to see impact.</div>
            )}

            {/* WAR Trajectory */}
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                WAR Trajectory
              </div>
              <WARTrajectoryChart
                before={myBefore}
                after={myAfter}
                label=""
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Counterparty section (fullpage mode only) ── */}
      {mode === 'fullpage' && theirBefore && theirAfter && theirDelta && (
        <div className="bg-card-bg border border-card-border rounded-2xl p-5 space-y-5">
          <div className="text-sm font-semibold text-white">
            Their Outlook
            {counterpartyUserId && managers.find((m) => m.userId === counterpartyUserId) && (
              <span className="ml-2 text-gray-400 font-normal">
                ({managers.find((m) => m.userId === counterpartyUserId)!.displayName})
              </span>
            )}
          </div>

          <DeltaSummary before={theirBefore} after={theirAfter} delta={theirDelta} />

          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              WAR Trajectory
            </div>
            <WARTrajectoryChart
              before={theirBefore}
              after={theirAfter}
              label=""
            />
          </div>
        </div>
      )}
    </div>
  );
}
