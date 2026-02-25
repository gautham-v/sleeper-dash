'use client';
import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { AllTimeWARAnalysis, ManagerAllTimeWAR } from '../types/sleeper';

interface Props {
  userId: string;
  analysis: AllTimeWARAnalysis;
  previewMode?: boolean;
  showRankings?: boolean;
}

type ViewMode = 'cumulative' | 'rolling';

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#14b8a6',
];

function buildColorMap(userIds: string[], currentUserId: string): Map<string, string> {
  const others = userIds.filter((id) => id !== currentUserId);
  const map = new Map<string, string>();
  others.forEach((id, i) => {
    map.set(id, COLORS[i % COLORS.length]);
  });
  // Current user always gets brand-cyan
  map.set(currentUserId, '#22d3ee');
  return map;
}

/** Combined label for a manager: "Team Name · manager_username" when they differ */
function getManagerLabel(manager: ManagerAllTimeWAR | undefined, id: string): string {
  if (!manager) return id;
  const { displayName, managerName } = manager;
  if (managerName && managerName !== displayName) {
    return `${displayName} · ${managerName}`;
  }
  return displayName;
}

interface ChartDatum {
  allTimeIndex: number;
  season: string;
  week: number;
  [userId: string]: number | string;
}

interface RankingRow {
  userId: string;
  displayName: string;
  managerName: string;
  currentWAR: number;
  yoyChange: number | null;
}

function CustomTooltip({ active, payload, mode }: TooltipProps<number, string> & { mode: ViewMode }) {
  if (!active || !payload || payload.length === 0) return null;

  const datum = payload[0]?.payload as ChartDatum;
  const valueLabel = mode === 'cumulative' ? 'All-Time Value Score' : 'Recent Form Value Score';

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl min-w-[190px]">
      <div className="text-gray-400 mb-2 font-medium">
        {datum.season} · Wk {datum.week}
      </div>
      {payload
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
        .map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-3 py-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-300 truncate max-w-[130px]">{entry.name}</span>
            </div>
            <span className="font-bold tabular-nums" style={{ color: entry.color }}>
              {typeof entry.value === 'number' ? entry.value.toFixed(1) : '—'}
            </span>
          </div>
        ))}
      <div className="text-gray-600 mt-1.5 pt-1.5 border-t border-gray-800 text-[10px]">{valueLabel}</div>
    </div>
  );
}

