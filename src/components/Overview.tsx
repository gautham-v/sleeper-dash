import { ChevronRight } from 'lucide-react';
import { Standings } from './Standings';
import { PowerRankings } from './PowerRankings';
import { TradeHistory } from './TradeHistory';
import { BlowoutsAndClose } from './BlowoutsAndClose';
import type { SleeperTransaction } from '../types/sleeper';

interface OverviewProps {
  computed: any;
  transactions: SleeperTransaction[];
  draftData: any;
  onNavigate: (tabId: "standings" | "power" | "trades" | "games" | "overview" | "luck" | "draft" | "records" | "compare") => void;
}

export function Overview({ computed, transactions, draftData, onNavigate }: OverviewProps) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Top 3 Standings */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 lg:p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-cyan/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="flex items-center justify-between mb-4 sm:mb-5 relative z-10">
            <h3 className="font-bold text-base sm:text-lg text-white tracking-tight">Top Standings</h3>
            <button
              onClick={() => onNavigate('standings')}
              className="text-xs font-semibold text-brand-cyan hover:text-white flex items-center transition-colors bg-brand-cyan/10 px-3 py-1.5 rounded-full border border-brand-cyan/20"
            >
              View All <ChevronRight size={14} className="ml-1" />
            </button>
          </div>
          <div className="flex-1 relative z-10">
            <Standings standings={computed.standings.slice(0, 3)} compact embedded />
          </div>
        </div>

        {/* Top 3 Power Rankings */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 lg:p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="flex items-center justify-between mb-4 sm:mb-5 relative z-10">
            <h3 className="font-bold text-base sm:text-lg text-white tracking-tight">Power Rankings</h3>
            <button
              onClick={() => onNavigate('power')}
              className="text-xs font-semibold text-brand-purple hover:text-white flex items-center transition-colors bg-brand-purple/10 px-3 py-1.5 rounded-full border border-brand-purple/20"
            >
              View All <ChevronRight size={14} className="ml-1" />
            </button>
          </div>
          <div className="flex-1 relative z-10">
            <PowerRankings rankings={computed.powerRankings.slice(0, 3)} standings={computed.standings} compact />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Trades */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 lg:p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="flex items-center justify-between mb-4 sm:mb-5 relative z-10">
            <h3 className="font-bold text-base sm:text-lg text-white tracking-tight">Recent Trades</h3>
            <button
              onClick={() => onNavigate('trades')}
              className="text-xs font-semibold text-brand-green hover:text-white flex items-center transition-colors bg-brand-green/10 px-3 py-1.5 rounded-full border border-brand-green/20"
            >
              View All <ChevronRight size={14} className="ml-1" />
            </button>
          </div>
          <div className="flex-1 relative z-10">
            {computed.rosterMap ? (
              <TradeHistory
                transactions={transactions}
                rosterMap={computed.rosterMap}
                playerMap={draftData.playerMap}
                limit={3}
              />
            ) : (
              <div className="text-gray-500 text-sm flex items-center justify-center h-full">No trades available.</div>
            )}
          </div>
        </div>

        {/* Biggest Blowout */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 lg:p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="flex items-center justify-between mb-4 sm:mb-5 relative z-10">
            <h3 className="font-bold text-base sm:text-lg text-white tracking-tight">Biggest Blowout</h3>
            <button
              onClick={() => onNavigate('games')}
              className="text-xs font-semibold text-red-400 hover:text-white flex items-center transition-colors bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20"
            >
              View All <ChevronRight size={14} className="ml-1" />
            </button>
          </div>
          <div className="flex-1 relative z-10">
            {computed.blowouts.length > 0 ? (
              <BlowoutsAndClose blowouts={computed.blowouts.slice(0, 1)} closest={[]} hideHeaders={true} />
            ) : (
              <div className="text-gray-500 text-sm flex items-center justify-center h-full">No blowouts recorded yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
