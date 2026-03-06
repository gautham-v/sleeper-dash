import type { StrategyMode, FranchiseTier } from './sleeper';

// ---- Hold / Trade / Cut Verdict Types ----

export type PlayerVerdict = 'HOLD' | 'TRADE' | 'CUT';
export type TradeType = 'sell-high' | 'sell-declining' | 'surplus-depth' | 'rebuild-asset';

/**
 * Lightweight HTC result computed for every rostered player across all teams.
 * Uses 4 of 6 dimensions (omits productionAlignment + situationScore which need per-roster stats).
 * Used to identify motivated sellers for trade targeting.
 */
export interface LightweightHTCResult {
  verdict: PlayerVerdict;
  tradeType: TradeType | null;
  htcScore: number;           // lightweight composite 0-100 (lower = stronger trade signal)
  sellWindowScore: number;    // raw sell window 0-100
  ageCurveDirection: 'ascending' | 'stable' | 'declining';
  ownerRosterId: number;
  strategyMode: StrategyMode;
}

export interface LeagueFormatContext {
  isSuperFlex: boolean;
  starterSlots: Record<string, number>;   // position -> count needed (QB: 1, RB: 2, etc.)
  flexPositions: string[];                 // positions that can fill FLEX
  superFlexPositions: string[];            // positions that can fill SUPER_FLEX
  rosterSize: number;
  benchSlots: number;
  hasTaxiSquad: boolean;
  taxiSlots: number;
  scoringFormat: 'ppr' | 'half' | 'standard';
}

export interface DimensionScores {
  productionAlignment: number;    // 0-100
  ageCurveTrajectory: number;     // 0-100
  sellWindow: number;             // 0-100 (high = good time to sell)
  positionalContext: number;      // 0-100 (high = team needs this position)
  strategicFit: number;           // 0-100 (high = fits team strategy)
  situationScore: number;         // 0-100 (injury, depth chart, NFL team quality)
  composite: number;              // weighted combination
}

export interface PlayerRecommendation {
  playerId: string;
  playerName: string;
  position: string;
  age: number | null;
  verdict: PlayerVerdict;
  tradeType: TradeType | null;            // only set when verdict === 'TRADE'
  confidence: number;                      // 0-100
  reason: string;                          // human-readable explanation
  scores: DimensionScores;
  // Context for UI display
  playerWAR: number;
  dynastyValue: number | null;
  ageCurveDirection: 'ascending' | 'stable' | 'declining';
  injuryStatus: string | null;
  isStarter: boolean;                      // fills a required lineup slot
  dominantFactor: string;                  // which dimension drove the verdict most
}

export interface VerdictThresholds {
  hold: number;     // composite >= this = HOLD
  cut: number;      // composite < this = CUT
}

export interface StrategyWeights {
  production: number;
  ageCurve: number;
  sellWindow: number;
  positional: number;
  strategicFit: number;
  situation: number;
}

export interface RosterRecommendations {
  userId: string;
  strategyMode: StrategyMode;
  tier: FranchiseTier;
  windowLength: number;
  leagueFormat: LeagueFormatContext;
  players: PlayerRecommendation[];
  summary: {
    holdCount: number;
    tradeCount: number;
    cutCount: number;
    totalRosterValue: number;              // sum of dynasty values
    tradeableValue: number;                // dynasty value of TRADE-tagged players
    tradeTypeBreakdown: Record<TradeType, number>;
  };
}
