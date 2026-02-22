import { Trophy, TrendingUp, TrendingDown, Zap, Star, AlertTriangle, Skull } from 'lucide-react';
import type { LeagueSeasonRecord } from '../types/sleeper';

interface LeagueRecordsProps {
  data: LeagueSeasonRecord[];
}

interface RecordRowProps {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary?: string;
  accentBg: string;
  accentText: string;
}

function RecordRow({ icon, label, primary, secondary, accentBg, accentText }: RecordRowProps) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-800/60 last:border-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${accentBg} ${accentText}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 mb-0.5">{label}</div>
        <div className="font-semibold text-white text-sm truncate">{primary}</div>
        {secondary && <div className="text-xs text-gray-400 mt-0.5">{secondary}</div>}
      </div>
    </div>
  );
}

function SeasonCard({ record }: { record: LeagueSeasonRecord }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-3 bg-gray-800/40 border-b border-gray-800">
        <h3 className="font-bold text-white">{record.season} Season</h3>
      </div>

      <div className="px-4 py-1">
        <RecordRow
          icon={<Trophy size={14} />}
          label="Champion"
          primary={record.champion?.teamName ?? 'Season in progress'}
          secondary={
            record.champion
              ? `${record.champion.wins}–${record.champion.losses} · ${record.champion.pointsFor.toFixed(1)} pts`
              : undefined
          }
          accentBg="bg-yellow-950"
          accentText="text-yellow-400"
        />

        <RecordRow
          icon={<Skull size={14} />}
          label="Last Place"
          primary={record.lastPlace?.teamName ?? '—'}
          secondary={
            record.lastPlace
              ? `${record.lastPlace.wins}–${record.lastPlace.losses} · ${record.lastPlace.pointsFor.toFixed(1)} pts`
              : undefined
          }
          accentBg="bg-red-950"
          accentText="text-red-400"
        />

        <RecordRow
          icon={<TrendingUp size={14} />}
          label="Highest Scoring Team"
          primary={record.highestScoringTeam?.teamName ?? '—'}
          secondary={
            record.highestScoringTeam
              ? `${record.highestScoringTeam.pointsFor.toFixed(1)} pts for the season`
              : undefined
          }
          accentBg="bg-emerald-950"
          accentText="text-emerald-400"
        />

        <RecordRow
          icon={<TrendingDown size={14} />}
          label="Lowest Scoring Team"
          primary={record.lowestScoringTeam?.teamName ?? '—'}
          secondary={
            record.lowestScoringTeam
              ? `${record.lowestScoringTeam.pointsFor.toFixed(1)} pts for the season`
              : undefined
          }
          accentBg="bg-orange-950"
          accentText="text-orange-400"
        />

        <RecordRow
          icon={<Zap size={14} />}
          label="Biggest Blowout"
          primary={
            record.biggestBlowout
              ? `${record.biggestBlowout.winnerName} def. ${record.biggestBlowout.loserName}`
              : '—'
          }
          secondary={
            record.biggestBlowout
              ? `Wk ${record.biggestBlowout.week} · ${record.biggestBlowout.winnerPts.toFixed(2)}–${record.biggestBlowout.loserPts.toFixed(2)} (+${record.biggestBlowout.margin.toFixed(2)})`
              : undefined
          }
          accentBg="bg-purple-950"
          accentText="text-purple-400"
        />

        <RecordRow
          icon={<Star size={14} />}
          label="Highest Weekly Score"
          primary={record.highestWeeklyScore?.teamName ?? '—'}
          secondary={
            record.highestWeeklyScore
              ? `Wk ${record.highestWeeklyScore.week} · ${record.highestWeeklyScore.points.toFixed(2)} pts`
              : undefined
          }
          accentBg="bg-indigo-950"
          accentText="text-indigo-400"
        />

        <RecordRow
          icon={<AlertTriangle size={14} />}
          label="Lowest Weekly Score"
          primary={record.lowestWeeklyScore?.teamName ?? '—'}
          secondary={
            record.lowestWeeklyScore
              ? `Wk ${record.lowestWeeklyScore.week} · ${record.lowestWeeklyScore.points.toFixed(2)} pts`
              : undefined
          }
          accentBg="bg-gray-800"
          accentText="text-gray-400"
        />
      </div>
    </div>
  );
}

export function LeagueRecords({ data }: LeagueRecordsProps) {
  if (data.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">
        No historical data available.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {data.map((record) => (
        <SeasonCard key={record.season} record={record} />
      ))}
    </div>
  );
}

import React from 'react';
