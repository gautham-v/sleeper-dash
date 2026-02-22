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
  Elite:          { label: 'Elite',          bg: 'bg-[#F0F600]/10',  text: 'text-[#F0F600] drop-shadow-[0_0_5px_rgba(240,246,0,0.8)]',  border: 'border-[#F0F600]/30' },
  Contender:      { label: 'Contender',      bg: 'bg-brand-cyan/10',  text: 'text-brand-cyan drop-shadow-[0_0_5px_rgba(0,229,255,0.8)]',  border: 'border-brand-cyan/30' },
  Average:        { label: 'Average',        bg: 'bg-white/5',    text: 'text-gray-300',    border: 'border-white/10'   },
  Rebuilding:     { label: 'Rebuilding',     bg: 'bg-orange-500/10',  text: 'text-orange-400 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]',  border: 'border-orange-500/30' },
  'Cellar Dweller': { label: 'Cellar Dweller', bg: 'bg-red-500/10',  text: 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]',     border: 'border-red-500/30'    },
};

function TierBadge({ tier }: { tier: TeamTier }) {
  const s = TIER_STYLES[tier];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold border ${s.bg} ${s.text} ${s.border}`}>
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
      <div className="flex justify-between text-[11px] font-bold tracking-wider mb-1">
        <span className={aLeads ? 'text-brand-cyan drop-shadow-sm' : 'text-gray-500'}>{valueA}</span>
        <span className={bLeads ? 'text-brand-purple drop-shadow-sm' : 'text-gray-500'}>{valueB}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-black/40">
        <div
          className={`transition-all relative ${aLeads ? 'bg-brand-cyan shadow-[0_0_10px_rgba(0,229,255,0.5)]' : 'bg-brand-cyan/30'}`}
          style={{ width: `${pctA}%` }}
        >
           {aLeads && <div className="absolute inset-0 bg-white/20 w-full rounded-full"></div>}
        </div>
        <div
          className={`transition-all relative ${bLeads ? 'bg-brand-purple shadow-[0_0_10px_rgba(176,132,233,0.5)]' : 'bg-brand-purple/30'}`}
          style={{ width: `${pctB}%` }}
        >
          {bLeads && <div className="absolute inset-0 bg-white/20 w-full rounded-full"></div>}
        </div>
      </div>
      <div className="flex justify-between text-[10px] font-semibold text-gray-500 mt-1 uppercase tracking-widest">
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
    <div className="flex items-center py-3 border-b border-card-border/50 last:border-0 hover:bg-white/5 transition-colors -mx-2 px-2 rounded-lg">
      <div className={`w-1/3 text-right text-sm font-bold tabular-nums ${aWins ? 'text-brand-cyan drop-shadow-sm' : 'text-gray-500'}`}>
        {valueA}
      </div>
      <div className="w-1/3 text-center text-[10px] font-semibold uppercase tracking-widest text-gray-500 px-2">{label}</div>
      <div className={`w-1/3 text-left text-sm font-bold tabular-nums ${bWins ? 'text-brand-purple drop-shadow-sm' : 'text-gray-500'}`}>
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
    <div className="space-y-8">
      {/* Team selectors */}
      <div className="bg-card-bg rounded-2xl p-6 border border-card-border shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-5 relative z-10">Select Teams to Compare</h3>
        <div className="grid grid-cols-2 gap-6 relative z-10">
          {/* Team A */}
          <div className="relative group">
            <label className="block text-[11px] font-bold text-brand-cyan mb-2 tracking-wider">TEAM A</label>
            <div className="absolute -inset-0.5 bg-brand-cyan/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
            <select
              value={teamAId}
              onChange={(e) => setTeamAId(e.target.value)}
              className="relative w-full bg-black/40 border border-card-border rounded-xl px-4 py-3 text-white text-sm font-semibold focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/50 transition-all appearance-none cursor-pointer"
            >
              <option value="">— Select team —</option>
              {allUsers.map((u) => (
                <option key={u.userId} value={u.userId} disabled={u.userId === teamBId}>
                  {u.displayName}
                </option>
              ))}
            </select>
            <div className="absolute right-4 bottom-3.5 pointer-events-none text-gray-500 group-hover:text-brand-cyan transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
          {/* Team B */}
          <div className="relative group">
            <label className="block text-[11px] font-bold text-brand-purple mb-2 tracking-wider">TEAM B</label>
            <div className="absolute -inset-0.5 bg-brand-purple/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
            <select
              value={teamBId}
              onChange={(e) => setTeamBId(e.target.value)}
              className="relative w-full bg-black/40 border border-card-border rounded-xl px-4 py-3 text-white text-sm font-semibold focus:outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/50 transition-all appearance-none cursor-pointer"
            >
              <option value="">— Select team —</option>
              {allUsers.map((u) => (
                <option key={u.userId} value={u.userId} disabled={u.userId === teamAId}>
                  {u.displayName}
                </option>
              ))}
            </select>
            <div className="absolute right-4 bottom-3.5 pointer-events-none text-gray-500 group-hover:text-brand-purple transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
        </div>
      </div>

      {/* Prompt when not both selected */}
      {(!teamAId || !teamBId || teamAId === teamBId) && (
        <div className="bg-card-bg border border-card-border border-dashed rounded-2xl p-10 text-center text-gray-500 font-medium tracking-wide shadow-lg">
          Select two different teams above to see the comparison.
        </div>
      )}

      {/* Comparison content */}
      {teamAId && teamBId && teamAId !== teamBId && statsA && statsB && (
        <>
          {/* Team headers */}
          <div className="grid grid-cols-2 gap-6">
            {[{ info: teamAInfo, stats: statsA, color: 'cyan' }, { info: teamBInfo, stats: statsB, color: 'purple' }].map(
              ({ info, stats, color }, idx) => (
                <div
                  key={idx}
                  className={`bg-card-bg rounded-2xl p-6 border shadow-lg relative overflow-hidden group ${color === 'cyan' ? 'border-brand-cyan/30 hover:border-brand-cyan/50' : 'border-brand-purple/30 hover:border-brand-purple/50'} transition-all`}
                >
                  <div className={`absolute top-0 ${color === 'cyan' ? 'right-0 bg-brand-cyan/10' : 'left-0 bg-brand-purple/10'} w-32 h-32 rounded-full blur-3xl -mt-10 ${color === 'cyan' ? '-mr-10' : '-ml-10'} pointer-events-none transition-all group-hover:opacity-70 opacity-40`}></div>
                  <div className="flex items-center gap-4 mb-4 relative z-10">
                    <Avatar avatar={info?.avatar ?? null} name={info?.displayName ?? ''} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className={`font-black text-xl truncate tracking-tight mb-1 ${color === 'cyan' ? 'text-brand-cyan drop-shadow-sm' : 'text-brand-purple drop-shadow-sm'}`}>{info?.displayName}</div>
                      <div>
                        <TierBadge tier={stats.tier} />
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500 relative z-10 bg-black/20 inline-block px-3 py-1.5 rounded-lg border border-white/5">{stats.totalSeasons} season{stats.totalSeasons !== 1 ? 's' : ''} in league</div>
                </div>
              ),
            )}
          </div>

          {/* Head-to-Head */}
          {h2h && (
            <div className="bg-card-bg rounded-2xl p-6 border border-card-border shadow-lg">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-card-border">
                <Swords size={18} className="text-gray-400" />
                <h3 className="font-bold text-white tracking-tight">Head-to-Head</h3>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-auto bg-black/20 px-2.5 py-1 rounded-md">{h2h.games.length} matchup{h2h.games.length !== 1 ? 's' : ''} all-time</span>
              </div>

              {h2h.games.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6 font-medium bg-black/10 rounded-xl border border-white/5">These teams have never faced each other.</p>
              ) : (
                <div className="space-y-6">
                  {/* Win count */}
                  <CompareBar
                    valueA={h2h.teamAWins}
                    valueB={h2h.teamBWins}
                    labelA={`${teamAInfo?.displayName} Wins`}
                    labelB={`${teamBInfo?.displayName} Wins`}
                  />

                  {/* Points */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 text-center">Total Points Scored (H2H)</div>
                    <CompareBar
                      valueA={h2h.teamAPoints}
                      valueB={h2h.teamBPoints}
                      labelA={teamAInfo?.displayName ?? ''}
                      labelB={teamBInfo?.displayName ?? ''}
                    />
                  </div>

                  {/* Game log */}
                  <div className="mt-6 pt-4 border-t border-card-border/50">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">All-time matchups</div>
                    <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar pr-1">
                      {[...h2h.games].reverse().map((g, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between bg-black/20 border border-card-border hover:bg-white/5 transition-colors rounded-xl px-4 py-3 text-sm group"
                        >
                          <span className="text-gray-500 font-bold text-[11px] tracking-wider uppercase w-24 group-hover:text-gray-400 transition-colors">{g.season} Wk {g.week}</span>
                          <div className="flex items-center gap-3 flex-1 justify-center bg-black/30 py-1.5 px-4 rounded-lg">
                            <span className={`tabular-nums font-bold text-[15px] ${g.winner === 'A' ? 'text-brand-cyan drop-shadow-[0_0_5px_rgba(0,229,255,0.5)]' : 'text-gray-500'}`}>
                              {g.teamAPoints}
                            </span>
                            <span className="text-gray-600 text-[10px] font-bold uppercase tracking-wider">vs</span>
                            <span className={`tabular-nums font-bold text-[15px] ${g.winner === 'B' ? 'text-brand-purple drop-shadow-[0_0_5px_rgba(176,132,233,0.5)]' : 'text-gray-500'}`}>
                              {g.teamBPoints}
                            </span>
                          </div>
                          <span className="text-[11px] w-20 text-right uppercase tracking-wider">
                            {g.winner === 'A' ? (
                              <span className="text-brand-cyan font-black bg-brand-cyan/10 px-2 py-1 rounded border border-brand-cyan/20">{teamAInfo?.displayName?.split(' ')[0]} W</span>
                            ) : g.winner === 'B' ? (
                              <span className="text-brand-purple font-black bg-brand-purple/10 px-2 py-1 rounded border border-brand-purple/20">{teamBInfo?.displayName?.split(' ')[0]} W</span>
                            ) : (
                              <span className="text-gray-500 font-bold">Tie</span>
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
          <div className="bg-card-bg rounded-2xl p-6 border border-card-border shadow-lg">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-card-border">
              <TrendingUp size={18} className="text-gray-400" />
              <h3 className="font-bold text-white tracking-tight">All-Time Stats</h3>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-auto bg-black/20 px-2.5 py-1 rounded-md">Across {seasons.length} season{seasons.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Column headers */}
            <div className="flex items-center pb-3 mb-2">
              <div className="w-1/3 text-right">
                <span className="text-xs font-bold text-brand-cyan uppercase tracking-wider truncate block drop-shadow-sm">{teamAInfo?.displayName}</span>
              </div>
              <div className="w-1/3" />
              <div className="w-1/3 text-left">
                <span className="text-xs font-bold text-brand-purple uppercase tracking-wider truncate block drop-shadow-sm">{teamBInfo?.displayName}</span>
              </div>
            </div>

            <div className="bg-black/20 border border-card-border rounded-xl px-2 py-1">
              <StatRow label="Total Wins" valueA={statsA.totalWins} valueB={statsB.totalWins} />
              <StatRow label="Total Losses" valueA={statsA.totalLosses} valueB={statsB.totalLosses} higherIsBetter={false} />
              <StatRow label="Win %" valueA={`${(statsA.winPct * 100).toFixed(1)}%`} valueB={`${(statsB.winPct * 100).toFixed(1)}%`} />
              <StatRow label="Avg Pts/Season" valueA={statsA.avgPointsFor.toFixed(1)} valueB={statsB.avgPointsFor.toFixed(1)} />
              <StatRow label="Titles 🏆" valueA={statsA.titles} valueB={statsB.titles} />
              <StatRow label="Seasons" valueA={statsA.totalSeasons} valueB={statsB.totalSeasons} />
            </div>

            {/* Win bar */}
            <div className="mt-6 pt-6 border-t border-card-border/50">
              <CompareBar
                valueA={statsA.totalWins}
                valueB={statsB.totalWins}
                labelA={`${teamAInfo?.displayName} Wins`}
                labelB={`${teamBInfo?.displayName} Wins`}
              />
            </div>
          </div>

          {/* Season-by-season breakdown */}
          <div className="bg-card-bg rounded-2xl overflow-hidden border border-card-border shadow-lg">
            <div className="flex items-center gap-2 px-6 pt-6 pb-4 border-b border-card-border bg-black/20">
              <Trophy size={18} className="text-gray-400" />
              <h3 className="font-bold text-white tracking-tight">Season-by-Season</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="text-gray-500 text-[10px] font-bold uppercase tracking-widest border-b border-card-border bg-black/40">
                    <th className="text-left py-4 px-6">Season</th>
                    <th className="text-center py-4 px-4 text-brand-cyan">{teamAInfo?.displayName}</th>
                    <th className="text-center py-4 px-3 text-brand-cyan/50">Rank</th>
                    <th className="text-center py-4 px-4 text-brand-purple">{teamBInfo?.displayName}</th>
                    <th className="text-center py-4 px-3 text-brand-purple/50">Rank</th>
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
                      <tr key={season} className="border-b border-card-border/50 hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 text-gray-400 font-bold text-xs tracking-wider">{season}</td>
                        <td className={`py-4 px-4 text-center font-black tabular-nums tracking-wide ${aBetter ? 'text-brand-cyan drop-shadow-sm' : 'text-gray-500'}`}>
                          {aRecord}
                        </td>
                        <td className={`py-4 px-3 text-center text-[11px] font-bold uppercase tracking-wider ${aBetter ? 'text-brand-cyan/80' : 'text-gray-600'}`}>
                          {aRankDisplay}
                        </td>
                        <td className={`py-4 px-4 text-center font-black tabular-nums tracking-wide ${bBetter ? 'text-brand-purple drop-shadow-sm' : 'text-gray-500'}`}>
                          {bRecord}
                        </td>
                        <td className={`py-4 px-3 text-center text-[11px] font-bold uppercase tracking-wider ${bBetter ? 'text-brand-purple/80' : 'text-gray-600'}`}>
                          {bRankDisplay}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 text-[10px] uppercase tracking-widest font-semibold text-gray-500 bg-black/20 border-t border-card-border">
              Rank is based on regular-season record &amp; points. 🏆 = finished 1st in the league.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
