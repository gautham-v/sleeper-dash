import type { SleeperDraftPick, SleeperTransaction } from '../types/sleeper';

export type GradeLetter = 'A' | 'B' | 'C' | 'D' | 'F';

export type TradeOutcome =
  | 'team1_wins'
  | 'team2_wins'
  | 'team1_edge'
  | 'team2_edge'
  | 'even'       // mutually beneficial — both sides got fair value
  | 'bad_both';  // neither side got meaningful assets

export interface TradeAnalysis {
  team1Grade: GradeLetter;
  team2Grade: GradeLetter;
  outcome: TradeOutcome;
  team1Value: number;
  team2Value: number;
}

// Position-based fallback for players not found in the draft (waiver pickups, etc.)
const POSITION_VALUE: Record<string, number> = {
  QB: 35,
  RB: 28,
  WR: 28,
  TE: 22,
  K: 5,
  DEF: 10,
  DST: 10,
};

// Future/traded draft pick value by round
const PICK_ROUND_VALUE: Record<number, number> = {
  1: 55,
  2: 32,
  3: 20,
  4: 14,
  5: 9,
};

function pickRoundValue(round: number): number {
  return PICK_ROUND_VALUE[round] ?? 6;
}

/**
 * Build a map of player_id → value score based on where they were drafted.
 * Pick 1 overall ≈ 100, last pick ≈ 5, linear decay.
 */
export function buildPickValueMap(picks: SleeperDraftPick[]): Map<string, number> {
  const total = picks.length;
  if (total === 0) return new Map();
  return new Map(
    picks.map((p) => [
      p.player_id,
      Math.max(5, Math.round(100 - (p.pick_no / total) * 95)),
    ])
  );
}

function getPlayerValue(
  playerId: string,
  pickValueMap: Map<string, number>,
  playerMap: Map<string, { name: string; position: string }>
): number {
  const draftVal = pickValueMap.get(playerId);
  if (draftVal !== undefined) return draftVal;
  const pos = playerMap.get(playerId)?.position ?? '';
  return POSITION_VALUE[pos] ?? 15;
}

function letterGrade(ratio: number): GradeLetter {
  if (ratio >= 1.4) return 'A';
  if (ratio >= 1.15) return 'B';
  if (ratio >= 0.88) return 'C';
  if (ratio >= 0.65) return 'D';
  return 'F';
}

// If both sides got less than this total combined, treat as "bad for both"
const BAD_BOTH_THRESHOLD = 25;

export function analyzeTrade(
  trade: SleeperTransaction,
  pickValueMap: Map<string, number>,
  playerMap: Map<string, { name: string; position: string }>
): TradeAnalysis | null {
  const [id1, id2] = trade.roster_ids;
  if (id1 == null || id2 == null) return null;

  let v1 = 0; // value Team 1 received
  let v2 = 0; // value Team 2 received

  // Player values — `adds` maps player_id → roster_id that RECEIVED the player
  if (trade.adds) {
    for (const [playerId, rosterId] of Object.entries(trade.adds)) {
      const val = getPlayerValue(playerId, pickValueMap, playerMap);
      if (rosterId === id1) v1 += val;
      else if (rosterId === id2) v2 += val;
    }
  }

  // Draft pick values — owner_id is the new owner
  for (const pick of trade.draft_picks ?? []) {
    const val = pickRoundValue(pick.round);
    if (pick.owner_id === id1 && pick.previous_owner_id === id2) v1 += val;
    else if (pick.owner_id === id2 && pick.previous_owner_id === id1) v2 += val;
  }

  const total = v1 + v2;
  if (total === 0) return null;

  // Bad for both: garbage traded for garbage
  if (v1 < BAD_BOTH_THRESHOLD && v2 < BAD_BOTH_THRESHOLD) {
    return {
      team1Grade: 'D',
      team2Grade: 'D',
      outcome: 'bad_both',
      team1Value: Math.round(v1),
      team2Value: Math.round(v2),
    };
  }

  const ratio1 = v2 > 0 ? v1 / v2 : v1 > 0 ? 3 : 1;
  const ratio2 = v1 > 0 ? v2 / v1 : v2 > 0 ? 3 : 1;
  const diff = Math.abs(v1 - v2) / total;

  let outcome: TradeOutcome;
  if (diff < 0.08) {
    outcome = 'even';
  } else if (diff < 0.22) {
    outcome = v1 > v2 ? 'team1_edge' : 'team2_edge';
  } else {
    outcome = v1 > v2 ? 'team1_wins' : 'team2_wins';
  }

  return {
    team1Grade: letterGrade(ratio1),
    team2Grade: letterGrade(ratio2),
    outcome,
    team1Value: Math.round(v1),
    team2Value: Math.round(v2),
  };
}
