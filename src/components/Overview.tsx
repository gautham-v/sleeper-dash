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
  onNavigate: (tabId: "standings" | "power" | "trades" | "games" | "overview" | "luck" | "draft" | "history" | "records" | "compare") => void;
}

export function Overview({ computed, transactions, draftData, onNavigate }: OverviewProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 3 Standings */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800/60 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Top Standings</h3>
            <button
              onClick={() => onNavigate('standings')}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center transition-colors"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex-1">
            <Standings standings={computed.standings.slice(0, 3)} />
          </div>
        </div>

        {/* Top 3 Power Rankings */}
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Trades */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800/60 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Recent Trades</h3>
            <button
              onClick={() => onNavigate('trades')}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center transition-colors"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex-1">
            {computed.rosterMap ? (
              <TradeHistory
                transactions={transactions}
                rosterMap={computed.rosterMap}
                playerMap={draftData.playerMap}
                limit={3}
              />
            ) : (
              <div className="text-gray-500 text-sm">No trades available.</div>
            )}
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
