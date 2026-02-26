'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar } from './Avatar';

interface OverviewProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  computed: any;
  leagueId: string;
  userId: string;
  onNavigate: (tabId: "standings" | "power" | "trades" | "games" | "overview" | "luck" | "draft" | "records" | "compare") => void;
  onViewMyProfile?: () => void;
  onSelectManager?: (userId: string) => void;
}

export function Overview({ computed, userId, onViewMyProfile, onSelectManager }: OverviewProps) {
  const [statsOpen, setStatsOpen] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myStanding = (computed.standings as any[])?.find((s) => s.userId === userId) ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myRank = myStanding ? ((computed.standings as any[]).findIndex((s) => s.userId === userId) + 1) : null;
  const totalTeams: number = (computed.standings as unknown[])?.length ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myLuck = (computed.luckIndex as any[])?.find((s) => s.userId === userId) ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myPowerRank = (computed.powerRankings as any[])?.find((s) => s.userId === userId) ?? null;

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

      {/* My Season — Collapsible */}
      {myStanding && (
        <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
          <Card className="rounded-2xl bg-card-bg border-card-border overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Avatar avatar={myStanding.avatar} name={myStanding.displayName} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-white text-base leading-tight">{myStanding.displayName}</h3>
                      <div className="text-xs text-muted-foreground mt-0.5">{myStanding.teamName}</div>
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
                      <div className="text-xl font-bold text-brand-cyan tabular-nums">#{myRank}</div>
                      <div className="text-xs text-muted-foreground">of {totalTeams}</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white tabular-nums">
                        {myStanding.wins}–{myStanding.losses}
                      </div>
                      <div className="text-xs text-muted-foreground">Record</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white tabular-nums">
                        {myStanding.pointsFor.toFixed(0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Points For</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>

            <CollapsibleContent>
              <div className="px-4 pb-4 flex flex-wrap gap-3 border-t border-border pt-3">
                <div>
                  <div className="text-base font-bold text-white tabular-nums">
                    {myStanding.pointsAgainst.toFixed(0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Points Against</div>
                </div>
                {myStanding.streak && (
                  <div>
                    <div className="text-base font-bold text-white tabular-nums">{myStanding.streak}</div>
                    <div className="text-xs text-muted-foreground">Streak</div>
                  </div>
                )}
                {myPowerRank && (
                  <div>
                    <div className="text-base font-bold text-white tabular-nums">#{myPowerRank.rank}</div>
                    <div className="text-xs text-muted-foreground">Power Rank</div>
                  </div>
                )}
                {myLuck && (
                  <div>
                    <div className={`text-base font-bold tabular-nums ${myLuck.luckScore >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {myLuck.luckScore >= 0 ? '+' : ''}{myLuck.luckScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">Luck Score</div>
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
