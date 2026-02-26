'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronDown, Shuffle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Standings } from './Standings';
import { AllTimeStandings } from './AllTimeStandings';
import { PowerRankings } from './PowerRankings';
import { LuckIndex } from './LuckIndex';
import { useLeagueHistory } from '../hooks/useLeagueData';
import { useLeagueDraftHistory } from '../hooks/useLeagueDraftHistory';
import {
  calcAllTimeStats, calcAllTimeLuckIndex, calcLuckIndex, calcPowerRankings,
} from '../utils/calculations';
import type { TeamStanding, LuckEntry } from '../types/sleeper';

interface LeagueTablesProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  computed: any;
  leagueId: string;
  onSelectManager?: (userId: string) => void;
}

function buildStandingsFromHistory(season: NonNullable<ReturnType<typeof useLeagueHistory>['data']>[number]): TeamStanding[] {
  // Compute playoff W/L records from matchup data
  const playoffMatchups = season.matchups.filter((m) => m.isPlayoff);
  const playoffRecordsMap = new Map<number, { wins: number; losses: number }>();
  for (const m of playoffMatchups) {
    if (m.team1.points === 0 && m.team2.points === 0) continue;
    const [winner, loser] = m.team1.points >= m.team2.points ? [m.team1, m.team2] : [m.team2, m.team1];
    const wRec = playoffRecordsMap.get(winner.rosterId) ?? { wins: 0, losses: 0 };
    wRec.wins++;
    playoffRecordsMap.set(winner.rosterId, wRec);
    const lRec = playoffRecordsMap.get(loser.rosterId) ?? { wins: 0, losses: 0 };
    lRec.losses++;
    playoffRecordsMap.set(loser.rosterId, lRec);
  }

  return Array.from(season.teams.values())
    .map((team) => ({
      rosterId: team.rosterId,
      userId: team.userId,
      teamName: team.teamName,
      displayName: team.displayName,
      avatar: team.avatar,
      wins: team.wins,
      losses: team.losses,
      ties: 0,
      pointsFor: team.pointsFor,
      pointsAgainst: team.pointsAgainst,
      pointsForDecimal: 0,
      streak: team.streak,
      playoffWins: playoffRecordsMap.get(team.rosterId)?.wins,
      playoffLosses: playoffRecordsMap.get(team.rosterId)?.losses,
    }))
    .sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor);
}

