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
  '#00E5FF', '#B9FBC0', '#B084E9', '#F0F600', '#FF3366',
  '#39FF14', '#00FFFF', '#FF9933', '#BF00FF', '#FF00FF',
];

type MetricKey = 'wins' | 'rank' | 'pointsFor';

const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'wins', label: 'Wins' },
  { key: 'rank', label: 'Final Rank' },
  { key: 'pointsFor', label: 'Points For' },
];

export function YearOverYear({ data }: YearOverYearProps) {
  const [metric, setMetric] = React.useState<MetricKey>('wins');

  if (data.length === 0) {
    return (
      <div className="bg-card-bg rounded-2xl p-8 text-center text-gray-500 border border-card-border border-dashed">
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
      if (s) entry[team.displayName] = s[metric];
    }
    return entry;
  });

  const reverseYAxis = metric === 'rank';

  return (
    <div className="bg-card-bg rounded-2xl p-6 border border-card-border shadow-lg relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-cyan/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
      <div className="flex gap-3 mb-6 relative z-10">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              metric === m.key
                ? 'bg-brand-cyan/10 border border-brand-cyan/50 text-brand-cyan shadow-[0_0_15px_rgba(0,229,255,0.2)]'
                : 'bg-black/20 border border-card-border text-gray-500 hover:text-white hover:border-gray-600'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {metric === 'rank' && (
        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-6 relative z-10">Lower rank = better finish (1st place = 1)</p>
      )}

      <div className="relative z-10">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="season" stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
            <YAxis
              stroke="#4b5563"
              tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 600 }}
              reversed={reverseYAxis}
              domain={metric === 'rank' ? [1, 'dataMax'] : undefined}
              axisLine={false}
              tickLine={false}
              dx={-10}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(21, 24, 33, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: '#fff',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                padding: '12px 16px',
              }}
              itemStyle={{ fontSize: '13px', fontWeight: 500, padding: '4px 0' }}
              labelStyle={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, fontWeight: 500, paddingTop: '20px' }} iconType="circle" />
            {data.map((team, i) => (
              <Line
                key={team.displayName}
                type="monotone"
                dataKey={team.displayName}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={3}
                dot={{ r: 5, fill: '#151821', stroke: COLORS[i % COLORS.length], strokeWidth: 2 }}
                activeDot={{ r: 7, fill: COLORS[i % COLORS.length], stroke: '#fff', strokeWidth: 2, className: 'drop-shadow-md' }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Need React import for useState
import React from 'react';
