import { useMemo } from 'react';
import { ChevronRight, Trophy, TrendingUp } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PowerRankings } from './PowerRankings';
import { Avatar } from './Avatar';
import { useLeagueHistory } from '../hooks/useLeagueData';
import { calcAllTimeStats } from '../utils/calculations';
import { useState } from 'react';

interface OverviewProps {
  computed: any;
  leagueId: string;
  userId: string;
  onNavigate: (tabId: "standings" | "power" | "trades" | "games" | "overview" | "luck" | "draft" | "records" | "compare") => void;
  onViewMyProfile: () => void;
  onSelectManager?: (userId: string) => void;
}

export function Overview({ computed, leagueId, userId, onViewMyProfile, onSelectManager }: OverviewProps) {
  const { data: history } = useLeagueHistory(leagueId);
  const [rankingMode, setRankingMode] = useState<'alltime' | 'season'>('alltime');

  const myStats = useMemo(() => {
    if (!history) return null;
    return calcAllTimeStats(history).get(userId) ?? null;
  }, [history, userId]);

  const allTimeRankings = useMemo(() => {
    if (!history) return [];
    const stats = calcAllTimeStats(history);
    return [...stats.values()].sort((a, b) => {
      if (b.titles !== a.titles) return b.titles - a.titles;
      return b.winPct - a.winPct;
    });
  }, [history]);

  const champYears = useMemo(() => {
    if (!history || !myStats) return [];
    return history.filter(s => s.championUserId === userId).map(s => s.season).sort();
  }, [history, userId, myStats]);

  const allTimePts = myStats?.seasons.reduce((sum, s) => sum + s.pointsFor, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Champion Hero */}
      {computed.champion && (
        <div className="relative overflow-hidden bg-gradient-to-r from-yellow-950/60 via-amber-900/30 to-yellow-950/60 rounded-2xl border border-yellow-700/30 p-4 sm:p-6">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-yellow-500/5 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-amber-500/5 blur-3xl" />
          </div>
          <div className="relative flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-900/50 border border-yellow-600/40 flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.15)]">
              <Trophy size={22} className="text-yellow-400" />
            </div>
            <button
              className="flex-1 min-w-0 text-left group"
              onClick={() => computed.champion.userId && onSelectManager?.(computed.champion.userId)}
              disabled={!computed.champion.userId || !onSelectManager}
            >
              <div className="text-[10px] font-semibold uppercase tracking-widest text-yellow-500/80 mb-0.5">Reigning Champion</div>
              <div className={`text-xl sm:text-2xl font-bold text-white leading-tight truncate ${computed.champion.userId && onSelectManager ? 'group-hover:text-yellow-300 transition-colors' : ''}`}>
                {computed.champion.teamName}
              </div>
              <div className="text-gray-400 text-sm mt-0.5">{computed.champion.displayName}</div>
            </button>
            <Avatar avatar={computed.champion.avatar} name={computed.champion.displayName} size="lg" />
          </div>
        </div>
      )}

      {/* My Stats */}
      {myStats && (
        <Card className="rounded-2xl bg-card-bg border-card-border">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Avatar avatar={myStats.avatar} name={myStats.displayName} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">{myStats.displayName}</h3>
                    <div className="text-xs text-gray-500 mt-0.5">{myStats.totalSeasons} season{myStats.totalSeasons !== 1 ? 's' : ''} in the league</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onViewMyProfile}
                    className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 flex-shrink-0 h-auto p-0"
                  >
                    Full Profile <ChevronRight size={13} />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-3 mt-2.5">
                  <div>
                    <div className="text-xl font-bold text-brand-cyan tabular-nums">{(myStats.winPct * 100).toFixed(1)}%</div>
                    <div className="text-xs text-gray-500">Win Rate</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-white tabular-nums">{myStats.totalWins}–{myStats.totalLosses}</div>
                    <div className="text-xs text-gray-500">Career Record</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-yellow-400 tabular-nums">{champYears.length}</div>
                    <div className="text-xs text-gray-500">Championship{champYears.length !== 1 ? 's' : ''}</div>
                  </div>
                  {(myStats.playoffWins > 0 || myStats.playoffLosses > 0) && (
                    <div>
                      <div className="text-xl font-bold text-yellow-500 tabular-nums">{myStats.playoffWins}–{myStats.playoffLosses}</div>
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
      )}

      {/* Power Rankings */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800/60 flex flex-col">
        <div className="flex items-center mb-2.5">
          <h3 className="text-sm font-semibold text-white">Power Rankings</h3>
        </div>

        <ToggleGroup
          type="single"
          value={rankingMode}
          onValueChange={(v) => v && setRankingMode(v as 'alltime' | 'season')}
          className="bg-gray-800/60 rounded-lg p-1 mb-4 justify-start gap-0"
        >
          <ToggleGroupItem
            value="alltime"
            className="px-3 py-1 rounded-md text-xs font-medium h-auto data-[state=on]:bg-gray-700 data-[state=on]:text-white data-[state=on]:shadow-sm text-gray-500 hover:text-gray-300"
          >
            All-Time
          </ToggleGroupItem>
          <ToggleGroupItem
            value="season"
            className="px-3 py-1 rounded-md text-xs font-medium h-auto data-[state=on]:bg-gray-700 data-[state=on]:text-white data-[state=on]:shadow-sm text-gray-500 hover:text-gray-300"
          >
            This Season
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex-1">
          {rankingMode === 'alltime' ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-3">
                Ranked by championships, then win percentage
              </p>
              {allTimeRankings.map((mgr, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                return (
                  <div key={mgr.userId} className="flex items-center gap-2.5 bg-gray-800/40 rounded-xl px-3 py-2.5">
                    <span className="text-sm w-5 text-center flex-shrink-0">
                      {medal ?? <span className="text-gray-500 text-xs font-medium">{idx + 1}</span>}
                    </span>
                    <Avatar avatar={mgr.avatar} name={mgr.displayName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white text-sm truncate">{mgr.displayName}</div>
                      <div className="text-xs text-gray-500">
                        {mgr.totalWins}–{mgr.totalLosses} · {mgr.totalSeasons} season{mgr.totalSeasons !== 1 ? 's' : ''}
                      </div>
                    </div>
                    {mgr.titles > 0 && (
                      <div className="flex items-center gap-1 bg-yellow-900/30 border border-yellow-700/40 rounded-lg px-2 py-0.5 flex-shrink-0">
                        <Trophy size={10} className="text-yellow-400" />
                        <span className="text-yellow-400 font-bold text-xs">{mgr.titles}</span>
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
          ) : (
            <PowerRankings rankings={computed.powerRankings} standings={computed.standings} onSelectManager={onSelectManager} />
          )}
        </div>
      </div>
    </div>
  );
}
