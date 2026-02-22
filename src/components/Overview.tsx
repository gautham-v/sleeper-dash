import { useMemo } from 'react';
import { ChevronRight, Trophy } from 'lucide-react';
import { PowerRankings } from './PowerRankings';
import { BlowoutsAndClose } from './BlowoutsAndClose';
import { Avatar } from './Avatar';
import { useLeagueHistory } from '../hooks/useLeagueData';
import { calcAllTimeStats } from '../utils/calculations';

interface OverviewProps {
  computed: any;
  leagueId: string;
  userId: string;
  onNavigate: (tabId: "standings" | "power" | "trades" | "games" | "overview" | "luck" | "draft" | "records" | "compare") => void;
  onViewMyProfile: () => void;
}

export function Overview({ computed, leagueId, userId, onNavigate, onViewMyProfile }: OverviewProps) {
  const { data: history } = useLeagueHistory(leagueId);

  const myStats = useMemo(() => {
    if (!history) return null;
    return calcAllTimeStats(history).get(userId) ?? null;
  }, [history, userId]);

  const champYears = useMemo(() => {
    if (!history || !myStats) return [];
    return history.filter(s => s.championUserId === userId).map(s => s.season).sort();
  }, [history, userId, myStats]);

  const allTimePts = myStats?.seasons.reduce((sum, s) => sum + s.pointsFor, 0) ?? 0;
  return (
    <div className="space-y-6">
      {/* Champion Hero */}
      {computed.champion && (
        <div className="relative overflow-hidden bg-gradient-to-r from-yellow-950/60 via-amber-900/30 to-yellow-950/60 rounded-2xl border border-yellow-700/30 p-6 sm:p-8">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-yellow-500/5 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-amber-500/5 blur-3xl" />
          </div>
          <div className="relative flex items-center gap-5 sm:gap-6">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-yellow-900/50 border border-yellow-600/40 flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.15)]">
              <Trophy size={30} className="text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-widest text-yellow-500/80 mb-1">Reigning Champion</div>
              <div className="text-2xl sm:text-3xl font-bold text-white leading-tight truncate">
                {computed.champion.teamName}
              </div>
              <div className="text-gray-400 text-sm mt-0.5">{computed.champion.displayName}</div>
            </div>
            <Avatar avatar={computed.champion.avatar} name={computed.champion.displayName} size="xl" />
          </div>
        </div>
      )}

      {/* My Stats */}
      {myStats && (
        <div className="bg-card-bg border border-card-border rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <Avatar avatar={myStats.avatar} name={myStats.displayName} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-white text-lg leading-tight">{myStats.displayName}</h3>
                  <div className="text-xs text-gray-500 mt-0.5">{myStats.totalSeasons} season{myStats.totalSeasons !== 1 ? 's' : ''} in the league</div>
                </div>
                <button
                  onClick={onViewMyProfile}
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 flex-shrink-0 transition-colors"
                >
                  Full Profile <ChevronRight size={13} />
                </button>
              </div>
              <div className="flex flex-wrap gap-4 mt-3">
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
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Power Rankings */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800/60 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Power Rankings</h3>
            <button
              onClick={() => onNavigate('power')}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center transition-colors"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex-1">
            <PowerRankings rankings={computed.powerRankings.slice(0, 3)} standings={computed.standings} />
          </div>
        </div>

        {/* Biggest Blowout */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800/60 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Biggest Blowout</h3>
            <button
              onClick={() => onNavigate('games')}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center transition-colors"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex-1">
            {computed.blowouts.length > 0 ? (
              <BlowoutsAndClose blowouts={computed.blowouts.slice(0, 1)} closest={[]} hideHeaders={true} />
            ) : (
              <div className="text-gray-500 text-sm">No blowouts recorded yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
