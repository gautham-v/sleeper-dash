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
    <div className="bg-gray-900 rounded-xl border border-gray-800/60 overflow-hidden">
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Trophy size={15} className="text-yellow-500" /> Standings
        </h3>
        <div className="flex gap-1 bg-gray-800/60 rounded-lg p-1">
          <button
            onClick={() => setMode('alltime')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              mode === 'alltime'
                ? 'bg-gray-700 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            All-Time
          </button>
          <button
            onClick={() => setMode('current')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              mode === 'current'
                ? 'bg-gray-700 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-300'
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
          <div className="p-8 text-center text-gray-500 text-sm">
            Loading all-time standings…
          </div>
        )
      ) : (
        <Standings standings={currentStandings} onSelectManager={onSelectManager} />
      )}
    </div>
  );
}
