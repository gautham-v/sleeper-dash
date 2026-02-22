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
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Trophy size={16} className="text-yellow-500" /> Standings
        </h3>
        <div className="flex items-center bg-gray-800 rounded-lg p-0.5 text-xs font-medium">
          <button
            onClick={() => setMode('alltime')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              mode === 'alltime'
                ? 'bg-gray-700 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            All-Time
          </button>
          <button
            onClick={() => setMode('current')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              mode === 'current'
                ? 'bg-gray-700 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
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
          <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500 text-sm">
            Loading all-time standings…
          </div>
        )
      ) : (
        <Standings standings={currentStandings} onSelectManager={onSelectManager} />
      )}
    </section>
  );
}
