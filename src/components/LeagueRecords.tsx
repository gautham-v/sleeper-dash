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
    <div className="flex items-center gap-4 py-4 border-b border-card-border/50 last:border-0 hover:bg-white/5 transition-colors px-2 rounded-xl -mx-2">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-lg ${accentBg} ${accentText}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-gray-500 mb-1">{label}</div>
        <div className="font-bold text-white text-[15px] truncate leading-tight">{primary}</div>
        {secondary && <div className="text-xs font-medium text-gray-400 mt-1">{secondary}</div>}
      </div>
    </div>
  );
}

function SeasonCard({ record }: { record: LeagueSeasonRecord }) {
  return (
    <div className="bg-card-bg rounded-2xl border border-card-border overflow-hidden shadow-xl hover:border-brand-purple/30 transition-all group relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-brand-purple/10 transition-colors"></div>
      <div className="px-6 py-4 bg-black/40 border-b border-card-border flex justify-between items-center relative z-10">
        <h3 className="font-black text-lg text-white tracking-tight">{record.season} Season</h3>
        <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[10px] font-bold text-gray-300 uppercase tracking-widest">Historical</div>
      </div>

      <div className="px-6 py-2 relative z-10">
        <RecordRow
          icon={<Trophy size={18} />}
          label="Champion"
          primary={record.champion?.teamName ?? 'Season in progress'}
          secondary={
            record.champion
              ? `${record.champion.wins}–${record.champion.losses} · ${record.champion.pointsFor.toFixed(1)} pts`
              : undefined
          }
          accentBg="bg-[#F0F600]/10 border-[#F0F600]/20"
          accentText="text-[#F0F600] drop-shadow-[0_0_5px_rgba(240,246,0,0.8)]"
        />

        <RecordRow
          icon={<Skull size={18} />}
          label="Last Place"
          primary={record.lastPlace?.teamName ?? '—'}
          secondary={
            record.lastPlace
              ? `${record.lastPlace.wins}–${record.lastPlace.losses} · ${record.lastPlace.pointsFor.toFixed(1)} pts`
              : undefined
          }
          accentBg="bg-red-500/10 border-red-500/20"
          accentText="text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]"
        />

        <RecordRow
          icon={<TrendingUp size={18} />}
          label="Highest Scoring Team"
          primary={record.highestScoringTeam?.teamName ?? '—'}
          secondary={
            record.highestScoringTeam
              ? `${record.highestScoringTeam.pointsFor.toFixed(1)} pts for the season`
              : undefined
          }
          accentBg="bg-brand-green/10 border-brand-green/20"
          accentText="text-brand-green drop-shadow-[0_0_5px_rgba(185,251,192,0.8)]"
        />

        <RecordRow
          icon={<TrendingDown size={18} />}
          label="Lowest Scoring Team"
          primary={record.lowestScoringTeam?.teamName ?? '—'}
          secondary={
            record.lowestScoringTeam
              ? `${record.lowestScoringTeam.pointsFor.toFixed(1)} pts for the season`
              : undefined
          }
          accentBg="bg-orange-500/10 border-orange-500/20"
          accentText="text-orange-400 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]"
        />

        <RecordRow
          icon={<Zap size={18} />}
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
          accentBg="bg-brand-purple/10 border-brand-purple/20"
          accentText="text-brand-purple drop-shadow-[0_0_5px_rgba(176,132,233,0.8)]"
        />

        <RecordRow
          icon={<Star size={18} />}
          label="Highest Weekly Score"
          primary={record.highestWeeklyScore?.teamName ?? '—'}
          secondary={
            record.highestWeeklyScore
              ? `Wk ${record.highestWeeklyScore.week} · ${record.highestWeeklyScore.points.toFixed(2)} pts`
              : undefined
          }
          accentBg="bg-brand-cyan/10 border-brand-cyan/20"
          accentText="text-brand-cyan drop-shadow-[0_0_5px_rgba(0,229,255,0.8)]"
        />

        <RecordRow
          icon={<AlertTriangle size={18} />}
          label="Lowest Weekly Score"
          primary={record.lowestWeeklyScore?.teamName ?? '—'}
          secondary={
            record.lowestWeeklyScore
              ? `Wk ${record.lowestWeeklyScore.week} · ${record.lowestWeeklyScore.points.toFixed(2)} pts`
              : undefined
          }
          accentBg="bg-white/5 border-white/10"
          accentText="text-gray-400 drop-shadow-sm"
        />
      </div>
    </div>
  );
}

export function LeagueRecords({ data }: LeagueRecordsProps) {
  if (data.length === 0) {
    return (
      <div className="bg-card-bg border border-card-border border-dashed rounded-2xl p-8 text-center text-gray-500">
        No historical data available.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {data.map((record) => (
        <SeasonCard key={record.season} record={record} />
      ))}
    </div>
  );
}

import React from 'react';
