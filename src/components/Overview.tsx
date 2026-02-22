import { ChevronRight, Trophy } from 'lucide-react';
import { PowerRankings } from './PowerRankings';
import { BlowoutsAndClose } from './BlowoutsAndClose';
import { Avatar } from './Avatar';

interface OverviewProps {
  computed: any;
  onNavigate: (tabId: "standings" | "power" | "trades" | "games" | "overview" | "luck" | "draft" | "records" | "compare") => void;
}

export function Overview({ computed, onNavigate }: OverviewProps) {
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
