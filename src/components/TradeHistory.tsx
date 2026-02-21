import type { SleeperTransaction } from '../types/sleeper';
import { ArrowLeftRight } from 'lucide-react';

interface TradeHistoryProps {
  transactions: SleeperTransaction[];
  rosterMap: Map<number, { teamName: string; displayName: string }>;
  /** Player name map built from draft picks: player_id → { name, position } */
  playerMap: Map<string, { name: string; position: string }>;
}

const POSITION_COLORS: Record<string, string> = {
  QB: 'text-red-400',
  RB: 'text-green-400',
  WR: 'text-blue-400',
  TE: 'text-yellow-400',
  K: 'text-gray-400',
  DEF: 'text-purple-400',
  DST: 'text-purple-400',
};

function formatTimestamp(ms: number) {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function TradeHistory({ transactions, rosterMap, playerMap }: TradeHistoryProps) {
  const trades = transactions
    .filter((t) => t.type === 'trade' && t.status === 'complete')
    .sort((a, b) => b.created - a.created);

  if (trades.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">
        No trades recorded this season.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 mb-4">{trades.length} trades completed this season</p>
      {trades.map((trade) => {
        const [id1, id2] = trade.roster_ids;
        const team1 = rosterMap.get(id1);
        const team2 = rosterMap.get(id2);

        // Use `adds` to determine what each team RECEIVED (most reliable field in Sleeper trades)
        const t1Receives: string[] = [];
        const t2Receives: string[] = [];

        if (trade.adds) {
          for (const [playerId, rosterId] of Object.entries(trade.adds)) {
            if (rosterId === id1) t1Receives.push(playerId);
            else if (rosterId === id2) t2Receives.push(playerId);
          }
        }

        // Draft picks: owner_id = new owner
        const t1ReceivesPicks =
          trade.draft_picks?.filter((p) => p.owner_id === id1 && p.previous_owner_id === id2) ?? [];
        const t2ReceivesPicks =
          trade.draft_picks?.filter((p) => p.owner_id === id2 && p.previous_owner_id === id1) ?? [];

        return (
          <div key={trade.transaction_id} className="bg-gray-900 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
              <ArrowLeftRight size={12} />
              <span>Trade · {formatTimestamp(trade.created)}</span>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
              <TradeSide
                teamName={team1?.teamName ?? `Team ${id1}`}
                receivedPlayers={t1Receives}
                receivedPicks={t1ReceivesPicks.map((p) => `${p.season} Rd${p.round}`)}
                playerMap={playerMap}
              />
              <div className="pt-1 text-gray-600 self-center">
                <ArrowLeftRight size={16} />
              </div>
              <TradeSide
                teamName={team2?.teamName ?? `Team ${id2}`}
                receivedPlayers={t2Receives}
                receivedPicks={t2ReceivesPicks.map((p) => `${p.season} Rd${p.round}`)}
                playerMap={playerMap}
                align="right"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TradeSide({
  teamName,
  receivedPlayers,
  receivedPicks,
  playerMap,
  align = 'left',
}: {
  teamName: string;
  receivedPlayers: string[];
  receivedPicks: string[];
  playerMap: Map<string, { name: string; position: string }>;
  align?: 'left' | 'right';
}) {
  const hasContent = receivedPlayers.length > 0 || receivedPicks.length > 0;
  const textAlign = align === 'right' ? 'text-right' : 'text-left';

  return (
    <div className={textAlign}>
      <div className="font-semibold text-white text-sm mb-1.5">{teamName}</div>
      <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Receives</div>
      {hasContent ? (
        <div className="space-y-1">
          {receivedPlayers.map((id) => {
            const player = playerMap.get(id);
            const posColor = player ? (POSITION_COLORS[player.position] ?? 'text-gray-400') : 'text-gray-600';
            return (
              <div key={id} className="flex items-center gap-1.5" style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
                {player ? (
                  <>
                    <span className={`text-xs font-semibold ${posColor}`}>{player.position}</span>
                    <span className="text-gray-200">{player.name}</span>
                  </>
                ) : (
                  <span className="text-gray-500 font-mono text-xs">ID:{id.slice(-6)}</span>
                )}
              </div>
            );
          })}
          {receivedPicks.map((p) => (
            <div key={p} className="text-yellow-400 font-medium">
              {p} Pick
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-gray-600">—</div>
      )}
    </div>
  );
}
