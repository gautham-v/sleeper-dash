'use client';
import { Trophy, TrendingUp, TrendingDown, Zap, Star, AlertTriangle, Skull } from 'lucide-react';
import type { LeagueSeasonRecord } from '../types/sleeper';
import React from 'react';

interface LeagueRecordsProps {
  data: LeagueSeasonRecord[];
}

interface RecordRowProps {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary?: string;
}

function RecordRow({ icon, label, primary, secondary }: RecordRowProps) {
  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-border last:border-0">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</div>
        <div className="font-semibold text-white text-sm truncate leading-tight">{primary}</div>
        {secondary && <div className="text-xs text-muted-foreground mt-0.5 truncate">{secondary}</div>}
      </div>
    </div>
  );
}

function SeasonCard({ record }: { record: LeagueSeasonRecord }) {
  return (
    <div className="bg-card-bg rounded-xl border border-card-border overflow-hidden">
      <div className="px-3 py-2.5 bg-muted/40 border-b border-card-border">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">{record.season} Season</h3>
      </div>

      <div className="px-3 py-0.5">
        <RecordRow
          icon={<Trophy size={14} />}
          label="Champion"
          primary={record.champion?.teamName ?? 'Season in progress'}
          secondary={
            record.champion
              ? `${record.champion.wins}–${record.champion.losses} · ${record.champion.pointsFor.toFixed(1)} pts`
              : undefined
          }
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
              ? `${record.biggestBlowout.isPlayoff ? 'Playoffs' : `Wk ${record.biggestBlowout.week}`} · ${record.biggestBlowout.winnerPts.toFixed(2)}–${record.biggestBlowout.loserPts.toFixed(2)} (+${record.biggestBlowout.margin.toFixed(2)})`
              : undefined
          }
        />

        <RecordRow
          icon={<Star size={14} />}
          label="Highest Weekly Score"
          primary={record.highestWeeklyScore?.teamName ?? '—'}
          secondary={
            record.highestWeeklyScore
              ? `${record.highestWeeklyScore.isPlayoff ? 'Playoffs' : `Wk ${record.highestWeeklyScore.week}`} · ${record.highestWeeklyScore.points.toFixed(2)} pts`
              : undefined
          }
        />

        <RecordRow
          icon={<AlertTriangle size={14} />}
          label="Lowest Weekly Score"
          primary={record.lowestWeeklyScore?.teamName ?? '—'}
          secondary={
            record.lowestWeeklyScore
              ? `${record.lowestWeeklyScore.isPlayoff ? 'Playoffs' : `Wk ${record.lowestWeeklyScore.week}`} · ${record.lowestWeeklyScore.points.toFixed(2)} pts`
              : undefined
          }
        />
      </div>
    </div>
  );
}

export function LeagueRecords({ data }: LeagueRecordsProps) {
  if (data.length === 0) {
    return (
      <div className="bg-muted/50 rounded-xl p-8 text-center text-muted-foreground">
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