export function LeagueTables({ computed, leagueId, onSelectManager }: LeagueTablesProps) {
  const [selectedSeason, setSelectedSeason] = useState<string>('alltime');
  const [activeLeagueTab, setActiveLeagueTab] = useState<string>('standings');
  const [showDraftDelta, setShowDraftDelta] = useState(false);
  const [draftDeltaSort, setDraftDeltaSort] = useState(false);
  const [draftUnlocked, setDraftUnlocked] = useState(false);
  const { data: history } = useLeagueHistory(leagueId);
  const draftHistory = useLeagueDraftHistory(draftUnlocked ? leagueId : null);

  const availableSeasons = useMemo(() => {
    if (!history) return [];
    return [...history].map((s) => s.season).sort((a, b) => Number(b) - Number(a));
  }, [history]);

  const currentSeasonYear = history?.[history.length - 1]?.season;

  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current && currentSeasonYear) {
      hasInitialized.current = true;
      setSelectedSeason(currentSeasonYear);
    }
  }, [currentSeasonYear]);

  const allTimeStats = useMemo(() => {
    if (!history) return [];
    return Array.from(calcAllTimeStats(history).values());
  }, [history]);

  const allTimeLuck = useMemo(() => {
    if (!history) return [];
    return calcAllTimeLuckIndex(history);
  }, [history]);

  const seasonData = useMemo(() => {
    if (selectedSeason === 'alltime' || !history) return null;
    return history.find((s) => s.season === selectedSeason) ?? null;
  }, [history, selectedSeason]);

  const seasonStandings = useMemo((): TeamStanding[] | null => {
    if (!seasonData) return null;
    return buildStandingsFromHistory(seasonData);
  }, [seasonData]);

  const seasonRankings = useMemo(() => {
    if (!seasonData || !seasonStandings) return null;
    const regular = seasonData.matchups.filter((m) => !m.isPlayoff);
    const maxWeek = regular.length > 0 ? Math.max(...regular.map((m) => m.week)) : 14;
    return calcPowerRankings(regular, seasonStandings, maxWeek);
  }, [seasonData, seasonStandings]);

  const seasonLuck = useMemo((): LuckEntry[] | null => {
    if (!seasonData || !seasonStandings) return null;
    const regular = seasonData.matchups.filter((m) => !m.isPlayoff);
    return calcLuckIndex(regular, seasonStandings);
  }, [seasonData, seasonStandings]);

  const isCurrentSeason = selectedSeason === currentSeasonYear;

  const displayLuck: LuckEntry[] = selectedSeason === 'alltime'
    ? allTimeLuck
    : (isCurrentSeason ? computed.luckIndex : seasonLuck) ?? [];

  const displayStandings = selectedSeason === 'alltime'
    ? null
    : (isCurrentSeason ? computed.standings : seasonStandings) ?? [];

  const sortedDisplayStandings = useMemo((): TeamStanding[] | null => {
    if (!displayStandings) return null;
    if (!draftDeltaSort || !draftHistory.data) return displayStandings;
    return [...displayStandings].sort((a, b) => {
      const sa = draftHistory.data!.surplusByUserId.get(a.userId) ?? -Infinity;
      const sb = draftHistory.data!.surplusByUserId.get(b.userId) ?? -Infinity;
      return sb - sa;
    });
  }, [displayStandings, draftDeltaSort, draftHistory.data]);

  function handleToggleDraftDelta() {
    if (!showDraftDelta) {
      setDraftUnlocked(true);
      setShowDraftDelta(true);
    } else {
      setShowDraftDelta(false);
      setDraftDeltaSort(false);
    }
  }

  const displayRankings = selectedSeason === 'alltime'
    ? null
    : (isCurrentSeason ? computed.powerRankings : seasonRankings) ?? [];

  const selectedLabel = selectedSeason === 'alltime' ? 'All-Time' : selectedSeason;

  return (
    <Tabs defaultValue="standings" className="bg-card-bg rounded-xl border border-card-border overflow-hidden" onValueChange={(value) => {
      setActiveLeagueTab(value);
      if (value === 'rankings' && selectedSeason === 'alltime' && availableSeasons.length > 0) {
        setSelectedSeason(availableSeasons[0]); // most recent season
      }
    }}>
      <div className="flex items-center gap-2 px-4 sm:px-5 pt-4 sm:pt-5 flex-wrap">
        <TabsList className="bg-muted rounded-lg p-1 h-auto gap-0">
          <TabsTrigger
            value="standings"
            className="px-2.5 sm:px-3 py-1 rounded-md text-xs font-medium h-auto
              data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm
              text-muted-foreground hover:text-foreground"
          >
            Standings
          </TabsTrigger>
          <TabsTrigger
            value="rankings"
            className="px-2.5 sm:px-3 py-1 rounded-md text-xs font-medium h-auto
              data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm
              text-muted-foreground hover:text-foreground"
          >
            Rankings
          </TabsTrigger>
          <TabsTrigger
            value="luck"
            className="px-2.5 sm:px-3 py-1 rounded-md text-xs font-medium h-auto
              data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm
              text-muted-foreground hover:text-foreground"
          >
            <span className="sm:hidden">Luck</span>
            <span className="hidden sm:inline">Luck Index</span>
          </TabsTrigger>
        </TabsList>

        {/* Draft Delta toggle — only visible on standings tab, non-alltime view */}
        {activeLeagueTab === 'standings' && selectedSeason !== 'alltime' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleDraftDelta}
            className={`gap-1.5 text-xs h-7 border-card-border hover:text-foreground hidden sm:flex ${
              showDraftDelta
                ? 'border-brand-cyan/50 text-brand-cyan bg-brand-cyan/5'
                : 'text-muted-foreground'
            }`}
            title="Toggle draft surplus column"
          >
            <Shuffle size={11} />
            Draft Δ
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7 border-card-border text-muted-foreground hover:text-foreground ml-auto"
            >
              {selectedLabel} <ChevronDown size={11} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" collisionPadding={8} className="min-w-[120px]">
            <DropdownMenuItem
              className={selectedSeason === 'alltime' ? 'text-brand-cyan' : ''}
              onClick={() => setSelectedSeason('alltime')}
            >
              All-Time
            </DropdownMenuItem>
            {availableSeasons.map((season) => (
              <DropdownMenuItem
                key={season}
                className={selectedSeason === season ? 'text-brand-cyan' : ''}
                onClick={() => setSelectedSeason(season)}
              >
                {season}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <TabsContent value="standings" className="mt-0 pt-4 overflow-x-auto">
        {selectedSeason === 'alltime' ? (
          allTimeStats.length > 0 ? (
            <AllTimeStandings stats={allTimeStats} onSelectManager={onSelectManager} />
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          )
        ) : sortedDisplayStandings && sortedDisplayStandings.length > 0 ? (
          <Standings
            standings={sortedDisplayStandings}
            onSelectManager={onSelectManager}
            draftSurplusByUserId={draftHistory.data?.surplusByUserId}
            showDraftDelta={showDraftDelta}
            draftDeltaSorted={draftDeltaSort}
            onDraftDeltaSort={() => setDraftDeltaSort((s) => !s)}
          />
        ) : (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        )}
      </TabsContent>

      <TabsContent value="rankings" className="mt-0 pt-4">
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          {selectedSeason === 'alltime' ? (
            <div className="py-10 text-center space-y-2 px-4">
              <div className="text-sm text-muted-foreground">Power Rankings are calculated per season.</div>
              <div className="text-xs text-muted-foreground">
                Select a season above to see power rankings, or{' '}
                <Link href={`/league/${leagueId}/managers`} className="text-brand-cyan hover:text-brand-cyan/80 transition-colors">
                  view all-time standings on the Managers page
                </Link>.
              </div>
            </div>
          ) : displayRankings && displayRankings.length > 0 ? (
            <PowerRankings
              rankings={displayRankings}
              standings={displayStandings ?? []}
              onSelectManager={onSelectManager}
            />
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No power rankings data available
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="luck" className="mt-0 pt-4">
        {displayLuck.length > 0 ? (
          <LuckIndex entries={displayLuck} onSelectManager={onSelectManager} />
        ) : (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No luck data available
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
