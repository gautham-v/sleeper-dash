import { useMemo } from 'react';
import { ArrowLeftRight, Trophy, TrendingUp, Handshake, TrendingDown } from 'lucide-react';
import type { SleeperDraftPick, SleeperTransaction } from '../types/sleeper';
import {
  analyzeTrade,
  buildPickValueMap,
  type GradeLetter,
  type TradeOutcome,
} from '../utils/tradeGrading';

interface TradeHistoryProps {
  transactions: SleeperTransaction[];
  rosterMap: Map<number, { teamName: string; displayName: string }>;
  /** Player name map built from draft picks: player_id → { name, position } */
  playerMap: Map<string, { name: string; position: string }>;
  /** Draft picks used to derive player values for trade grading */
  picks: SleeperDraftPick[];
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

const GRADE_STYLES: Record<GradeLetter, string> = {
  A: 'bg-green-500/20 text-green-400 border-green-500/30',
  B: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  C: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  D: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  F: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const VERDICT_CONFIG: Record<
  TradeOutcome,
  { icon: typeof Trophy; style: string; label: (t1: string, t2: string) => string }
> = {
  team1_wins: {
    icon: Trophy,
    style: 'bg-green-500/10 text-green-400 border-green-500/20',
    label: (t1) => `${t1} Won the Trade`,
  },
  team2_wins: {
    icon: Trophy,
    style: 'bg-green-500/10 text-green-400 border-green-500/20',
    label: (_, t2) => `${t2} Won the Trade`,
  },
  team1_edge: {
    icon: TrendingUp,
    style: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    label: (t1) => `Slight Edge to ${t1}`,
  },
  team2_edge: {
    icon: TrendingUp,
    style: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    label: (_, t2) => `Slight Edge to ${t2}`,
  },
  even: {
    icon: Handshake,
    style: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    label: () => 'Mutually Beneficial',
  },
  bad_both: {
    icon: TrendingDown,
    style: 'bg-red-500/10 text-red-400 border-red-500/20',
    label: () => 'Bad for Both Teams',
  },
};

function formatTimestamp(ms: number) {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function GradeBadge({ grade }: { grade: GradeLetter }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold border flex-shrink-0 ${GRADE_STYLES[grade]}`}
    >
      {grade}
    </span>
  );
}

function VerdictBanner({
  outcome,
  team1Name,
  team2Name,
}: {
  outcome: TradeOutcome;
  team1Name: string;
  team2Name: string;
}) {
  const { icon: Icon, style, label } = VERDICT_CONFIG[outcome];
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border mb-3 ${style}`}>
      <Icon size={11} />
      {label(team1Name, team2Name)}
    </div>
  );
}

export function TradeHistory({ transactions, rosterMap, playerMap, picks }: TradeHistoryProps) {
  const pickValueMap = useMemo(() => buildPickValueMap(picks), [picks]);

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
    <div className="space-y-4">
      <p className="text-xs text-gray-500 mb-5">{trades.length} trades completed this season</p>

      {trades.map((trade) => {
        const [id1, id2] = trade.roster_ids;
        const team1 = rosterMap.get(id1);
        const team2 = rosterMap.get(id2);
        const team1Name = team1?.teamName ?? `Team ${id1}`;
        const team2Name = team2?.teamName ?? `Team ${id2}`;

        // Use `adds` to determine what each team RECEIVED
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

        const analysis = analyzeTrade(trade, pickValueMap, playerMap);

        return (
          <div key={trade.transaction_id} className="bg-gray-900 rounded-xl p-5">
            {/* Header row */}
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
              <ArrowLeftRight size={12} />
              <span>Trade · {formatTimestamp(trade.created)}</span>
            </div>

            {/* Verdict banner */}
            {analysis && (
              <VerdictBanner
                outcome={analysis.outcome}
                team1Name={team1Name}
                team2Name={team2Name}
              />
            )}

            {/* Mobile: stacked */}
            <div className="flex flex-col gap-4 sm:hidden">
              <TradeSide
                teamName={team1Name}
                receivedPlayers={t1Receives}
                receivedPicks={t1ReceivesPicks.map((p) => `${p.season} Rd${p.round}`)}
                playerMap={playerMap}
                grade={analysis?.team1Grade}
              />
              <div className="flex items-center gap-2 text-gray-700">
                <div className="flex-1 h-px bg-gray-800" />
                <ArrowLeftRight size={12} />
                <div className="flex-1 h-px bg-gray-800" />
              </div>
              <TradeSide
                teamName={team2Name}
                receivedPlayers={t2Receives}
                receivedPicks={t2ReceivesPicks.map((p) => `${p.season} Rd${p.round}`)}
                playerMap={playerMap}
                grade={analysis?.team2Grade}
              />
            </div>

            {/* Desktop: side-by-side */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
              <TradeSide
                teamName={team1Name}
                receivedPlayers={t1Receives}
                receivedPicks={t1ReceivesPicks.map((p) => `${p.season} Rd${p.round}`)}
                playerMap={playerMap}
                grade={analysis?.team1Grade}
              />
              <div className="pt-1 text-gray-600 self-center">
                <ArrowLeftRight size={16} />
              </div>
              <TradeSide
                teamName={team2Name}
                receivedPlayers={t2Receives}
                receivedPicks={t2ReceivesPicks.map((p) => `${p.season} Rd${p.round}`)}
                playerMap={playerMap}
                grade={analysis?.team2Grade}
                align="right"
              />
            </div>
          </div>
        );
      })}

      <p className="text-xs text-gray-600 pt-1">
        * Grades are based on draft ADP value. Undrafted players use positional estimates.
      </p>
    </div>
  );
}

function TradeSide({
  teamName,
  receivedPlayers,
  receivedPicks,
  playerMap,
  align = 'left',
  grade,
}: {
  teamName: string;
  receivedPlayers: string[];
  receivedPicks: string[];
  playerMap: Map<string, { name: string; position: string }>;
  align?: 'left' | 'right';
  grade?: GradeLetter;
}) {
  const hasContent = receivedPlayers.length > 0 || receivedPicks.length > 0;
  const textAlign = align === 'right' ? 'text-right' : 'text-left';
  const rowJustify = align === 'right' ? 'flex-end' : 'flex-start';

  return (
    <div className={textAlign}>
      {/* Team name row with grade badge */}
      <div
        className="flex items-center gap-1.5 mb-1.5"
        style={{ justifyContent: rowJustify }}
      >
        {align === 'left' && grade && <GradeBadge grade={grade} />}
        <div className="font-semibold text-white text-sm">{teamName}</div>
        {align === 'right' && grade && <GradeBadge grade={grade} />}
      </div>

      <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Receives</div>
      {hasContent ? (
        <div className="space-y-1">
          {receivedPlayers.map((id) => {
            const player = playerMap.get(id);
            const posColor = player
              ? (POSITION_COLORS[player.position] ?? 'text-gray-400')
              : 'text-gray-600';
            return (
              <div
                key={id}
                className="flex items-center gap-1.5"
                style={{ justifyContent: rowJustify }}
              >
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
            <div
              key={p}
              className="text-yellow-400 font-medium"
              style={{ textAlign: align === 'right' ? 'right' : 'left' }}
            >
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