export function FranchiseTrajectoryTab({ userId, analysis, showRankings = false }: Props) {
  const [mode, setMode] = useState<ViewMode>('cumulative');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const { colorMap, userIds, seasonBoundaries } = useMemo(() => {
    const managers = [...analysis.managerData.values()];
    const ids = managers.map((m) => m.userId);
    const colors = buildColorMap(ids, userId);
    return {
      colorMap: colors,
      userIds: ids,
      seasonBoundaries: analysis.seasonBoundaries,
    };
  }, [analysis, userId]);

  const modeChartData = useMemo(() => {
    const managers = [...analysis.managerData.values()];
    const dataMap = new Map<number, ChartDatum>();
    for (const m of managers) {
      for (const pt of m.points) {
        let datum = dataMap.get(pt.allTimeIndex);
        if (!datum) {
          datum = { allTimeIndex: pt.allTimeIndex, season: pt.season, week: pt.week };
          dataMap.set(pt.allTimeIndex, datum);
        }
        datum[m.userId] = mode === 'cumulative' ? pt.cumulativeWAR : pt.rollingWAR;
      }
    }
    return Array.from(dataMap.values()).sort((a, b) => a.allTimeIndex - b.allTimeIndex);
  }, [analysis, mode]);

  // Rankings with YoY change — sorted by current cumulative WAR descending
  const rankings = useMemo((): RankingRow[] => {
    if (!showRankings || !analysis.hasData) return [];

    // allTimeIndex at which the most recent season starts
    const lastSeasonStart = analysis.seasonBoundaries.at(-1)?.startIndex ?? 0;

    return [...analysis.managerData.values()]
      .map((m): RankingRow | null => {
        if (!m.points.length) return null;
        const currentWAR = m.points.at(-1)!.cumulativeWAR;

        // Last point from the previous season (allTimeIndex strictly before lastSeasonStart)
        const prevPoint = [...m.points].reverse().find((p) => p.allTimeIndex < lastSeasonStart);
        const yoyChange = prevPoint != null ? currentWAR - prevPoint.cumulativeWAR : null;

        return { userId: m.userId, displayName: m.displayName, managerName: m.managerName, currentWAR, yoyChange };
      })
      .filter((r): r is RankingRow => r !== null)
      .sort((a, b) => b.currentWAR - a.currentWAR);
  }, [analysis, showRankings]);

  function handleLegendClick(id: string) {
    setHighlightedId((prev) => (prev === id ? null : id));
  }

  function getLineOpacity(id: string, isCurrentUser: boolean): number {
    if (highlightedId === null) return isCurrentUser ? 1 : 0.4;
    return highlightedId === id ? 1 : 0.1;
  }

  function getLineStrokeWidth(id: string, isCurrentUser: boolean): number {
    if (highlightedId === null) return isCurrentUser ? 2.5 : 1;
    if (highlightedId === id) return isCurrentUser ? 3.5 : 3;
    return 1;
  }

  if (!analysis.hasData) {
    return (
      <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
        <div className="text-2xl mb-3">📈</div>
        <div className="text-sm font-medium text-gray-300">No trajectory data available</div>
        <div className="text-xs text-gray-500 mt-1">
          Need at least one completed season with matchup data.
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-card-bg border border-card-border rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp size={16} className="text-brand-cyan" />
        <h3 className="font-semibold text-white">Franchise Value</h3>
      </div>

      {/* Toggle */}
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => { if (v) setMode(v as ViewMode); }}
        className="justify-start"
      >
        <ToggleGroupItem
          value="cumulative"
          className="px-3 py-1.5 text-xs font-medium data-[state=on]:bg-brand-cyan/20 data-[state=on]:text-brand-cyan data-[state=on]:border-brand-cyan/40"
        >
          All-Time Total
        </ToggleGroupItem>
        <ToggleGroupItem
          value="rolling"
          className="px-3 py-1.5 text-xs font-medium data-[state=on]:bg-brand-cyan/20 data-[state=on]:text-brand-cyan data-[state=on]:border-brand-cyan/40"
        >
          Recent Form (17-wk)
        </ToggleGroupItem>
      </ToggleGroup>

      {mode === 'rolling' && (
        <p className="text-xs text-gray-500">
          Shows how much value each team has added over the past 17 weeks, regardless of how long they&apos;ve been in the league.
        </p>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={modeChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />

          <XAxis
            dataKey="allTimeIndex"
            stroke="#374151"
            tick={false}
            tickLine={false}
          />
          <YAxis
            stroke="#374151"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={45}
            tickFormatter={(v: number) => v.toFixed(0)}
          />

          <Tooltip content={<CustomTooltip mode={mode} />} />

          {/* Season boundary reference lines */}
          {seasonBoundaries.slice(1).map(({ season, startIndex }) => (
            <ReferenceLine
              key={season}
              x={startIndex}
              stroke="#374151"
              strokeDasharray="4 3"
              label={{
                value: season,
                position: 'insideTopLeft',
                fill: '#6b7280',
                fontSize: 10,
                dy: -2,
              }}
            />
          ))}

          {/* Other managers — dim thin lines */}
          {userIds
            .filter((id) => id !== userId)
            .map((id) => {
              const manager = analysis.managerData.get(id);
              const color = colorMap.get(id) ?? '#6b7280';
              return (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  name={getManagerLabel(manager, id)}
                  stroke={color}
                  strokeWidth={getLineStrokeWidth(id, false)}
                  dot={false}
                  activeDot={{ r: 5, cursor: 'pointer', onClick: () => handleLegendClick(id) }}
                  connectNulls
                  opacity={getLineOpacity(id, false)}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleLegendClick(id)}
                />
              );
            })}

          {/* Current manager — bright thick line, rendered last (on top) */}
          {(() => {
            const manager = analysis.managerData.get(userId);
            return (
              <Line
                key={userId}
                type="monotone"
                dataKey={userId}
                name={getManagerLabel(manager, userId)}
                stroke="#22d3ee"
                strokeWidth={getLineStrokeWidth(userId, true)}
                dot={false}
                activeDot={{ r: 5, cursor: 'pointer', onClick: () => handleLegendClick(userId) }}
                connectNulls
                opacity={getLineOpacity(userId, true)}
                style={{ cursor: 'pointer' }}
                onClick={() => handleLegendClick(userId)}
              />
            );
          })()}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2.5 pt-1 border-t border-gray-800">
        {userIds.map((id) => {
          const manager = analysis.managerData.get(id);
          const isCurrentUser = id === userId;
          const color = colorMap.get(id) ?? '#6b7280';
          const isHighlighted = highlightedId === id;
          const hasDistinctManagerName = manager?.managerName && manager.managerName !== manager.displayName;
          return (
            <div
              key={id}
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleLegendClick(id)}
            >
              <span
                className="inline-block rounded-full flex-shrink-0 mt-0.5"
                style={{
                  width: isCurrentUser ? 10 : 8,
                  height: isCurrentUser ? 10 : 8,
                  backgroundColor: color,
                  opacity: isCurrentUser ? 1 : 0.6,
                  outline: isHighlighted ? `2px solid ${color}` : 'none',
                  outlineOffset: '2px',
                }}
              />
              <span className="text-xs leading-tight">
                <span
                  className={`block truncate max-w-[110px] ${isCurrentUser ? 'text-white font-semibold' : 'text-gray-400'} ${isHighlighted ? 'font-bold !text-white' : ''}`}
                >
                  {manager?.displayName ?? id}
                </span>
                {hasDistinctManagerName && (
                  <span className="block truncate max-w-[110px] text-[10px] text-gray-600">
                    {manager!.managerName}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Rankings table — franchise page only, cumulative mode */}
      {showRankings && mode === 'cumulative' && rankings.length > 0 && (
        <div className="pt-2 border-t border-gray-800">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Current Standings · All-Time Franchise Value
          </div>
          <div className="space-y-1">
            {rankings.map((row, i) => {
              const color = colorMap.get(row.userId) ?? '#6b7280';
              const isCurrentUser = row.userId === userId;
              const hasDistinct = row.managerName && row.managerName !== row.displayName;
              const yoy = row.yoyChange;
              return (
                <div
                  key={row.userId}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isCurrentUser
                      ? 'bg-brand-cyan/5 border border-brand-cyan/20'
                      : 'hover:bg-white/5'
                  }`}
                >
                  {/* Rank */}
                  <span className="text-xs font-bold text-gray-500 w-5 text-right flex-shrink-0">
                    #{i + 1}
                  </span>

                  {/* Color dot */}
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />

                  {/* Team + manager name */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-semibold truncate ${isCurrentUser ? 'text-brand-cyan' : 'text-gray-200'}`}>
                      {row.displayName}
                    </div>
                    {hasDistinct && (
                      <div className="text-[10px] text-gray-500 truncate">{row.managerName}</div>
                    )}
                  </div>

                  {/* Current franchise value */}
                  <span className="text-xs font-bold tabular-nums text-gray-300 flex-shrink-0">
                    {row.currentWAR >= 0 ? '+' : ''}{row.currentWAR.toFixed(1)}
                  </span>

                  {/* YoY change */}
                  <div className="flex items-center gap-0.5 flex-shrink-0 min-w-[56px] justify-end">
                    {yoy === null ? (
                      <span className="text-[10px] text-gray-600">—</span>
                    ) : yoy > 0.05 ? (
                      <>
                        <TrendingUp size={11} className="text-emerald-400 flex-shrink-0" />
                        <span className="text-[11px] font-semibold text-emerald-400 tabular-nums">
                          +{yoy.toFixed(1)}
                        </span>
                      </>
                    ) : yoy < -0.05 ? (
                      <>
                        <TrendingDown size={11} className="text-red-400 flex-shrink-0" />
                        <span className="text-[11px] font-semibold text-red-400 tabular-nums">
                          {yoy.toFixed(1)}
                        </span>
                      </>
                    ) : (
                      <>
                        <Minus size={11} className="text-gray-500 flex-shrink-0" />
                        <span className="text-[11px] text-gray-500 tabular-nums">0.0</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-gray-600 mt-2 px-1">
            YoY = value added this season vs. end of previous season
          </div>
        </div>
      )}
    </div>
  );
}
