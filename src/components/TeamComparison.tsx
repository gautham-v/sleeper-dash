import { useState, useMemo } from 'react';
import { Loader2, Trophy, Swords, TrendingUp, Shield } from 'lucide-react';
import { useLeagueHistory } from '../hooks/useLeagueData';
import { calcAllTimeStats, calcH2H } from '../utils/calculations';
import { Avatar } from './Avatar';
import type { TeamAllTimeStats, TeamTier } from '../types/sleeper';

interface Props {
  leagueId: string;
}

const TIER_STYLES: Record<TeamTier, { label: string; bg: string; text: string; border: string }> = {
  Elite:          { label: 'Elite',          bg: 'bg-yellow-900/40',  text: 'text-yellow-400',  border: 'border-yellow-700' },
  Contender:      { label: 'Contender',      bg: 'bg-indigo-900/40',  text: 'text-indigo-400',  border: 'border-indigo-700' },
  Average:        { label: 'Average',        bg: 'bg-gray-800/60',    text: 'text-gray-300',    border: 'border-gray-600'   },
  Rebuilding:     { label: 'Rebuilding',     bg: 'bg-orange-900/40',  text: 'text-orange-400',  border: 'border-orange-700' },
  'Cellar Dweller': { label: 'Cellar Dweller', bg: 'bg-red-900/40',  text: 'text-red-400',     border: 'border-red-700'    },
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
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span className={aLeads ? 'text-indigo-400 font-semibold' : ''}>{valueA}</span>
        <span className={bLeads ? 'text-emerald-400 font-semibold' : ''}>{valueB}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden">
        <div
          className={`transition-all ${aLeads ? 'bg-indigo-500' : 'bg-indigo-800'}`}
          style={{ width: `${pctA}%` }}
        />
        <div
          className={`transition-all ${bLeads ? 'bg-emerald-500' : 'bg-emerald-800'}`}
          style={{ width: `${pctB}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
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
    <div className="flex items-center py-3 border-b border-gray-800 last:border-0">
      <div className={`w-1/3 text-right text-sm font-medium tabular-nums ${aWins ? 'text-indigo-400' : 'text-gray-300'}`}>
        {valueA}
      </div>
      <div className="w-1/3 text-center text-xs text-gray-500 px-2">{label}</div>
      <div className={`w-1/3 text-left text-sm font-medium tabular-nums ${bWins ? 'text-emerald-400' : 'text-gray-300'}`}>
        {valueB}
      </div>
    </div>
  );
}

export function TeamComparison({ leagueId }: Props) {
  const [teamAId, setTeamAId] = useState<string>('');
  const [teamBId, setTeamBId] = useState<string>('');

  const { data: history, isLoading } = useLeagueHistory(leagueId);

  // All unique users across all seasons
  const allUsers = useMemo(() => {
    if (!history) return [];
    const seen = new Map<string, { userId: string; displayName: string; avatar: string | null }>();
    for (const season of history) {
      for (const [userId, team] of season.teams) {
        if (!seen.has(userId)) {
          seen.set(userId, { userId, displayName: team.displayName, avatar: team.avatar });
        } else {
          // Keep most recent display name
          seen.get(userId)!.displayName = team.displayName;
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [history]);

  // All-time stats for every user
  const allTimeStats = useMemo((): Map<string, TeamAllTimeStats> => {
    if (!history) return new Map();
    return calcAllTimeStats(history);
  }, [history]);

  // H2H record between the two selected teams
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
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading full league history…
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">
        No historical data available for this league.
      </div>
    );
  }

  const seasons = [...history].map((s) => s.season).sort();

  return (
    <div className="space-y-6">
      {/* Team selectors */}
      <div className="bg-gray-900 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Select Teams to Compare</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Team A */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Team A</label>
            <select
              value={teamAId}
              onChange={(e) => setTeamAId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">— Select team —</option>
              {allUsers.map((u) => (
                <option key={u.userId} value={u.userId} disabled={u.userId === teamBId}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>
          {/* Team B */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Team B</label>
            <select
              value={teamBId}
              onChange={(e) => setTeamBId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">— Select team —</option>
              {allUsers.map((u) => (
                <option key={u.userId} value={u.userId} disabled={u.userId === teamAId}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Prompt when not both selected */}
      {(!teamAId || !teamBId || teamAId === teamBId) && (
        <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500 text-sm">
          Select two different teams above to see the comparison.
        </div>
      )}

      {/* Comparison content */}
      {teamAId && teamBId && teamAId !== teamBId && statsA && statsB && (
        <>
          {/* Team headers */}
          <div className="grid grid-cols-2 gap-4">
            {[{ info: teamAInfo, stats: statsA, color: 'indigo' }, { info: teamBInfo, stats: statsB, color: 'emerald' }].map(
              ({ info, stats, color }, idx) => (
                <div
                  key={idx}
                  className={`bg-gray-900 rounded-xl p-5 border ${color === 'indigo' ? 'border-indigo-800/50' : 'border-emerald-800/50'}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar avatar={info?.avatar ?? null} name={info?.displayName ?? ''} size="lg" />
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{info?.displayName}</div>
                      <div className="mt-1">
                        <TierBadge tier={stats.tier} />
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">{stats.totalSeasons} season{stats.totalSeasons !== 1 ? 's' : ''} in league</div>
                </div>
              ),
            )}
          </div>

          {/* Head-to-Head */}
          {h2h && (
            <div className="bg-gray-900 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Swords size={16} className="text-gray-400" />
                <h3 className="font-semibold text-white">Head-to-Head</h3>
                <span className="text-xs text-gray-500 ml-auto">{h2h.games.length} matchup{h2h.games.length !== 1 ? 's' : ''} all-time</span>
              </div>

              {h2h.games.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">These teams have never faced each other.</p>
              ) : (
                <div className="space-y-4">
                  {/* Overall win count */}
                  <CompareBar
                    valueA={h2h.teamAWins}
                    valueB={h2h.teamBWins}
                    labelA={`${teamAInfo?.displayName} Wins`}
                    labelB={`${teamBInfo?.displayName} Wins`}
                  />

                  {/* Playoff breakdown (if any playoff matchups exist) */}
                  {(h2h.playoffAWins > 0 || h2h.playoffBWins > 0) && (
                    <div className="flex items-center justify-between text-xs bg-yellow-950/40 border border-yellow-800/30 rounded-lg px-3 py-2">
                      <span className={`font-semibold tabular-nums ${h2h.playoffAWins > h2h.playoffBWins ? 'text-indigo-400' : 'text-gray-300'}`}>
                        {h2h.playoffAWins}
                      </span>
                      <span className="text-yellow-500/80 text-center flex-1 text-center">🏆 Playoff record</span>
                      <span className={`font-semibold tabular-nums ${h2h.playoffBWins > h2h.playoffAWins ? 'text-emerald-400' : 'text-gray-300'}`}>
                        {h2h.playoffBWins}
                      </span>
                    </div>
                  )}

                  {/* Points */}
                  <div>
                    <div className="text-xs text-gray-500 mb-1 text-center">Total Points Scored (H2H)</div>
                    <CompareBar
                      valueA={h2h.teamAPoints}
                      valueB={h2h.teamBPoints}
                      labelA={teamAInfo?.displayName ?? ''}
                      labelB={teamBInfo?.displayName ?? ''}
                    />
                  </div>

                  {/* Game log */}
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-2">All-time matchups</div>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {[...h2h.games].reverse().map((g, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${g.isPlayoff ? 'bg-yellow-950/30 border border-yellow-800/20' : 'bg-gray-800/60'}`}
                        >
                          <span className="text-xs w-24 shrink-0">
                            {g.isPlayoff ? (
                              <span className="text-yellow-500/80">{g.season} Playoffs</span>
                            ) : (
                              <span className="text-gray-400">{g.season} Wk {g.week}</span>
                            )}
                          </span>
                          <div className="flex items-center gap-2 flex-1 justify-center">
                            <span className={`tabular-nums font-medium ${g.winner === 'A' ? 'text-indigo-400' : 'text-gray-300'}`}>
                              {g.teamAPoints}
                            </span>
                            <span className="text-gray-600 text-xs">vs</span>
                            <span className={`tabular-nums font-medium ${g.winner === 'B' ? 'text-emerald-400' : 'text-gray-300'}`}>
                              {g.teamBPoints}
                            </span>
                          </div>
                          <span className="text-xs w-16 text-right">
                            {g.winner === 'A' ? (
                              <span className="text-indigo-400 font-semibold">{teamAInfo?.displayName?.split(' ')[0]} W</span>
                            ) : g.winner === 'B' ? (
                              <span className="text-emerald-400 font-semibold">{teamBInfo?.displayName?.split(' ')[0]} W</span>
                            ) : (
                              <span className="text-gray-500">Tie</span>
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
          <div className="bg-gray-900 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-gray-400" />
              <h3 className="font-semibold text-white">All-Time Stats</h3>
              <span className="text-xs text-gray-500 ml-auto">Across {seasons.length} season{seasons.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Column headers */}
            <div className="flex items-center pb-2 mb-1 border-b border-gray-800">
              <div className="w-1/3 text-right">
                <span className="text-xs font-semibold text-indigo-400 truncate block">{teamAInfo?.displayName}</span>
              </div>
              <div className="w-1/3" />
              <div className="w-1/3 text-left">
                <span className="text-xs font-semibold text-emerald-400 truncate block">{teamBInfo?.displayName}</span>
              </div>
            </div>

            <StatRow label="Total Wins" valueA={statsA.totalWins} valueB={statsB.totalWins} />
            <StatRow label="Total Losses" valueA={statsA.totalLosses} valueB={statsB.totalLosses} higherIsBetter={false} />
            <StatRow label="Win %" valueA={`${(statsA.winPct * 100).toFixed(1)}%`} valueB={`${(statsB.winPct * 100).toFixed(1)}%`} />
            <StatRow label="Avg Pts/Season" valueA={statsA.avgPointsFor.toFixed(1)} valueB={statsB.avgPointsFor.toFixed(1)} />
            <StatRow label="Titles 🏆" valueA={statsA.titles} valueB={statsB.titles} />
            <StatRow label="Seasons" valueA={statsA.totalSeasons} valueB={statsB.totalSeasons} />

            {/* Win bar */}
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
          <div className="bg-gray-900 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 pt-5 pb-3">
              <Trophy size={16} className="text-gray-400" />
              <h3 className="font-semibold text-white">Season-by-Season</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
                    <th className="text-left py-3 px-5">Season</th>
                    <th className="text-center py-3 px-3 text-indigo-400">{teamAInfo?.displayName}</th>
                    <th className="text-center py-3 px-3 text-indigo-400/60">Rank</th>
                    <th className="text-center py-3 px-3 text-emerald-400">{teamBInfo?.displayName}</th>
                    <th className="text-center py-3 px-3 text-emerald-400/60">Rank</th>
                  </tr>
                </thead>
                <tbody>
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
                      <tr key={season} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
                        <td className="py-3 px-5 text-gray-400 font-medium">{season}</td>
                        <td className={`py-3 px-3 text-center font-semibold tabular-nums ${aBetter ? 'text-indigo-400' : 'text-gray-300'}`}>
                          {aRecord}
                        </td>
                        <td className={`py-3 px-3 text-center text-xs ${aBetter ? 'text-indigo-400' : 'text-gray-500'}`}>
                          {aRankDisplay}
                        </td>
                        <td className={`py-3 px-3 text-center font-semibold tabular-nums ${bBetter ? 'text-emerald-400' : 'text-gray-300'}`}>
                          {bRecord}
                        </td>
                        <td className={`py-3 px-3 text-center text-xs ${bBetter ? 'text-emerald-400' : 'text-gray-500'}`}>
                          {bRankDisplay}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 text-xs text-gray-500">
              Record reflects the full season (regular season + playoffs). 🏆 = won the championship.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
