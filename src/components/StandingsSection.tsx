import { useState, useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { Standings } from './Standings';
import { AllTimeStandings } from './AllTimeStandings';
import { useLeagueHistory } from '../hooks/useLeagueData';
import { calcAllTimeStats } from '../utils/calculations';
import type { TeamStanding } from '../types/sleeper';

interface StandingsSectionProps {
  currentStandings: TeamStanding[];
  leagueId: string;
  onSelectManager?: (userId: string) => void;
}

type StandingsMode = 'alltime' | 'current';

export function StandingsSection({ currentStandings, leagueId, onSelectManager }: StandingsSectionProps) {
  const [mode, setMode] = useState<StandingsMode>('alltime');
  const { data: history } = useLeagueHistory(leagueId);

  const allTimeStats = useMemo(() => {
    if (!history) return [];
    return Array.from(calcAllTimeStats(history).values());
  }, [history]);

  return (
    <div className="bg-card-bg rounded-xl border border-card-border overflow-hidden">
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-card-border">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Trophy size={15} className="text-yellow-500" /> Standings
        </h3>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setMode('alltime')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              mode === 'alltime'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All-Time
          </button>
          <button
            onClick={() => setMode('current')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              mode === 'current'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            This Season
          </button>
        </div>
      </div>

      {mode === 'alltime' ? (
        allTimeStats.length > 0 ? (
          <AllTimeStandings stats={allTimeStats} onSelectManager={onSelectManager} />
        ) : (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Loading all-time standings…
          </div>
        )
      ) : (
        <Standings standings={currentStandings} onSelectManager={onSelectManager} />
      )}
    </div>
  );
}
