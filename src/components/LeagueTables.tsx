import { useState, useMemo } from 'react';
import { ChevronDown, Trophy, TrendingUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Standings } from './Standings';
import { AllTimeStandings } from './AllTimeStandings';
import { LuckIndex } from './LuckIndex';
import { PowerRankings } from './PowerRankings';
import { Avatar } from './Avatar';
import { useLeagueHistory } from '../hooks/useLeagueData';
import {
  calcAllTimeStats, calcAllTimeLuckIndex, calcLuckIndex, calcPowerRankings,
} from '../utils/calculations';
import type { TeamStanding, LuckEntry } from '../types/sleeper';

interface LeagueTablesProps {
  computed: any;
  leagueId: string;
  onSelectManager?: (userId: string) => void;
}

function buildStandingsFromHistory(season: NonNullable<ReturnType<typeof useLeagueHistory>['data']>[number]): TeamStanding[] {
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
      pointsAgainst: 0,
      pointsForDecimal: 0,
    }))
    .sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor);
}

export function LeagueTables({ computed, leagueId, onSelectManager }: LeagueTablesProps) {
  const [selectedSeason, setSelectedSeason] = useState<string>('alltime');
  const { data: history } = useLeagueHistory(leagueId);

  const availableSeasons = useMemo(() => {
    if (!history) return [];
    return [...history].map((s) => s.season).sort((a, b) => Number(b) - Number(a));
  }, [history]);

  const currentSeasonYear = history?.[history.length - 1]?.season;

  const allTimeStats = useMemo(() => {
    if (!history) return [];
    return Array.from(calcAllTimeStats(history).values());
  }, [history]);

  const allTimeLuck = useMemo(() => {
    if (!history) return [];
    return calcAllTimeLuckIndex(history);
  }, [history]);

  const allTimeRankings = useMemo(() => {
    if (!history) return [];
    const stats = calcAllTimeStats(history);
    return [...stats.values()].sort((a, b) => {
      if (b.titles !== a.titles) return b.titles - a.titles;
      return b.winPct - a.winPct;
    });
  }, [history]);

  const seasonData = useMemo(() => {
    if (selectedSeason === 'alltime' || !history) return null;
    return history.find((s) => s.season === selectedSeason) ?? null;
  }, [history, selectedSeason]);

  const seasonStandings = useMemo((): TeamStanding[] | null => {
    if (!seasonData) return null;
    return buildStandingsFromHistory(seasonData);
  }, [seasonData]);

  const seasonLuck = useMemo((): LuckEntry[] | null => {
    if (!seasonData || !seasonStandings) return null;
    const regular = seasonData.matchups.filter((m) => !m.isPlayoff);
    return calcLuckIndex(regular, seasonStandings);
  }, [seasonData, seasonStandings]);

  const seasonRankings = useMemo(() => {
    if (!seasonData || !seasonStandings) return null;
    const regular = seasonData.matchups.filter((m) => !m.isPlayoff);
    const maxWeek = regular.length > 0 ? Math.max(...regular.map((m) => m.week)) : 14;
    return calcPowerRankings(regular, seasonStandings, maxWeek);
  }, [seasonData, seasonStandings]);

  const isCurrentSeason = selectedSeason === currentSeasonYear;

  const displayStandings = selectedSeason === 'alltime'
    ? null
    : (isCurrentSeason ? computed.standings : seasonStandings) ?? [];

  const displayLuck: LuckEntry[] = selectedSeason === 'alltime'
    ? allTimeLuck
    : (isCurrentSeason ? computed.luckIndex : seasonLuck) ?? [];

  const displayRankings = selectedSeason === 'alltime'
    ? null
    : (isCurrentSeason ? computed.powerRankings : seasonRankings) ?? [];

  const selectedLabel = selectedSeason === 'alltime' ? 'All-Time' : selectedSeason;

  return (
    <Tabs defaultValue="standings" className="bg-card-bg rounded-xl border border-card-border overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5">
        <TabsList className="bg-muted rounded-lg p-1 h-auto gap-0">
          <TabsTrigger
            value="rankings"
            className="px-3 py-1 rounded-md text-xs font-medium h-auto
              data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm
              text-muted-foreground hover:text-foreground"
          >
            Rankings
          </TabsTrigger>
          <TabsTrigger
            value="standings"
            className="px-3 py-1 rounded-md text-xs font-medium h-auto
              data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm
              text-muted-foreground hover:text-foreground"
          >
            Standings
          </TabsTrigger>
          <TabsTrigger
            value="luck"
            className="px-3 py-1 rounded-md text-xs font-medium h-auto
              data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm
              text-muted-foreground hover:text-foreground"
          >
            Luck Index
          </TabsTrigger>
        </TabsList>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7 border-card-border text-muted-foreground hover:text-foreground"
            >
              {selectedLabel} <ChevronDown size={11} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[120px]">
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

      <TabsContent value="rankings" className="mt-0 pt-4">
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          {selectedSeason === 'alltime' ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                Ranked by championships, then win percentage
              </p>
              {allTimeRankings.map((mgr, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                return (
                  <div key={mgr.userId} className="flex items-center gap-2.5 bg-muted/40 rounded-xl px-3 py-2.5">
                    <span className="text-sm w-5 text-center flex-shrink-0">
                      {medal ?? <span className="text-muted-foreground text-xs font-medium">{idx + 1}</span>}
                    </span>
                    <Avatar avatar={mgr.avatar} name={mgr.displayName} size="sm" />
                    <button
                      className="flex-1 min-w-0 text-left group"
                      onClick={() => mgr.userId && onSelectManager?.(mgr.userId)}
                      disabled={!mgr.userId || !onSelectManager}
                    >
                      <div className="font-semibold text-white text-sm truncate group-hover:text-muted-foreground transition-colors">
                        {mgr.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {mgr.totalWins}–{mgr.totalLosses} · {mgr.totalSeasons} season{mgr.totalSeasons !== 1 ? 's' : ''}
                      </div>
                    </button>
                    {mgr.titles > 0 && (
                      <div className="flex items-center gap-1 bg-muted border border-border rounded-lg px-2 py-0.5 flex-shrink-0">
                        <Trophy size={10} className="text-yellow-500" />
                        <span className="text-foreground font-bold text-xs">{mgr.titles}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <TrendingUp size={11} className="text-brand-cyan" />
                      <span className="text-brand-cyan font-bold text-sm tabular-nums">
                        {(mgr.winPct * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
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

      <TabsContent value="standings" className="mt-0 pt-4 overflow-x-auto">
        {selectedSeason === 'alltime' ? (
          allTimeStats.length > 0 ? (
            <AllTimeStandings stats={allTimeStats} onSelectManager={onSelectManager} />
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          )
        ) : displayStandings && displayStandings.length > 0 ? (
          <Standings standings={displayStandings} onSelectManager={onSelectManager} />
        ) : (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        )}
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
