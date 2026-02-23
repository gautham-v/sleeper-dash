import { useState, useMemo } from 'react';
import { Loader2, Trophy, Swords, TrendingUp, Shield } from 'lucide-react';
import { useLeagueHistory } from '../hooks/useLeagueData';
import { calcAllTimeStats, calcH2H } from '../utils/calculations';
import { Avatar } from './Avatar';
import type { TeamAllTimeStats, TeamTier } from '../types/sleeper';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Props {
  leagueId: string;
}

const TIER_STYLES: Record<TeamTier, { label: string; bg: string; text: string; border: string }> = {
  Elite:            { label: 'Elite',          bg: 'bg-foreground',   text: 'text-background', border: 'border-foreground'   },
  Contender:        { label: 'Contender',      bg: 'bg-muted',        text: 'text-foreground', border: 'border-border'       },
  Average:          { label: 'Average',        bg: 'bg-muted',        text: 'text-muted-foreground', border: 'border-border' },
  Rebuilding:       { label: 'Rebuilding',     bg: 'bg-muted',        text: 'text-muted-foreground', border: 'border-border' },
  'Cellar Dweller': { label: 'Cellar Dweller', bg: 'bg-muted',        text: 'text-muted-foreground', border: 'border-border' },
};

function TierBadge({ tier }: { tier: TeamTier }) {
  const s = TIER_STYLES[tier];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      <Shield size={10} />
      {s.label}
    </span>
  );
}

