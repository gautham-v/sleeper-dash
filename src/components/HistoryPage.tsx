import { useState, useMemo } from 'react';
import { Loader2, BarChart2, Zap, ArrowLeftRight, Trophy } from 'lucide-react';
import { useLeagueHistory } from '../hooks/useLeagueData';
import { calcAllTimeBlowouts } from '../utils/calculations';
import { YearOverYear } from './YearOverYear';
import { BlowoutsAndClose } from './BlowoutsAndClose';
import { TradeHistory } from './TradeHistory';
import type { SleeperTransaction, TeamStanding } from '../types/sleeper';

interface Props {
  leagueId: string;
  yoyData: {
    displayName: string;
    seasons: { season: string; wins: number; losses: number; pointsFor: number; rank: number }[];
  }[];
  yoyIsLoading: boolean;
  transactions: SleeperTransaction[];
  rosterMap: Map<number, { teamName: string; displayName: string }>;
  playerMap: Map<string, { name: string; position: string }>;
  standings: TeamStanding[];
}

type HistoryTab = 'yoy' | 'blowouts' | 'trades';

// Sort trades by total assets (players + picks) for the "Notable" view
function scoreNotability(trade: SleeperTransaction, rosterMap: Map<number, { teamName: string; displayName: string }>, standings: TeamStanding[]) {
  const [id1, id2] = trade.roster_ids;
  const totalPlayers = Object.keys(trade.adds ?? {}).length;
  const totalPicks = (trade.draft_picks ?? []).length;
  const totalAssets = totalPlayers + totalPicks;

  // Find season win % for each trading team to determine "winner"
  const standingById = new Map(standings.map(s => [s.rosterId, s]));
  const s1 = standingById.get(id1);
  const s2 = standingById.get(id2);

  const winPct1 = s1 ? s1.wins / (s1.wins + s1.losses || 1) : 0;
  const winPct2 = s2 ? s2.wins / (s2.wins + s2.losses || 1) : 0;
  const imbalance = Math.abs(winPct1 - winPct2);

  return { totalAssets, imbalance, winPctA: winPct1, winPctB: winPct2, teamName1: rosterMap.get(id1)?.teamName ?? `Team ${id1}`, teamName2: rosterMap.get(id2)?.teamName ?? `Team ${id2}` };
}

