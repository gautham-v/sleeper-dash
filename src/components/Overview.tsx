import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar } from './Avatar';
import { useLeagueHistory } from '../hooks/useLeagueData';
import { calcAllTimeStats } from '../utils/calculations';

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
  const [statsOpen, setStatsOpen] = useState(false);

  const myStats = useMemo(() => {
    if (!history) return null;
    return calcAllTimeStats(history).get(userId) ?? null;
  }, [history, userId]);

  const champYears = useMemo(() => {
    if (!history || !myStats) return [];
    return history.filter((s) => s.championUserId === userId).map((s) => s.season).sort();
  }, [history, userId, myStats]);

  const allTimePts = myStats?.seasons.reduce((sum, s) => sum + s.pointsFor, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Champion Hero */}
      {computed.champion && (
        <div className="flex items-center gap-4 bg-card-bg rounded-2xl border border-card-border p-4 sm:p-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
            <Trophy size={22} className="text-yellow-500" />
          </div>
          <button
            className="flex-1 min-w-0 text-left group"
            onClick={() => computed.champion.userId && onSelectManager?.(computed.champion.userId)}
            disabled={!computed.champion.userId || !onSelectManager}
          >
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
              Reigning Champion
            </div>
            <div className={`text-xl sm:text-2xl font-bold text-white leading-tight truncate ${computed.champion.userId && onSelectManager ? 'group-hover:text-muted-foreground transition-colors' : ''}`}>
              {computed.champion.teamName}
            </div>
            <div className="text-muted-foreground text-sm mt-0.5">{computed.champion.displayName}</div>
          </button>
          <Avatar avatar={computed.champion.avatar} name={computed.champion.displayName} size="lg" />
        </div>
      )}

      {/* My Stats — Collapsible */}
      {myStats && (
        <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
          <Card className="rounded-2xl bg-card-bg border-card-border overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Avatar avatar={myStats.avatar} name={myStats.displayName} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-white text-base leading-tight">{myStats.displayName}</h3>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {myStats.totalSeasons} season{myStats.totalSeasons !== 1 ? 's' : ''} in the league
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onViewMyProfile}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-0.5 flex-shrink-0 h-auto p-0"
                    >
                      Full Profile <ChevronRight size={13} />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2.5">
                    <div>
                      <div className="text-xl font-bold text-brand-cyan tabular-nums">
                        {(myStats.winPct * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Win Rate</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white tabular-nums">
                        {myStats.totalWins}–{myStats.totalLosses}
                      </div>
                      <div className="text-xs text-muted-foreground">Career Record</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-yellow-500 tabular-nums">
                        {champYears.length}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Championship{champYears.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>

            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                <div className="flex flex-wrap gap-3">
                  {(myStats.playoffWins > 0 || myStats.playoffLosses > 0) && (
                    <div>
                      <div className="text-base font-bold text-white tabular-nums">
                        {myStats.playoffWins}–{myStats.playoffLosses}
                      </div>
                      <div className="text-xs text-muted-foreground">Playoff Record</div>
                    </div>
                  )}
                  <div>
                    <div className="text-base font-bold text-white tabular-nums">
                      {allTimePts.toFixed(0)}
                    </div>
                    <div className="text-xs text-muted-foreground">All-Time Points</div>
                  </div>
                  <div>
                    <div className="text-base font-bold text-white tabular-nums">
                      {myStats.avgPointsFor.toFixed(0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Avg Pts / Season</div>
                  </div>
                </div>

                {myStats.seasons.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
                      Season by Season
                    </div>
                    <div className="space-y-1">
                      {[...myStats.seasons].reverse().map((s) => (
                        <div
                          key={s.season}
                          className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-muted/30"
                        >
                          <span className="text-muted-foreground font-medium w-12">{s.season}</span>
                          <span className="text-white tabular-nums">{s.wins}–{s.losses}</span>
                          <span className="text-muted-foreground tabular-nums">{s.pointsFor.toFixed(0)} pts</span>
                          <span className="text-muted-foreground tabular-nums">#{s.rank}</span>
                          {champYears.includes(s.season) && (
                            <span className="text-yellow-500 text-xs">🏆</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>

            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:text-foreground border-t border-border hover:bg-muted/20 transition-colors">
                {statsOpen ? (
                  <>Less <ChevronUp size={12} /></>
                ) : (
                  <>More stats <ChevronDown size={12} /></>
                )}
              </button>
            </CollapsibleTrigger>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