/** A simple horizontal bar comparing two values */
function CompareBar({ valueA, valueB, labelA, labelB }: { valueA: number; valueB: number; labelA: string; labelB: string }) {
  const total = valueA + valueB;
  const pctA = total > 0 ? (valueA / total) * 100 : 50;
  const pctB = 100 - pctA;
  const aLeads = valueA > valueB;
  const bLeads = valueB > valueA;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span className={aLeads ? 'text-foreground font-semibold' : ''}>{valueA}</span>
        <span className={bLeads ? 'text-foreground font-semibold' : ''}>{valueB}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden">
        <div
          className={`transition-all ${aLeads ? 'bg-foreground' : 'bg-foreground/25'}`}
          style={{ width: `${pctA}%` }}
        />
        <div
          className={`transition-all ${bLeads ? 'bg-foreground' : 'bg-foreground/25'}`}
          style={{ width: `${pctB}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span className="truncate max-w-[45%]">{labelA}</span>
        <span className="truncate max-w-[45%] text-right">{labelB}</span>
      </div>
    </div>
  );
}

function StatRow({ label, valueA, valueB, higherIsBetter = true }: {
  label: string;
  valueA: string | number;
  valueB: string | number;
  higherIsBetter?: boolean;
}) {
  const numA = typeof valueA === 'number' ? valueA : parseFloat(String(valueA));
  const numB = typeof valueB === 'number' ? valueB : parseFloat(String(valueB));
  const aWins = !isNaN(numA) && !isNaN(numB) && (higherIsBetter ? numA > numB : numA < numB);
  const bWins = !isNaN(numA) && !isNaN(numB) && (higherIsBetter ? numB > numA : numB < numA);

  return (
    <div className="flex items-center py-3 border-b border-border last:border-0">
      <div className={`w-1/3 text-right text-sm font-medium tabular-nums ${aWins ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
        {valueA}
      </div>
      <div className="w-1/3 text-center text-xs text-muted-foreground px-2">{label}</div>
      <div className={`w-1/3 text-left text-sm font-medium tabular-nums ${bWins ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
        {valueB}
      </div>
    </div>
  );
}

export function TeamComparison({ leagueId }: Props) {
  const [teamAId, setTeamAId] = useState<string>('');
  const [teamBId, setTeamBId] = useState<string>('');

  const { data: history, isLoading } = useLeagueHistory(leagueId);

  const allUsers = useMemo(() => {
    if (!history) return [];
    const seen = new Map<string, { userId: string; displayName: string; avatar: string | null }>();
    for (const season of history) {
      for (const [userId, team] of season.teams) {
        if (!seen.has(userId)) {
          seen.set(userId, { userId, displayName: team.displayName, avatar: team.avatar });
        } else {
          seen.get(userId)!.displayName = team.displayName;
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [history]);

  const allTimeStats = useMemo((): Map<string, TeamAllTimeStats> => {
    if (!history) return new Map();
    return calcAllTimeStats(history);
  }, [history]);

  const h2h = useMemo(() => {
    if (!history || !teamAId || !teamBId || teamAId === teamBId) return null;
    return calcH2H(history, teamAId, teamBId);
  }, [history, teamAId, teamBId]);

  const statsA = teamAId ? allTimeStats.get(teamAId) : null;
  const statsB = teamBId ? allTimeStats.get(teamBId) : null;

  const teamAInfo = allUsers.find((u) => u.userId === teamAId);
  const teamBInfo = allUsers.find((u) => u.userId === teamBId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading full league history…
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="bg-muted/50 rounded-xl p-8 text-center text-muted-foreground">
        No historical data available for this league.
      </div>
    );
  }

  const seasons = [...history].map((s) => s.season).sort();

  return (
    <div className="space-y-6">
      {/* Team selectors */}
      <div className="bg-card-bg rounded-xl p-5 border border-card-border">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Select Teams to Compare</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Team A</label>
            <Select value={teamAId} onValueChange={setTeamAId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="— Select team —" />
              </SelectTrigger>
              <SelectContent>
                {allUsers.map((u) => (
                  <SelectItem key={u.userId} value={u.userId} disabled={u.userId === teamBId}>
                    {u.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Team B</label>
            <Select value={teamBId} onValueChange={setTeamBId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="— Select team —" />
              </SelectTrigger>
              <SelectContent>
                {allUsers.map((u) => (
                  <SelectItem key={u.userId} value={u.userId} disabled={u.userId === teamAId}>
                    {u.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Prompt when not both selected */}
      {(!teamAId || !teamBId || teamAId === teamBId) && (
        <div className="bg-muted/50 rounded-xl p-8 text-center text-muted-foreground text-sm">
          Select two different teams above to see the comparison.
        </div>
      )}

      {/* Comparison content */}
      {teamAId && teamBId && teamAId !== teamBId && statsA && statsB && (
        <>
          {/* Team headers */}
          <div className="grid grid-cols-2 gap-3">
            {([{ info: teamAInfo, stats: statsA }, { info: teamBInfo, stats: statsB }] as const).map(
              ({ info, stats }, idx) => (
                <div key={idx} className="bg-card-bg rounded-xl p-3 sm:p-4 border border-card-border">
                  <div className="flex items-center gap-2 mb-2 min-w-0">
                    <Avatar avatar={info?.avatar ?? null} name={info?.displayName ?? ''} size="sm" />
                    <div className="font-bold text-white text-sm truncate min-w-0">
                      {info?.displayName}
                    </div>
                  </div>
                  <TierBadge tier={stats.tier} />
                  <div className="text-xs text-muted-foreground mt-1.5">
                    {stats.totalSeasons} season{stats.totalSeasons !== 1 ? 's' : ''} in league
                  </div>
                </div>
              ),
            )}
          </div>

          {/* Head-to-Head */}
          {h2h && (
            <div className="bg-card-bg rounded-xl p-5 border border-card-border">
              <div className="flex items-center gap-2 mb-4">
                <Swords size={16} className="text-muted-foreground" />
                <h3 className="font-semibold text-white">Head-to-Head</h3>
                <span className="text-xs text-muted-foreground ml-auto">
                  {h2h.games.length} matchup{h2h.games.length !== 1 ? 's' : ''} all-time
                </span>
              </div>

              {h2h.games.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  These teams have never faced each other.
                </p>
              ) : (
                <div className="space-y-4">
                  <CompareBar
                    valueA={h2h.teamAWins}
                    valueB={h2h.teamBWins}
                    labelA={`${teamAInfo?.displayName} Wins`}
                    labelB={`${teamBInfo?.displayName} Wins`}
                  />

                  {(h2h.playoffAWins > 0 || h2h.playoffBWins > 0) && (
                    <div className="flex items-center justify-between text-xs bg-yellow-500/5 border border-yellow-500/15 rounded-lg px-3 py-2">
                      <span className={`font-semibold tabular-nums ${h2h.playoffAWins > h2h.playoffBWins ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                        {h2h.playoffAWins}
                      </span>
                      <span className="text-yellow-500/80 text-center flex-1 text-center">🏆 Playoff record</span>
                      <span className={`font-semibold tabular-nums ${h2h.playoffBWins > h2h.playoffAWins ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                        {h2h.playoffBWins}
                      </span>
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-muted-foreground mb-1 text-center">Total Points Scored (H2H)</div>
                    <CompareBar
                      valueA={h2h.teamAPoints}
                      valueB={h2h.teamBPoints}
                      labelA={teamAInfo?.displayName ?? ''}
                      labelB={teamBInfo?.displayName ?? ''}
                    />
                  </div>

                  {/* Game log */}
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-2">All-time matchups</div>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {[...h2h.games].reverse().map((g, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${g.isPlayoff ? 'bg-yellow-500/5 border border-yellow-500/15' : 'bg-muted/30'}`}
                        >
                          <span className="text-xs w-24 shrink-0">
                            {g.isPlayoff ? (
                              <span className="text-yellow-500/80">{g.season} Playoffs</span>
                            ) : (
                              <span className="text-muted-foreground">{g.season} Wk {g.week}</span>
                            )}
                          </span>
                          <div className="flex items-center gap-2 flex-1 justify-center">
                            <span className={`tabular-nums font-medium ${g.winner === 'A' ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                              {g.teamAPoints}
                            </span>
                            <span className="text-muted-foreground/50 text-xs">vs</span>
                            <span className={`tabular-nums font-medium ${g.winner === 'B' ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                              {g.teamBPoints}
                            </span>
                          </div>
                          <span className="text-xs w-16 text-right">
                            {g.winner === 'A' ? (
                              <span className="text-foreground font-semibold">{teamAInfo?.displayName?.split(' ')[0]} W</span>
                            ) : g.winner === 'B' ? (
                              <span className="text-foreground font-semibold">{teamBInfo?.displayName?.split(' ')[0]} W</span>
                            ) : (
                              <span className="text-muted-foreground">Tie</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* All-time stats comparison */}
          <div className="bg-card-bg rounded-xl p-5 border border-card-border">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-muted-foreground" />
              <h3 className="font-semibold text-white">All-Time Stats</h3>
              <span className="text-xs text-muted-foreground ml-auto">
                Across {seasons.length} season{seasons.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center pb-2 mb-1 border-b border-border">
              <div className="w-1/3 text-right">
                <span className="text-xs font-semibold text-foreground truncate block">{teamAInfo?.displayName}</span>
              </div>
              <div className="w-1/3" />
              <div className="w-1/3 text-left">
                <span className="text-xs font-semibold text-foreground truncate block">{teamBInfo?.displayName}</span>
              </div>
            </div>

            <StatRow label="Total Wins" valueA={statsA.totalWins} valueB={statsB.totalWins} />
            <StatRow label="Total Losses" valueA={statsA.totalLosses} valueB={statsB.totalLosses} higherIsBetter={false} />
            <StatRow label="Win %" valueA={`${(statsA.winPct * 100).toFixed(1)}%`} valueB={`${(statsB.winPct * 100).toFixed(1)}%`} />
            <StatRow label="Avg Pts/Season" valueA={statsA.avgPointsFor.toFixed(1)} valueB={statsB.avgPointsFor.toFixed(1)} />
            <StatRow label="Titles 🏆" valueA={statsA.titles} valueB={statsB.titles} />
            <StatRow label="Seasons" valueA={statsA.totalSeasons} valueB={statsB.totalSeasons} />
            {(statsA.playoffWins + statsA.playoffLosses > 0 || statsB.playoffWins + statsB.playoffLosses > 0) && (
              <>
                <StatRow label="Playoff Wins" valueA={statsA.playoffWins} valueB={statsB.playoffWins} />
                <StatRow label="Playoff Losses" valueA={statsA.playoffLosses} valueB={statsB.playoffLosses} higherIsBetter={false} />
              </>
            )}

            <div className="mt-4">
              <CompareBar
                valueA={statsA.totalWins}
                valueB={statsB.totalWins}
                labelA={`${teamAInfo?.displayName} Wins`}
                labelB={`${teamBInfo?.displayName} Wins`}
              />
            </div>
          </div>

          {/* Season-by-season breakdown */}
          <div className="bg-card-bg rounded-xl overflow-hidden border border-card-border">
            <div className="flex items-center gap-2 px-5 pt-5 pb-3">
              <Trophy size={16} className="text-muted-foreground" />
              <h3 className="font-semibold text-white">Season-by-Season</h3>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                    <TableHead className="text-left py-3 px-5">Season</TableHead>
                    <TableHead className="text-center py-3 px-3 text-foreground">{teamAInfo?.displayName}</TableHead>
                    <TableHead className="text-center py-3 px-3 text-muted-foreground">Rank</TableHead>
                    <TableHead className="text-center py-3 px-3 text-foreground">{teamBInfo?.displayName}</TableHead>
                    <TableHead className="text-center py-3 px-3 text-muted-foreground">Rank</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seasons.map((season) => {
                    const sA = statsA.seasons.find((s) => s.season === season);
                    const sB = statsB.seasons.find((s) => s.season === season);
                    const aRecord = sA ? `${sA.wins}-${sA.losses}` : '—';
                    const bRecord = sB ? `${sB.wins}-${sB.losses}` : '—';
                    const aRankDisplay = sA ? (sA.rank === 1 ? '🏆 1st' : `${sA.rank}${['st','nd','rd'][sA.rank-1]||'th'}`) : '—';
                    const bRankDisplay = sB ? (sB.rank === 1 ? '🏆 1st' : `${sB.rank}${['st','nd','rd'][sB.rank-1]||'th'}`) : '—';
                    const aBetter = sA && sB && sA.rank < sB.rank;
                    const bBetter = sA && sB && sB.rank < sA.rank;

                    return (
                      <TableRow key={season} className="border-b border-border hover:bg-muted/40 transition-colors">
                        <TableCell className="py-3 px-5 text-muted-foreground font-medium">{season}</TableCell>
                        <TableCell className={`py-3 px-3 text-center font-semibold tabular-nums ${aBetter ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                          {aRecord}
                        </TableCell>
                        <TableCell className={`py-3 px-3 text-center text-xs ${aBetter ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {aRankDisplay}
                        </TableCell>
                        <TableCell className={`py-3 px-3 text-center font-semibold tabular-nums ${bBetter ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                          {bRecord}
                        </TableCell>
                        <TableCell className={`py-3 px-3 text-center text-xs ${bBetter ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {bRankDisplay}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="px-5 py-3 text-xs text-muted-foreground">
              Record reflects the full season (regular season + playoffs). 🏆 = won the championship.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