export function HistoryPage({ leagueId, yoyData, yoyIsLoading, transactions, rosterMap, playerMap, standings }: Props) {
  const [activeTab, setActiveTab] = useState<HistoryTab>('yoy');
  const [tradesView, setTradesView] = useState<'notable' | 'all'>('notable');

  const { data: history, isLoading: historyLoading } = useLeagueHistory(leagueId);

  const allTimeBlowouts = useMemo(() => {
    if (!history) return { blowouts: [], closest: [] };
    return calcAllTimeBlowouts(history, 8);
  }, [history]);

  const trades = transactions.filter(t => t.type === 'trade' && t.status === 'complete');

  // Sort notable trades: first by imbalance (how lopsided by season outcome), then by total assets
  const notableTrades = useMemo(() => {
    return [...trades]
      .map(t => ({ trade: t, meta: scoreNotability(t, rosterMap, standings) }))
      .sort((a, b) => b.meta.imbalance - a.meta.imbalance || b.meta.totalAssets - a.meta.totalAssets);
  }, [trades, rosterMap, standings]);

  const TABS = [
    { id: 'yoy' as const, label: 'Year Over Year', icon: BarChart2 },
    { id: 'blowouts' as const, label: 'Blowouts & Close', icon: Zap },
    { id: 'trades' as const, label: 'Trades', icon: ArrowLeftRight },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30'
                : 'bg-card-bg text-gray-400 border border-card-border hover:text-white'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Year Over Year */}
      {activeTab === 'yoy' && (
        yoyIsLoading ? (
          <div className="flex items-center justify-center h-48 text-brand-cyan">
            <Loader2 className="animate-spin mr-2" size={18} />
            Fetching multi-season data…
          </div>
        ) : (
          <YearOverYear data={yoyData} />
        )
      )}

      {/* All-time Blowouts */}
      {activeTab === 'blowouts' && (
        historyLoading ? (
          <div className="flex items-center justify-center h-48 text-brand-cyan">
            <Loader2 className="animate-spin mr-2" size={18} />
            Loading league history…
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">All-time records across every season in league history.</p>
            <BlowoutsAndClose blowouts={allTimeBlowouts.blowouts} closest={allTimeBlowouts.closest} />
          </div>
        )
      )}

      {/* Trades */}
      {activeTab === 'trades' && (
        <div className="space-y-4">
          {/* View toggle */}
          <div className="flex gap-2">
            {(['notable', 'all'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setTradesView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tradesView === v
                    ? 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30'
                    : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                }`}
              >
                {v === 'notable' ? 'Notable Trades' : 'All Trades'}
              </button>
            ))}
          </div>

          {tradesView === 'notable' ? (
            <div className="space-y-4">
              {notableTrades.length === 0 ? (
                <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">
                  No trades recorded this season.
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500">
                    Ranked by how lopsided the trade looks based on each team's final season record.
                    <span className="text-yellow-400 font-medium"> Winner</span> = team with better season outcome.
                  </p>
                  {notableTrades.map(({ trade, meta }) => {
                    const [id1, id2] = trade.roster_ids;
                    const standingById = new Map(standings.map(s => [s.rosterId, s]));
                    const s1 = standingById.get(id1);
                    const s2 = standingById.get(id2);

                    // Determine assets received by each team
                    const t1Receives: string[] = [];
                    const t2Receives: string[] = [];
                    if (trade.adds) {
                      for (const [pid, rid] of Object.entries(trade.adds)) {
                        if (rid === id1) t1Receives.push(pid);
                        else if (rid === id2) t2Receives.push(pid);
                      }
                    }
                    const t1Picks = (trade.draft_picks ?? []).filter(p => p.owner_id === id1);
                    const t2Picks = (trade.draft_picks ?? []).filter(p => p.owner_id === id2);

                    const team1Won = meta.winPctA > meta.winPctB;
                    const team2Won = meta.winPctB > meta.winPctA;

                    return (
                      <div key={trade.transaction_id} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                          <ArrowLeftRight size={12} />
                          <span>Trade · {new Date(trade.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          {meta.imbalance > 0.15 && (
                            <span className="ml-auto text-orange-400 font-semibold">⚠ Lopsided</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { name: meta.teamName1, standing: s1, receives: t1Receives, picks: t1Picks, won: team1Won },
                            { name: meta.teamName2, standing: s2, receives: t2Receives, picks: t2Picks, won: team2Won },
                          ].map(({ name, standing, receives, picks, won }, i) => (
                            <div key={i} className={`rounded-lg p-3 ${won ? 'bg-green-900/20 border border-green-700/30' : 'bg-gray-800/40 border border-gray-700/40'}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold text-white text-sm truncate">{name}</span>
                                {won && (
                                  <span className="text-[10px] font-bold text-green-400 bg-green-900/40 border border-green-700/40 px-1.5 py-0.5 rounded-md ml-auto flex-shrink-0 flex items-center gap-1">
                                    <Trophy size={8} /> Winner
                                  </span>
                                )}
                              </div>
                              {standing && (
                                <div className="text-xs text-gray-500 mb-2">
                                  Season: {standing.wins}–{standing.losses} · {(standing.wins / (standing.wins + standing.losses || 1) * 100).toFixed(0)}% win
                                </div>
                              )}
                              <div className="text-xs text-gray-400 mb-1">Receives:</div>
                              <div className="space-y-0.5">
                                {receives.map(pid => {
                                  const p = playerMap.get(pid);
                                  return p ? (
                                    <div key={pid} className="text-xs text-gray-200">{p.position} {p.name}</div>
                                  ) : (
                                    <div key={pid} className="text-xs text-gray-600">ID:{pid.slice(-6)}</div>
                                  );
                                })}
                                {picks.map(p => (
                                  <div key={`${p.season}-${p.round}`} className="text-xs text-yellow-400">{p.season} Rd{p.round} Pick</div>
                                ))}
                                {receives.length === 0 && picks.length === 0 && (
                                  <div className="text-xs text-gray-600">—</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          ) : (
            <TradeHistory transactions={transactions} rosterMap={rosterMap} playerMap={playerMap} />
          )}
        </div>
      )}
    </div>
  );
}
