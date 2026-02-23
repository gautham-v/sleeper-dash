'use client';
import { useState, useMemo } from 'react';
import { Loader2, BarChart2, Zap, ArrowLeftRight, Trophy } from 'lucide-react';
import { useLeagueHistory } from '../hooks/useLeagueData';
import { calcAllTimeBlowouts } from '../utils/calculations';
import { YearOverYear } from './YearOverYear';
import { BlowoutsAndClose } from './BlowoutsAndClose';
import { TradeHistory } from './TradeHistory';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as HistoryTab)}>
        <TabsList className="bg-card-bg border border-card-border">
          <TabsTrigger value="yoy" className="flex items-center gap-2 data-[state=active]:bg-brand-cyan/10 data-[state=active]:text-brand-cyan data-[state=active]:border data-[state=active]:border-brand-cyan/30">
            <BarChart2 size={14} />
            Year Over Year
          </TabsTrigger>
          <TabsTrigger value="blowouts" className="flex items-center gap-2 data-[state=active]:bg-brand-cyan/10 data-[state=active]:text-brand-cyan data-[state=active]:border data-[state=active]:border-brand-cyan/30">
            <Zap size={14} />
            Blowouts &amp; Close
          </TabsTrigger>
          <TabsTrigger value="trades" className="flex items-center gap-2 data-[state=active]:bg-brand-cyan/10 data-[state=active]:text-brand-cyan data-[state=active]:border data-[state=active]:border-brand-cyan/30">
            <ArrowLeftRight size={14} />
            Trades
          </TabsTrigger>
        </TabsList>

        {/* Year Over Year */}
        <TabsContent value="yoy">
          {yoyIsLoading ? (
            <div className="flex items-center justify-center h-48 text-brand-cyan">
              <Loader2 className="animate-spin mr-2" size={18} />
              Fetching multi-season data…
            </div>
          ) : (
            <YearOverYear data={yoyData} />
          )}
        </TabsContent>

        {/* All-time Blowouts */}
        <TabsContent value="blowouts">
          {historyLoading ? (
            <div className="flex items-center justify-center h-48 text-brand-cyan">
              <Loader2 className="animate-spin mr-2" size={18} />
              Loading league history…
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">All-time records across every season in league history.</p>
              <BlowoutsAndClose blowouts={allTimeBlowouts.blowouts} closest={allTimeBlowouts.closest} />
            </div>
          )}
        </TabsContent>

        {/* Trades */}
        <TabsContent value="trades">
          <div className="space-y-4">
            {/* View toggle */}
            <ToggleGroup
              type="single"
              value={tradesView}
              onValueChange={(v) => { if (v) setTradesView(v as 'notable' | 'all'); }}
              className="justify-start"
            >
              <ToggleGroupItem
                value="notable"
                className="px-3 py-1.5 text-xs font-medium data-[state=on]:bg-brand-cyan/10 data-[state=on]:text-brand-cyan data-[state=on]:border data-[state=on]:border-brand-cyan/30"
              >
                Notable Trades
              </ToggleGroupItem>
              <ToggleGroupItem
                value="all"
                className="px-3 py-1.5 text-xs font-medium data-[state=on]:bg-brand-cyan/10 data-[state=on]:text-brand-cyan data-[state=on]:border data-[state=on]:border-brand-cyan/30"
              >
                All Trades
              </ToggleGroupItem>
            </ToggleGroup>

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
        </TabsContent>
      </Tabs>
    </div>
  );
}
