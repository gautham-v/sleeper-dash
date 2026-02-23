import { useMemo, useState } from 'react';
import { Loader2, Trophy, Skull, ChevronLeft, TrendingUp, TrendingDown, Swords, Star, Award } from 'lucide-react';
import { useLeagueHistory } from '../hooks/useLeagueData';
import { calcAllTimeStats, calcH2H, calcAllTimeRecords } from '../utils/calculations';
import { Avatar } from './Avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';

interface Props {
  leagueId: string;
  userId: string;
  onBack: () => void;
  onSelectManager?: (userId: string) => void;
}

export function ManagerProfile({ leagueId, userId, onBack, onSelectManager }: Props) {
  const [activeSection, setActiveSection] = useState<'overview' | 'h2h' | 'seasons'>('overview');
  const { data: history, isLoading } = useLeagueHistory(leagueId);

  const allStats = useMemo(() => {
    if (!history) return new Map();
    return calcAllTimeStats(history);
  }, [history]);

  const records = useMemo(() => {
    if (!history) return [];
    return calcAllTimeRecords(history);
  }, [history]);

  const stats = allStats.get(userId);

  // All users (for H2H section)
  const allUsers = useMemo(() => {
    if (!history) return [];
    const seen = new Map<string, { userId: string; displayName: string; avatar: string | null }>();
    for (const season of history) {
      for (const [uid, team] of season.teams) {
        seen.set(uid, { userId: uid, displayName: team.displayName, avatar: team.avatar });
      }
    }
    return [...seen.values()].filter(u => u.userId !== userId).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [history, userId]);

  // H2H vs every other manager
  const h2hRecords = useMemo(() => {
    if (!history || !userId) return [];
    return allUsers.map((opponent) => {
      const h2h = calcH2H(history, userId, opponent.userId);
      const total = h2h.teamAWins + h2h.teamBWins;
      return { opponent, wins: h2h.teamAWins, losses: h2h.teamBWins, total, winPct: total > 0 ? h2h.teamAWins / total : 0, playoffWins: h2h.playoffAWins, playoffLosses: h2h.playoffBWins };
    }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
  }, [history, userId, allUsers]);

  // Last-place finishes
  const lastPlaceFinishes = useMemo(() => {
    if (!history) return [];
    const lp: string[] = [];
    for (const season of history) {
      let maxRank = 0;
      let lpUserId: string | null = null;
      for (const [uid, team] of season.teams) {
        if (team.rank > maxRank) { maxRank = team.rank; lpUserId = uid; }
      }
      if (lpUserId === userId) lp.push(season.season);
    }
    return lp;
  }, [history, userId]);

  // Championship years
  const champYears = useMemo(() => {
    if (!history) return [];
    return history.filter(s => s.championUserId === userId).map(s => s.season).sort();
  }, [history, userId]);

  // Records held by this manager
  const myRecords = useMemo(() => records.filter(r => r.holderId === userId), [records, userId]);

  // Map of season year -> playoff finish label for this user
  const playoffFinishBySeason = useMemo(() => {
    if (!history) return new Map<string, string>();
    const m = new Map<string, string>();
    for (const h of history) {
      const finish = h.playoffFinishByUserId.get(userId);
      if (finish) m.set(h.season, finish);
    }
    return m;
  }, [history, userId]);

  // Numeric weight for sorting: lower = better playoff outcome
  function playoffFinishWeight(finish: string | undefined): number {
    switch (finish) {
      case 'Won Championship': return 1;
      case 'Runner-Up':        return 2;
      case '3rd Place':        return 3;
      case '4th Place':        return 4;
      case '5th Place':        return 5;
      case '6th Place':        return 6;
      case 'Lost Semi-Final':  return 7;
      case 'Lost in Playoffs': return 8;
      default:                 return 9; // Did not qualify / no data
    }
  }

  // Best / worst season: sort by playoff outcome first, then regular-season rank, then W-L
  const { bestSeason, worstSeason } = useMemo(() => {
    if (!stats || stats.seasons.length === 0) return { bestSeason: null, worstSeason: null };
    const sorted = [...stats.seasons].sort((a, b) => {
      const wA = playoffFinishWeight(playoffFinishBySeason.get(a.season));
      const wB = playoffFinishWeight(playoffFinishBySeason.get(b.season));
      if (wA !== wB) return wA - wB;
      if (a.rank !== b.rank) return a.rank - b.rank;
      const pctA = a.wins / (a.wins + a.losses || 1);
      const pctB = b.wins / (b.wins + b.losses || 1);
      return pctB - pctA || b.wins - a.wins;
    });
    return { bestSeason: sorted[0], worstSeason: sorted[sorted.length - 1] };
  }, [stats, playoffFinishBySeason]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-brand-cyan">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading manager profile…
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-gray-900 rounded-2xl p-8 text-center text-gray-500">
        Manager not found.
      </div>
    );
  }

  const winPct = `${(stats.winPct * 100).toFixed(1)}%`;
  const totalGames = stats.totalWins + stats.totalLosses;
  const allTimePts = stats.seasons.reduce((sum: number, s: { pointsFor: number }) => sum + s.pointsFor, 0);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onBack} className="flex items-center gap-1.5 text-gray-400 hover:text-white px-0">
        <ChevronLeft size={16} /> Back to Managers
      </Button>

      {/* Profile header */}
      <Card className="bg-card-bg border-card-border rounded-2xl">
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <Avatar avatar={stats.avatar} name={stats.displayName} size="xl" />
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-white leading-tight">{stats.displayName}</h2>
              <div className="text-sm text-gray-400 mt-1">{stats.totalSeasons} season{stats.totalSeasons !== 1 ? 's' : ''} in the league</div>

              {/* Key stats row */}
              <div className="flex flex-wrap gap-4 mt-4">
                <div>
                  <div className="text-xl font-bold text-brand-cyan tabular-nums">{winPct}</div>
                  <div className="text-xs text-gray-500">Win Rate</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white tabular-nums">{stats.totalWins}–{stats.totalLosses}</div>
                  <div className="text-xs text-gray-500">Career Record ({totalGames} games)</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-yellow-400 tabular-nums">{champYears.length}</div>
                  <div className="text-xs text-gray-500">Championship{champYears.length !== 1 ? 's' : ''}</div>
                </div>
                {(stats.playoffWins > 0 || stats.playoffLosses > 0) && (
                  <div>
                    <div className="text-xl font-bold text-yellow-500 tabular-nums">{stats.playoffWins}–{stats.playoffLosses}</div>
                    <div className="text-xs text-gray-500">Playoff Record</div>
                  </div>
                )}
                <div>
                  <div className="text-xl font-bold text-white tabular-nums">{allTimePts.toFixed(0)}</div>
                  <div className="text-xs text-gray-500">All-Time Points</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section tabs */}
      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as 'overview' | 'h2h' | 'seasons')}>
        <TabsList className="bg-card-bg border border-card-border">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="h2h">Head-to-Head</TabsTrigger>
          <TabsTrigger value="seasons">Season Log</TabsTrigger>
        </TabsList>

        {/* OVERVIEW SECTION */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Championships */}
          {champYears.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={16} className="text-yellow-400" />
                <span className="font-semibold text-yellow-400">Championships</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {champYears.map((y) => (
                  <span key={y} className="bg-yellow-900/40 border border-yellow-700/40 text-yellow-300 font-bold px-3 py-1.5 rounded-lg text-sm">
                    🏆 {y}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Last-place finishes */}
          {lastPlaceFinishes.length > 0 && (
            <div className="bg-red-900/20 border border-red-700/40 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Skull size={16} className="text-red-400" />
                <span className="font-semibold text-red-400">Last-Place Finishes</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {lastPlaceFinishes.map((y) => (
                  <span key={y} className="bg-red-900/40 border border-red-700/40 text-red-300 font-bold px-3 py-1.5 rounded-lg text-sm">
                    💀 {y}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Best / Worst season */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bestSeason && (
              <div className="bg-green-900/20 border border-green-700/40 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={14} className="text-green-400" />
                  <span className="text-xs font-semibold text-green-400 uppercase tracking-wide">Best Season</span>
                </div>
                <div className="text-2xl font-bold text-white">{bestSeason.season}</div>
                <div className="text-sm text-gray-300 mt-1">{bestSeason.wins}–{bestSeason.losses} · #{bestSeason.rank} in regular season</div>
                {playoffFinishBySeason.get(bestSeason.season) && (
                  <div className="text-xs text-green-300 mt-1 font-medium">
                    {playoffFinishBySeason.get(bestSeason.season)}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-0.5">{bestSeason.pointsFor.toFixed(1)} pts</div>
              </div>
            )}
            {worstSeason && bestSeason?.season !== worstSeason.season && (
              <div className="bg-red-900/10 border border-red-700/30 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown size={14} className="text-red-400" />
                  <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">Worst Season</span>
                </div>
                <div className="text-2xl font-bold text-white">{worstSeason.season}</div>
                <div className="text-sm text-gray-300 mt-1">{worstSeason.wins}–{worstSeason.losses} · #{worstSeason.rank} in regular season</div>
                {playoffFinishBySeason.get(worstSeason.season) && (
                  <div className="text-xs text-red-300 mt-1 font-medium">
                    {playoffFinishBySeason.get(worstSeason.season)}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-0.5">{worstSeason.pointsFor.toFixed(1)} pts</div>
              </div>
            )}
          </div>

          {/* Records held */}
          {myRecords.length > 0 && (
            <div className="bg-card-bg border border-card-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Award size={16} className="text-brand-cyan" />
                <span className="font-semibold text-white">League Records Held</span>
              </div>
              <div className="space-y-3">
                {myRecords.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white">{r.category}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{r.context}</div>
                    </div>
                    <div className="text-sm font-bold text-brand-cyan flex-shrink-0 ml-4">{r.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* H2H SECTION */}
        <TabsContent value="h2h" className="mt-4">
          <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <Swords size={16} className="text-gray-400" />
                <h3 className="font-semibold text-white">Head-to-Head vs. Every Manager</h3>
              </div>
            </div>
            {h2hRecords.length === 0 ? (
              <div className="px-5 pb-5 text-sm text-gray-500">No H2H matchup data available.</div>
            ) : (() => {
              const hasPlayoffH2H = h2hRecords.some(r => r.playoffWins > 0 || r.playoffLosses > 0);
              return (
                <>
                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-gray-800/60">
                    {h2hRecords.map(({ opponent, wins, losses, total, winPct, playoffWins, playoffLosses }) => {
                      const wPct = winPct * 100;
                      return (
                        <button
                          key={opponent.userId}
                          className="w-full text-left px-4 py-3.5 hover:bg-gray-800/30 transition-colors flex items-center gap-3 disabled:cursor-default"
                          onClick={() => onSelectManager?.(opponent.userId)}
                          disabled={!onSelectManager}
                        >
                          <Avatar avatar={opponent.avatar} name={opponent.displayName} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white text-sm truncate">{opponent.displayName}</div>
                            {hasPlayoffH2H && (playoffWins > 0 || playoffLosses > 0) && (
                              <div className="text-xs text-yellow-400/80 mt-0.5">
                                Playoffs: {playoffWins}–{playoffLosses}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 text-right">
                            <div className="text-sm">
                              <span className="text-green-400 font-bold tabular-nums">{wins}</span>
                              <span className="text-gray-600 mx-0.5">–</span>
                              <span className="text-red-400 font-bold tabular-nums">{losses}</span>
                            </div>
                            <span className={`text-sm font-semibold tabular-nums w-10 ${wPct >= 50 ? 'text-brand-cyan' : 'text-gray-400'}`}>
                              {wPct.toFixed(0)}%
                            </span>
                            <span className="text-xs text-gray-500 tabular-nums w-6">{total}g</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
                          <TableHead className="text-left py-3 px-5">Opponent</TableHead>
                          <TableHead className="text-center py-3 px-3">W</TableHead>
                          <TableHead className="text-center py-3 px-3">L</TableHead>
                          <TableHead className="text-center py-3 px-3">Win %</TableHead>
                          {hasPlayoffH2H && <TableHead className="text-center py-3 px-3 text-yellow-500/70">Playoffs</TableHead>}
                          <TableHead className="text-right py-3 px-5">Games</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {h2hRecords.map(({ opponent, wins, losses, total, winPct, playoffWins, playoffLosses }) => {
                          const wPct = winPct * 100;
                          return (
                            <TableRow key={opponent.userId} className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors">
                              <TableCell className="py-3 px-5">
                                <button
                                  className="flex items-center gap-2 group text-left"
                                  onClick={() => onSelectManager?.(opponent.userId)}
                                  disabled={!onSelectManager}
                                >
                                  <Avatar avatar={opponent.avatar} name={opponent.displayName} size="sm" />
                                  <span className={`font-medium ${onSelectManager ? 'text-white group-hover:text-brand-cyan transition-colors' : 'text-white'}`}>
                                    {opponent.displayName}
                                  </span>
                                </button>
                              </TableCell>
                              <TableCell className="py-3 px-3 text-center font-bold text-green-400 tabular-nums">{wins}</TableCell>
                              <TableCell className="py-3 px-3 text-center font-bold text-red-400 tabular-nums">{losses}</TableCell>
                              <TableCell className="py-3 px-3 text-center">
                                <span className={`font-semibold tabular-nums ${wPct >= 50 ? 'text-brand-cyan' : 'text-gray-400'}`}>
                                  {wPct.toFixed(0)}%
                                </span>
                              </TableCell>
                              {hasPlayoffH2H && (
                                <TableCell className="py-3 px-3 text-center">
                                  {(playoffWins > 0 || playoffLosses > 0) ? (
                                    <span className="text-xs font-semibold text-yellow-400 tabular-nums">{playoffWins}–{playoffLosses}</span>
                                  ) : (
                                    <span className="text-xs text-gray-700">—</span>
                                  )}
                                </TableCell>
                              )}
                              <TableCell className="py-3 px-5 text-right text-gray-500 tabular-nums">{total}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              );
            })()}
          </div>
        </TabsContent>

        {/* SEASONS SECTION */}
        <TabsContent value="seasons" className="mt-4">
          <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <Star size={16} className="text-gray-400" />
                <h3 className="font-semibold text-white">Season-by-Season Log</h3>
              </div>
            </div>
            {(() => {
              const sortedSeasons = [...stats.seasons].sort((a, b) => Number(b.season) - Number(a.season));
              const hasPlayoffData = sortedSeasons.some(s => s.playoffWins > 0 || s.playoffLosses > 0);
              return (
                <>
                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-gray-800/60">
                    {sortedSeasons.map((s) => {
                      const isChamp = champYears.includes(s.season);
                      const isLP = lastPlaceFinishes.includes(s.season);
                      return (
                        <div key={s.season} className="px-4 py-3.5 flex items-center gap-3">
                          <div className="w-12 flex-shrink-0">
                            <div className="font-bold text-white text-sm">{s.season}</div>
                            {isChamp && <div className="text-xs text-yellow-400">🏆 Champ</div>}
                            {isLP && !isChamp && <div className="text-xs text-red-400">💀 Last</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold tabular-nums text-gray-300">{s.wins}–{s.losses}</span>
                              {!isChamp && !isLP && <span className="text-xs text-gray-500">#{s.rank}</span>}
                              {hasPlayoffData && (s.playoffWins > 0 || s.playoffLosses > 0) && (
                                <span className="text-xs text-yellow-400 font-semibold tabular-nums">
                                  {s.playoffWins}–{s.playoffLosses} playoffs
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-sm tabular-nums text-gray-300 flex-shrink-0">{s.pointsFor.toFixed(1)}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
                          <TableHead className="text-left py-3 px-5">Season</TableHead>
                          <TableHead className="text-center py-3 px-3">Record</TableHead>
                          {hasPlayoffData && <TableHead className="text-center py-3 px-3 text-yellow-500/70">Playoffs</TableHead>}
                          <TableHead className="text-center py-3 px-3">Rank</TableHead>
                          <TableHead className="text-right py-3 px-5">Points</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedSeasons.map((s) => {
                          const isChamp = champYears.includes(s.season);
                          const isLP = lastPlaceFinishes.includes(s.season);
                          return (
                            <TableRow key={s.season} className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors">
                              <TableCell className="py-3 px-5 font-medium text-white">{s.season}</TableCell>
                              <TableCell className="py-3 px-3 text-center tabular-nums text-gray-300 font-semibold">{s.wins}–{s.losses}</TableCell>
                              {hasPlayoffData && (
                                <TableCell className="py-3 px-3 text-center">
                                  {(s.playoffWins > 0 || s.playoffLosses > 0) ? (
                                    <span className="text-xs font-semibold text-yellow-400 tabular-nums">{s.playoffWins}–{s.playoffLosses}</span>
                                  ) : (
                                    <span className="text-xs text-gray-700">—</span>
                                  )}
                                </TableCell>
                              )}
                              <TableCell className="py-3 px-3 text-center">
                                {isChamp ? (
                                  <span className="text-yellow-400 font-bold">🏆 1st</span>
                                ) : isLP ? (
                                  <span className="text-red-400 font-bold">💀 Last</span>
                                ) : (
                                  <span className="text-gray-400">#{s.rank}</span>
                                )}
                              </TableCell>
                              <TableCell className="py-3 px-5 text-right tabular-nums text-gray-300">{s.pointsFor.toFixed(1)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              );
            })()}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
