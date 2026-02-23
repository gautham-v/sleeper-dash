import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface YoYEntry {
  displayName: string;
  seasons: {
    season: string;
    wins: number;
    losses: number;
    pointsFor: number;
    rank: number;
  }[];
}

interface YearOverYearProps {
  data: YoYEntry[];
}

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#14b8a6',
];

type MetricKey = 'wins' | 'rank' | 'pointsFor' | 'h2hWinPct';

const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'wins', label: 'Wins' },
  { key: 'rank', label: 'Final Rank' },
  { key: 'pointsFor', label: 'Points For' },
  { key: 'h2hWinPct', label: 'H2H Win %' },
];

export function YearOverYear({ data }: YearOverYearProps) {
  const [metric, setMetric] = React.useState<MetricKey>('wins');

  if (data.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">
        Not enough historical data (need at least 2 seasons).
      </div>
    );
  }

  // Build chart data: one entry per season, each team as a key
  const seasons = Array.from(new Set(data.flatMap((d) => d.seasons.map((s) => s.season)))).sort();

  const chartData = seasons.map((season) => {
    const entry: Record<string, string | number> = { season };
    for (const team of data) {
      const s = team.seasons.find((ss) => ss.season === season);
      if (s) {
        if (metric === 'h2hWinPct') {
          const total = s.wins + s.losses;
          entry[team.displayName] = total > 0 ? Math.round((s.wins / total) * 1000) / 10 : 0;
        } else {
          entry[team.displayName] = s[metric];
        }
      }
    }
    return entry;
  });

  const reverseYAxis = metric === 'rank';

  return (
    <div>
      <ToggleGroup
        type="single"
        value={metric}
        onValueChange={(v) => { if (v) setMetric(v as MetricKey); }}
        className="justify-start mb-4"
      >
        {METRICS.map((m) => (
          <ToggleGroupItem
            key={m.key}
            value={m.key}
            className="px-3 py-1.5 text-xs font-medium data-[state=on]:bg-indigo-600 data-[state=on]:text-white"
          >
            {m.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {metric === 'rank' && (
        <p className="text-xs text-gray-500 mb-4">Lower rank = better finish (1st place = 1)</p>
      )}
      {metric === 'h2hWinPct' && (
        <p className="text-xs text-gray-500 mb-4">Head-to-head win % for each regular season</p>
      )}

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="season" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis
            stroke="#6b7280"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            reversed={reverseYAxis}
            domain={metric === 'rank' ? [1, 'dataMax'] : metric === 'h2hWinPct' ? [0, 100] : undefined}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#f9fafb',
            }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {data.map((team, i) => (
            <Line
              key={team.displayName}
              type="monotone"
              dataKey={team.displayName}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4, fill: COLORS[i % COLORS.length] }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
