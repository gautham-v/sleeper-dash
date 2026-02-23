import { useState, useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

export function StandingsSection({ currentStandings, leagueId, onSelectManager }: StandingsSectionProps) {
  const [mode, setMode] = useState<'alltime' | 'current'>('alltime');
  const { data: history } = useLeagueHistory(leagueId);

  const allTimeStats = useMemo(() => {
    if (!history) return [];
    return Array.from(calcAllTimeStats(history).values());
  }, [history]);

  return (
    <section>
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'alltime' | 'current')}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Trophy size={16} className="text-yellow-500" /> Standings
          </h3>
          <TabsList className="bg-gray-800 h-auto p-0.5">
            <TabsTrigger value="alltime" className="px-3 py-1.5 text-xs rounded-md data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              All-Time
            </TabsTrigger>
            <TabsTrigger value="current" className="px-3 py-1.5 text-xs rounded-md data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              This Season
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="alltime">
          {allTimeStats.length > 0 ? (
            <AllTimeStandings stats={allTimeStats} onSelectManager={onSelectManager} />
          ) : (
            <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500 text-sm">
              Loading all-time standings…
            </div>
          )}
        </TabsContent>

        <TabsContent value="current">
          <Standings standings={currentStandings} onSelectManager={onSelectManager} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
