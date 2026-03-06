/**
 * Hold / Trade / Cut Recommendation Engine
 *
 * Pure computation module -- no React, no hooks, no API calls.
 * Takes pre-computed franchise outlook data and returns per-player recommendations.
 */

import type {
  FranchiseOutlookResult,
  FranchiseOutlookRawContext,
  PlayerRosterStat,
  PlayerUsageMetrics,
  SleeperPlayer,
  SleeperRoster,
  StrategyMode,
} from '../types/sleeper';

import type {
  LeagueFormatContext,
  LightweightHTCResult,
  PlayerRecommendation,
  RosterRecommendations,
  PlayerVerdict,
  TradeType,
  StrategyWeights,
  VerdictThresholds,
  DimensionScores,
} from '../types/recommendations';

// ---- Static Age Curve Tables (duplicated from franchiseOutlook.ts) ----

const AGE_CURVES: Record<string, Record<number, number>> = {
  QB: {
    22: 0.75, 23: 0.85, 24: 0.92, 25: 0.97, 26: 1.00, 27: 1.02,
    28: 1.02, 29: 1.01, 30: 1.00, 31: 0.98, 32: 0.95, 33: 0.92,
    34: 0.88, 35: 0.82, 36: 0.75, 37: 0.68, 38: 0.60, 39: 0.50,
  },
  RB: {
    21: 0.85, 22: 0.95, 23: 1.02, 24: 1.05, 25: 1.00, 26: 0.88,
    27: 0.75, 28: 0.60, 29: 0.45, 30: 0.35, 31: 0.25,
  },
  WR: {
    21: 0.75, 22: 0.88, 23: 0.95, 24: 1.00, 25: 1.03, 26: 1.05,
    27: 1.04, 28: 1.02, 29: 0.98, 30: 0.94, 31: 0.88, 32: 0.80,
    33: 0.72, 34: 0.63,
  },
  TE: {
    22: 0.70, 23: 0.82, 24: 0.92, 25: 1.00, 26: 1.05, 27: 1.07,
    28: 1.05, 29: 1.02, 30: 0.98, 31: 0.93, 32: 0.87, 33: 0.80,
    34: 0.72, 35: 0.63,
  },
};

const MULTIPLIER_FLOOR = 0.4;

function getMultiplier(position: string, age: number): number {
  const curve = AGE_CURVES[position];
  if (!curve) return 1.0;
  const ages = Object.keys(curve).map(Number).sort((a, b) => a - b);
  const minAge = ages[0];
  const maxAge = ages[ages.length - 1];
  if (age <= minAge) return curve[minAge];
  if (age >= maxAge) return Math.max(curve[maxAge], MULTIPLIER_FLOOR);
  return curve[age] ?? Math.max(curve[maxAge], MULTIPLIER_FLOOR);
}

// ---- Strategy-Dependent Weight Tables ----

const WEIGHT_PROFILES: Record<StrategyMode, StrategyWeights> = {
  'Push All-In Now': { production: 0.25, ageCurve: 0.15, sellWindow: 0.13, positional: 0.22, strategicFit: 0.15, situation: 0.10 },
  'Steady State':    { production: 0.22, ageCurve: 0.22, sellWindow: 0.08, positional: 0.18, strategicFit: 0.18, situation: 0.12 },
  'Win-Now Pivot':   { production: 0.22, ageCurve: 0.13, sellWindow: 0.22, positional: 0.18, strategicFit: 0.13, situation: 0.12 },
  'Asset Accumulation': { production: 0.15, ageCurve: 0.30, sellWindow: 0.22, positional: 0.08, strategicFit: 0.18, situation: 0.07 },
  'Full Rebuild':    { production: 0.15, ageCurve: 0.25, sellWindow: 0.30, positional: 0.05, strategicFit: 0.20, situation: 0.05 },
};

const VERDICT_THRESHOLDS: Record<StrategyMode, VerdictThresholds> = {
  'Push All-In Now':    { hold: 57, cut: 32 },
  'Steady State':       { hold: 60, cut: 35 },
  'Win-Now Pivot':      { hold: 60, cut: 35 },
  'Asset Accumulation': { hold: 63, cut: 38 },
  'Full Rebuild':       { hold: 66, cut: 40 },
};

// ---- Scoring Dimension Functions ----

/**
 * Dimension 1: Production Alignment (0-100)
 * How much does this player contribute to the team's current WAR?
 */
function scoreProductionAlignment(
  playerWAR: number,
  teamCurrentWAR: number,
  isStarter: boolean,
  usage?: PlayerUsageMetrics,
): number {
  if (teamCurrentWAR <= 0) {
    // Edge case: team has zero or negative WAR -- any positive WAR is meaningful
    return playerWAR > 0 ? Math.min(100, playerWAR * 20) : 0;
  }
  const shareRaw = (playerWAR / teamCurrentWAR) * 100;
  const starterMultiplier = isStarter ? 1.3 : 1.0;
  let score = Math.min(100, Math.max(0, shareRaw * starterMultiplier));

  // Enhanced: usage trend adjustment
  if (usage && usage.gamesPlayed >= 4) {
    // Rising snap share = player's role is growing, production may be understated
    if (usage.snapTrend === 'rising') {
      score = Math.min(100, score * 1.15);
    }
    // Declining snap share = player losing role, production may be overstated
    else if (usage.snapTrend === 'declining') {
      score = score * 0.85;
    }

    // High snap share player with low WAR might be due for positive regression
    if (usage.snapPct >= 0.7 && playerWAR < 1 && score < 40) {
      score = Math.max(score, 35); // floor for high-usage players
    }
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Dimension 2: Age-Curve Trajectory (0-100)
 * Where is this player on their position-specific age curve?
 */
function scoreAgeCurveTrajectory(
  position: string,
  age: number | null,
  windowLength: number,
): { score: number; direction: 'ascending' | 'stable' | 'declining' } {
  if (age == null || !AGE_CURVES[position]) {
    return { score: 50, direction: 'stable' }; // unknown = neutral
  }

  const currentMult = getMultiplier(position, age);
  const futureMult = getMultiplier(position, age + Math.max(1, windowLength));
  const ratio = currentMult > 0 ? futureMult / currentMult : 0;

  let score: number;
  let direction: 'ascending' | 'stable' | 'declining';

  if (ratio > 1.0) {
    // Ascending: map ratio 1.0-1.4+ to 80-100
    score = 80 + Math.min(20, (ratio - 1.0) * 100);
    direction = 'ascending';
  } else if (ratio >= 0.85) {
    // Stable: map ratio 0.85-1.0 to 50-80
    score = 50 + ((ratio - 0.85) / 0.15) * 30;
    direction = 'stable';
  } else {
    // Declining: map ratio 0-0.85 to 0-50
    score = (ratio / 0.85) * 50;
    direction = 'declining';
  }

  // Cross-reference with window: if declining but still productive through window,
  // soften the penalty. Check if the multiplier at end of window is still > 0.7
  if (direction === 'declining' && windowLength > 0) {
    const endOfWindowMult = getMultiplier(position, age + windowLength);
    if (endOfWindowMult >= 0.7) {
      // Still productive through window -- pull score up toward 50
      score = score + (50 - score) * 0.4;
    }
  }

  return { score: Math.min(100, Math.max(0, score)), direction };
}

/**
 * Dimension 3: Sell Window (0-100)
 * Is this the right time to sell this player for maximum return?
 * High score = good time to sell. NOT a simple market value inversion.
 * dynastyValueReference: league P75 dynasty value (stable anchor, not team max)
 */
function scoreSellWindow(
  dynastyValue: number | null,
  dynastyValueReference: number,
  ageCurveNormalized: number,
  usage?: PlayerUsageMetrics,
): number {
  if (dynastyValue == null || dynastyValue <= 0 || dynastyValueReference <= 0) {
    // No market value = untradeable, sell window is irrelevant
    return 0;
  }

  // Cap at 1.0 so players above P75 don't exceed 100% value share
  const valueShare = Math.min(1.0, dynastyValue / dynastyValueReference);
  const declineRate = Math.max(0, 1 - ageCurveNormalized / 100);

  // High dynasty value + declining curve = high sell signal
  // High dynasty value + ascending curve = near-zero sell signal
  let raw = valueShare * declineRate * 100;

  // Enhanced: usage trend amplifies sell signal
  if (usage && usage.gamesPlayed >= 4) {
    // Declining usage on a declining curve = peak sell moment (market hasn't caught up)
    if (usage.snapTrend === 'declining' && declineRate > 0.3) {
      raw *= 1.25;
    }
    // Rising usage on ascending curve = strong hold (market may be undervaluing)
    if (usage.snapTrend === 'rising' && declineRate < 0.2) {
      raw *= 0.5;
    }
  }

  return Math.min(100, Math.max(0, raw));
}

/**
 * Dimension 4: Positional Context (0-100)
 * Does the team need this position, or is it a surplus?
 */
function scorePositionalContext(
  position: string,
  playerWAR: number,
  warByPosition: FranchiseOutlookResult['warByPosition'],
  focusAreas: FranchiseOutlookResult['focusAreas'],
  leagueFormat: LeagueFormatContext,
  isStarter: boolean,
  totalTeams: number,
): number {
  const posEntry = warByPosition.find((p) => p.position === position);
  if (!posEntry) return 50; // unknown position, neutral

  const rank = posEntry.rank; // 1-based, 1 = best
  const totalPositions = totalTeams; // rank is out of total teams in league

  // Determine thirds
  const topThirdCutoff = Math.ceil(totalPositions / 3);
  const bottomThirdCutoff = totalPositions - topThirdCutoff;

  let score: number;

  if (rank >= bottomThirdCutoff) {
    // Bottom third: team is weak at this position
    // Meaningful contributor at a weak position = high score (team needs this)
    const meaningfulThreshold = 1.0; // WAR threshold for "meaningful"
    if (playerWAR >= meaningfulThreshold) {
      score = 80 + Math.min(20, (playerWAR / 5) * 20);
    } else {
      // Weak position but player isn't helping much either
      score = 55 + (playerWAR / meaningfulThreshold) * 25;
    }
  } else if (rank <= topThirdCutoff) {
    // Top third: team is deep at this position -- surplus territory
    // Still value top contributors even in surplus positions
    score = 35 + Math.min(30, (playerWAR / 5) * 30);
  } else {
    // Middle third: moderate need
    score = 50 + Math.min(25, (playerWAR / 5) * 25);
  }

  // Cross-reference with focus areas
  const hasNeedSignal = focusAreas.some(
    (fa) =>
      fa.severity === 'warning' &&
      fa.signal.toLowerCase().includes(position.toLowerCase()),
  );
  if (hasNeedSignal) {
    score = Math.min(100, score + 15);
  }

  // Lineup-slot awareness: player filling required starter slot gets floor at 60
  if (isStarter) {
    score = Math.max(60, score);
  }

  // SuperFlex QB adjustment
  if (leagueFormat.isSuperFlex && position === 'QB') {
    score = Math.min(100, score * 1.4);
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Dimension 5: Strategic Fit (0-100)
 * Does keeping this player align with the team's recommended strategy?
 */
function scoreStrategicFit(
  mode: StrategyMode,
  position: string,
  age: number | null,
  playerWAR: number,
  windowLength: number,
  upsideRatio: number | null,
  isStarter: boolean,
): number {
  const effectiveAge = age ?? 26; // default to mid-career if unknown

  switch (mode) {
    case 'Push All-In Now': {
      // Favor players in their prime window who contribute now
      // Penalize players who won't contribute until after the window
      const peakEnd = effectiveAge + windowLength;
      const inPrime = isInPrimeWindow(position, effectiveAge, peakEnd);
      if (inPrime && playerWAR > 0) {
        return 70 + Math.min(30, playerWAR * 6);
      }
      if (isStarter && playerWAR > 0) {
        return 55 + Math.min(25, playerWAR * 5);
      }
      // Stashes and non-contributors during win window
      if (effectiveAge <= 22 && playerWAR <= 0.5) return 20;
      return 35;
    }

    case 'Steady State': {
      // Balanced -- favor anyone producing and not about to fall off cliff
      if (playerWAR > 0 && isStarter) return 70 + Math.min(20, playerWAR * 4);
      if (playerWAR > 0) return 55 + Math.min(20, playerWAR * 4);
      if (effectiveAge <= 24) return 50; // young stash is fine
      return 30;
    }

    case 'Win-Now Pivot': {
      // Favor proven starters. Young ascending players still fit the window.
      if (isStarter && playerWAR >= 2) return 85;
      if (isStarter && playerWAR > 0) return 65;
      // Young ascending players have value even in win-now — they'll contribute soon
      if (effectiveAge <= 25 && (upsideRatio ?? 0) >= 1.0) return 55;
      // Non-starters with value but not helping now
      if (effectiveAge <= 23 && (upsideRatio ?? 0) >= 1.2) return 45;
      if (playerWAR > 0) return 50;
      if (playerWAR <= 0) return 25;
      return 40;
    }

    case 'Asset Accumulation': {
      // Favor young ascending players. Still value productive players in their prime.
      if (effectiveAge <= 24 && (upsideRatio ?? 0) >= 1.0) {
        return 80 + Math.min(20, (upsideRatio ?? 1) * 8);
      }
      if (effectiveAge <= 24) return 70;
      if (effectiveAge <= 26) return 60;
      // Prime-age players still producing are tradeable but not aggressively so
      if (playerWAR > 2 && effectiveAge <= 28) return 50;
      if (effectiveAge <= 28) return 40;
      // Past prime but still producing — trade candidates, not valueless
      if (playerWAR > 3 && effectiveAge <= 31) return 35;
      if (effectiveAge >= 30) return 20;
      return 30;
    }

    case 'Full Rebuild': {
      // Only favor players under ~24 with upside
      if (effectiveAge <= 23 && (upsideRatio ?? 0) >= 1.0) {
        return 85 + Math.min(15, (upsideRatio ?? 1) * 5);
      }
      if (effectiveAge <= 24) return 70;
      if (effectiveAge <= 25) return 55;
      if (effectiveAge <= 26 && playerWAR > 2) return 40;
      // Veterans with high trade value are still assets to leverage
      if (playerWAR > 3 && effectiveAge <= 28) return 30;
      if (effectiveAge >= 29) return 15;
      if (effectiveAge >= 27) return 20;
      return 25;
    }
  }
}

/**
 * Check if a player is in their prime production window for their position
 */
function isInPrimeWindow(position: string, currentAge: number, endAge: number): boolean {
  const primeRanges: Record<string, [number, number]> = {
    QB: [25, 33],
    RB: [22, 27],
    WR: [24, 29],
    TE: [25, 30],
  };
  const range = primeRanges[position];
  if (!range) return true; // unknown position, assume prime
  // Player's current age overlaps with prime AND the window extends into prime
  return currentAge <= range[1] && endAge >= range[0];
}

/**
 * Dimension 6: Situation Score (0-100)
 * NFL situation context: injury status, depth chart, experience
 */
function scoreSituation(
  injuryStatus: string | null | undefined,
  depthChartOrder: number | null | undefined,
  yearsExp: number | undefined,
  dynastyValue: number | null,
  playerWAR: number,
  usage?: PlayerUsageMetrics,
): number {
  let score = 50; // baseline neutral

  // Injury status adjustments
  if (injuryStatus === 'IR' || injuryStatus === 'PUP') {
    // On IR -- penalize situation but don't tank it if valuable
    if (dynastyValue != null && dynastyValue > 3000) {
      score = 35; // injured but valuable -- moderate penalty
    } else {
      score = 20; // injured and not particularly valuable
    }
  } else if (injuryStatus === 'Out' || injuryStatus === 'Doubtful') {
    score = 30;
  } else if (injuryStatus === 'Questionable') {
    score = 42;
  } else {
    // Healthy
    score = 55;
  }

  // Depth chart adjustments
  if (depthChartOrder != null) {
    if (depthChartOrder === 1) {
      score += 20; // starter bump
    } else if (depthChartOrder === 2) {
      score += 5; // backup/complementary role
    } else if (depthChartOrder >= 3) {
      score -= 15; // deep backup penalty
    }
  }

  // Experience adjustments -- rookies/2nd year get a small boost (development upside)
  if (yearsExp != null) {
    if (yearsExp <= 1) {
      score += 8; // early career upside
    } else if (yearsExp >= 10) {
      score -= 5; // long in the tooth
    }
  }

  // Production check -- positive WAR indicates productive situation
  if (playerWAR >= 3) score += 10;
  else if (playerWAR <= 0) score -= 10;

  // Enhanced: usage metrics from Sleeper weekly stats
  if (usage && usage.gamesPlayed >= 3) {
    // Snap share is the strongest situational indicator
    if (usage.snapPct >= 0.75) {
      score += 12; // entrenched starter
    } else if (usage.snapPct >= 0.50) {
      score += 5;  // significant role
    } else if (usage.snapPct < 0.30 && usage.snapPct > 0) {
      score -= 10; // limited role
    }

    // Snap trend overrides depth chart when available (more current)
    if (usage.snapTrend === 'rising') {
      score += 8; // growing role
    } else if (usage.snapTrend === 'declining') {
      score -= 8; // shrinking role
    }

    // Red zone opportunities indicate scoring upside
    if (usage.redZoneOpps >= 15) {
      score += 5; // heavy red zone usage
    }

    // Target share for receivers (WR/TE)
    if (usage.targetShare >= 0.20) {
      score += 8; // alpha target share
    } else if (usage.targetShare >= 0.12) {
      score += 3; // solid target share
    }

    // Rush share for RBs
    if (usage.rushShare >= 0.50) {
      score += 8; // bell-cow workload
    } else if (usage.rushShare >= 0.30) {
      score += 3; // meaningful share
    }
  }

  return Math.min(100, Math.max(0, score));
}

// ---- Composite Scoring & Verdict Logic ----

function computeComposite(scores: Omit<DimensionScores, 'composite'>, weights: StrategyWeights): number {
  return (
    scores.productionAlignment * weights.production +
    scores.ageCurveTrajectory * weights.ageCurve +
    scores.sellWindow * weights.sellWindow +
    scores.positionalContext * weights.positional +
    scores.strategicFit * weights.strategicFit +
    scores.situationScore * weights.situation
  );
}

function computeVerdict(composite: number, thresholds: VerdictThresholds): PlayerVerdict {
  if (composite >= thresholds.hold) return 'HOLD';
  if (composite < thresholds.cut) return 'CUT';
  return 'TRADE';
}

function computeConfidence(composite: number, verdict: PlayerVerdict, thresholds: VerdictThresholds): number {
  let nearestThreshold: number;

  if (verdict === 'HOLD') {
    nearestThreshold = thresholds.hold;
  } else if (verdict === 'CUT') {
    nearestThreshold = thresholds.cut;
  } else {
    // TRADE -- between the two thresholds, pick the closer one
    const distToHold = thresholds.hold - composite;
    const distToCut = composite - thresholds.cut;
    nearestThreshold = distToCut < distToHold ? thresholds.cut : thresholds.hold;
  }

  return Math.min(100, Math.abs(composite - nearestThreshold) * 3);
}

// ---- Trade Type Classification ----

function classifyTradeType(
  dynastyValue: number | null,
  ageCurveDirection: 'ascending' | 'stable' | 'declining',
  ageCurveScore: number,
  posRank: number | undefined,
  totalTeams: number,
  mode: StrategyMode,
  playerWAR: number,
): TradeType {
  const isRebuildMode = mode === 'Full Rebuild' || mode === 'Asset Accumulation';
  const hasSurplus = posRank != null && posRank <= Math.ceil(totalTeams / 3);
  const highValue = dynastyValue != null && dynastyValue >= 4000;

  // sell-high: high dynasty value + declining curve
  if (highValue && ageCurveDirection === 'declining') {
    return 'sell-high';
  }

  // sell-declining: moderate value + aging past peak
  if (ageCurveDirection === 'declining' && ageCurveScore < 40) {
    return 'sell-declining';
  }

  // surplus-depth: team deep at position + player is depth piece
  if (hasSurplus && playerWAR < 3) {
    return 'surplus-depth';
  }

  // rebuild-asset: team in rebuild/accumulation mode
  if (isRebuildMode) {
    return 'rebuild-asset';
  }

  // Default fallback based on curve
  if (ageCurveDirection === 'declining') return 'sell-declining';
  return 'surplus-depth';
}

// ---- Reason String Generation ----

function findDominantFactor(scores: Omit<DimensionScores, 'composite'>, weights: StrategyWeights): string {
  const contributions: [string, number][] = [
    ['production', scores.productionAlignment * weights.production],
    ['ageCurve', scores.ageCurveTrajectory * weights.ageCurve],
    ['sellWindow', scores.sellWindow * weights.sellWindow],
    ['positional', scores.positionalContext * weights.positional],
    ['strategicFit', scores.strategicFit * weights.strategicFit],
    ['situation', scores.situationScore * weights.situation],
  ];
  contributions.sort((a, b) => b[1] - a[1]);
  return contributions[0][0];
}

function generateReason(
  verdict: PlayerVerdict,
  tradeType: TradeType | null,
  position: string,
  age: number | null,
  playerWAR: number,
  dynastyValue: number | null,
  ageCurveDirection: 'ascending' | 'stable' | 'declining',
  dominantFactor: string,
  windowLength: number,
  mode: StrategyMode,
  isStarter: boolean,
  injuryStatus: string | null,
  upsideRatio: number | null,
  isSuperFlex: boolean,
): string {
  const ageStr = age != null ? `${age}yo` : '';
  const posStr = position;
  const warStr = playerWAR.toFixed(1);
  const valueStr = dynastyValue != null ? Math.round(dynastyValue).toLocaleString() : 'no';
  const primeWindows: Record<string, string> = { QB: '25-32', RB: '22-27', WR: '24-29', TE: '25-30' };
  const primeStr = primeWindows[position] ?? '';
  const isInPrime = age != null && primeStr && age >= parseInt(primeStr) && age <= parseInt(primeStr.split('-')[1]);
  const isPastPrime = age != null && primeStr && age > parseInt(primeStr.split('-')[1]);
  const isPrePrime = age != null && primeStr && age < parseInt(primeStr);

  if (verdict === 'HOLD') {
    if (injuryStatus === 'IR' && dynastyValue != null && dynastyValue > 3000) {
      return `On IR but elite dynasty asset (${valueStr} value) — hold through recovery.`;
    }
    if (ageCurveDirection === 'ascending' && upsideRatio != null && upsideRatio >= 1.3) {
      return `${ageStr} ${posStr} still ascending with ${upsideRatio.toFixed(1)}x upside — prime years ahead.`;
    }
    if (isPrePrime && ageCurveDirection === 'ascending') {
      return `${ageStr} ${posStr} entering prime window (${primeStr}) — ceiling hasn't been reached yet.`;
    }
    if (isInPrime && playerWAR > 5 && isStarter) {
      return `Elite ${posStr} in prime (${primeStr}) producing ${warStr} WAR — franchise cornerstone.`;
    }
    if (dominantFactor === 'production' && isStarter) {
      return `Core ${posStr} starter producing ${warStr} WAR${windowLength > 0 ? ` through your ${windowLength}-year window` : ''}.`;
    }
    if (dominantFactor === 'positional') {
      return `Key ${posStr} on a roster thin at the position — can't afford to lose this depth.`;
    }
    if (isSuperFlex && position === 'QB') {
      return `${ageStr} QB in SuperFlex — positional scarcity makes QBs premium holds.`;
    }
    if (dominantFactor === 'strategicFit') {
      if (mode === 'Full Rebuild' || mode === 'Asset Accumulation') {
        return `${ageStr} ${posStr} fits your rebuild timeline — ${ageCurveDirection} curve with years of value ahead.`;
      }
      return `Strong fit for ${mode.toLowerCase()} — ${ageCurveDirection} trajectory aligns with your window.`;
    }
    if (ageCurveDirection === 'ascending') {
      return `${ageStr} ${posStr} on an ascending curve — production trending up, hold for appreciation.`;
    }
    return `${ageStr} ${posStr} contributing ${warStr} WAR — solid roster piece${isInPrime ? ' in prime' : ''}.`;
  }

  if (verdict === 'TRADE') {
    switch (tradeType) {
      case 'sell-high':
        if (position === 'RB' && isPastPrime) {
          return `${ageStr} RB past the cliff (prime ${primeStr}) but still valued at ${valueStr} — sell before the drop.`;
        }
        return `Peak value window — ${ageCurveDirection} curve means ${valueStr} value is as high as it gets.`;
      case 'sell-declining':
        if (position === 'RB' && age != null && age >= 28) {
          return `${ageStr} RB entering steep decline — RBs age fastest, move now while ${valueStr} value remains.`;
        }
        if (isPastPrime) {
          return `${ageStr} ${posStr} past prime (${primeStr}) — value dropping, trade for future assets.`;
        }
        return `${ageCurveDirection} ${posStr} losing value — trade before the market catches up (${valueStr} remaining).`;
      case 'surplus-depth':
        if (playerWAR > 3) {
          return `Strong ${posStr} but you're deep here — convert surplus value (${valueStr}) into a weaker position.`;
        }
        return `Depth ${posStr} at a position of strength — roster spot better used elsewhere.`;
      case 'rebuild-asset':
        if (isInPrime && playerWAR > 3) {
          return `Productive ${ageStr} ${posStr} (${warStr} WAR) but won't align with your rebuild — sell for picks/youth while value is high.`;
        }
        if (isPastPrime) {
          return `${ageStr} ${posStr} past prime — your rebuild won't be ready before decline, extract ${valueStr} value now.`;
        }
        return `${ageStr} ${posStr} with ${valueStr} trade value — timeline doesn't match your ${windowLength > 0 ? `${windowLength}-year ` : ''}rebuild.`;
      default:
        return `Trade candidate — ${ageCurveDirection} trajectory with ${valueStr} dynasty value.`;
    }
  }

  // CUT
  if (playerWAR <= 0 && (dynastyValue == null || dynastyValue <= 0)) {
    if (isPastPrime) {
      return `${ageStr} ${posStr} past prime with no trade value — free the roster spot for upside.`;
    }
    return `No dynasty value and negative WAR — roster clogger, use the spot on a waiver flier.`;
  }
  if (injuryStatus === 'IR') {
    return `On IR with minimal value (${valueStr}) — not worth the roster spot through recovery.`;
  }
  if (playerWAR <= 0) {
    return `Negative production (${warStr} WAR) with minimal trade market — free the spot.`;
  }
  return `${ageStr} ${posStr} below the roster threshold for ${mode.toLowerCase()} — ${warStr} WAR isn't enough to justify the spot.`;
}

// ---- Helper: Find upside ratio for a player ----

function findUpsideRatio(
  playerId: string,
  playerName: string,
  youngAssets: FranchiseOutlookResult['youngAssets'],
): number | null {
  // Try ID-based lookup first (most reliable), fall back to name match
  const byId = youngAssets.find((ya) => ya.playerId === playerId);
  if (byId) return byId.upsideRatio;
  const byName = youngAssets.find((ya) => ya.name === playerName);
  return byName?.upsideRatio ?? null;
}

// ---- Main Computation Function ----

export function computePlayerRecommendations(
  userId: string,
  outlook: FranchiseOutlookResult,
  rawContext: FranchiseOutlookRawContext,
  rosterStats: PlayerRosterStat[],
  leagueFormat: LeagueFormatContext,
  roster: SleeperRoster,
): RosterRecommendations {
  const mode = outlook.strategyRecommendation.mode;
  const tier = outlook.tier;
  const windowLength = outlook.windowLength;
  const weights = WEIGHT_PROFILES[mode];
  const thresholds = VERDICT_THRESHOLDS[mode];
  const totalTeams = rawContext.allRosters.length;

  const playerIds = roster.players ?? [];
  const starterIds = new Set(roster.starters ?? []);

  // Compute max dynasty value on the roster for sell-window normalization
  let maxDynastyValueOnRoster = 0;
  const rosterDynastyValues: Map<string, number | null> = new Map();
  for (const pid of playerIds) {
    const dv = rawContext.fcMap.get(pid) ?? null;
    rosterDynastyValues.set(pid, dv);
    if (dv != null && dv > maxDynastyValueOnRoster) {
      maxDynastyValueOnRoster = dv;
    }
  }

  // Compute median dynasty value for IR floor check
  const allRosteredValues = playerIds
    .map((pid) => rawContext.fcMap.get(pid) ?? 0)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const medianDynastyValue =
    allRosteredValues.length > 0
      ? allRosteredValues[Math.floor(allRosteredValues.length / 2)]
      : 0;

  // Rank players by WAR on this roster for "top-3 contributor" check
  const rosterPlayerWARs = playerIds
    .map((pid) => ({ pid, war: rawContext.playerWARMap.get(pid) ?? 0 }))
    .sort((a, b) => b.war - a.war);
  const top3WARIds = new Set(rosterPlayerWARs.slice(0, 3).map((p) => p.pid));

  // Build lookup for position rank from warByPosition
  const posRankMap = new Map<string, number>();
  for (const wp of outlook.warByPosition) {
    posRankMap.set(wp.position, wp.rank);
  }

  // Count starters at each position for "required starter with no replacement" check
  const starterCountByPos = new Map<string, number>();
  const rosterCountByPos = new Map<string, number>();
  for (const pid of playerIds) {
    const player = rawContext.allPlayers[pid];
    const pos = player?.position ?? null;
    if (pos) {
      rosterCountByPos.set(pos, (rosterCountByPos.get(pos) ?? 0) + 1);
      if (starterIds.has(pid)) {
        starterCountByPos.set(pos, (starterCountByPos.get(pos) ?? 0) + 1);
      }
    }
  }

  // Build roster stats lookup
  const rosterStatsMap = new Map<string, PlayerRosterStat>();
  for (const rs of rosterStats) {
    rosterStatsMap.set(rs.playerId, rs);
  }

  const recommendations: PlayerRecommendation[] = [];

  for (const pid of playerIds) {
    const player = rawContext.allPlayers[pid];
    if (!player) continue; // skip unknown players (e.g., empty slots like "0")

    const position = player.position ?? 'UNKNOWN';
    // Skip non-skill positions (K, DEF, DL, LB, DB, etc.)
    if (!['QB', 'RB', 'WR', 'TE'].includes(position)) continue;

    const playerName = `${player.first_name} ${player.last_name}`;
    const age = player.age ?? null;
    const playerWAR = rawContext.playerWARMap.get(pid) ?? 0;
    const dynastyValue = rosterDynastyValues.get(pid) ?? null;
    const isStarter = starterIds.has(pid);
    const injuryStatus = player.injury_status ?? null;
    const depthChartOrder = player.depth_chart_order ?? null;
    const yearsExp = player.years_exp;
    const upsideRatio = findUpsideRatio(pid, playerName, outlook.youngAssets);
    const usage = rosterStatsMap.get(pid)?.usage;

    // ---- Score all 6 dimensions ----

    const productionAlignment = scoreProductionAlignment(
      playerWAR,
      outlook.currentWAR,
      isStarter,
      usage,
    );

    const { score: ageCurveTrajectory, direction: ageCurveDirection } = scoreAgeCurveTrajectory(
      position,
      age,
      windowLength,
    );

    const sellWindow = scoreSellWindow(
      dynastyValue,
      maxDynastyValueOnRoster,
      ageCurveTrajectory,
      usage,
    );

    const positionalContext = scorePositionalContext(
      position,
      playerWAR,
      outlook.warByPosition,
      outlook.focusAreas,
      leagueFormat,
      isStarter,
      totalTeams,
    );

    const strategicFit = scoreStrategicFit(
      mode,
      position,
      age,
      playerWAR,
      windowLength,
      upsideRatio,
      isStarter,
    );

    const situationScore = scoreSituation(
      injuryStatus,
      depthChartOrder,
      yearsExp,
      dynastyValue,
      playerWAR,
      usage,
    );

    // ---- Compute composite ----

    const dimensionScores = {
      productionAlignment,
      ageCurveTrajectory,
      sellWindow,
      positionalContext,
      strategicFit,
      situationScore,
    };

    // NOTE: sellWindow is inverted for composite -- high sell window means the player
    // is a TRADE candidate, which LOWERS the hold score. We invert it so that a high
    // sell signal reduces the composite (making TRADE/CUT more likely).
    const compositeScores = {
      ...dimensionScores,
      sellWindow: 100 - sellWindow, // invert: high sell window = lower composite
    };

    const composite = computeComposite(compositeScores, weights);

    // ---- Determine verdict ----

    let verdict = computeVerdict(composite, thresholds);
    let confidence = computeConfidence(composite, verdict, thresholds);

    // ---- Edge-case overrides ----

    // 1. dynastyValue null/zero AND playerWAR <= 0 -> force CUT
    if ((dynastyValue == null || dynastyValue <= 0) && playerWAR <= 0) {
      verdict = 'CUT';
      confidence = Math.max(confidence, 80);
    }

    // 2. Top-3 WAR contributor AND team is Contender -> floor at HOLD
    if (top3WARIds.has(pid) && tier === 'Contender') {
      if (verdict !== 'HOLD') {
        verdict = 'HOLD';
        confidence = Math.max(20, confidence); // lower confidence since it was overridden
      }
    }

    // 3. Age <= 23 with upsideRatio >= 1.5 AND Rebuilding/Asset Accum -> floor at HOLD
    if (
      age != null &&
      age <= 23 &&
      upsideRatio != null &&
      upsideRatio >= 1.5 &&
      (mode === 'Full Rebuild' || mode === 'Asset Accumulation')
    ) {
      if (verdict !== 'HOLD') {
        verdict = 'HOLD';
        confidence = Math.max(20, confidence);
      }
    }

    // 4. injury_status === 'IR' AND dynastyValue in top 50% -> floor at TRADE (don't Cut)
    if (
      injuryStatus === 'IR' &&
      dynastyValue != null &&
      dynastyValue >= medianDynastyValue &&
      medianDynastyValue > 0 &&
      verdict === 'CUT'
    ) {
      verdict = 'TRADE';
      confidence = Math.max(15, confidence);
    }

    // 5. QB in SuperFlex: floor at TRADE (never Cut ascending QBs; only cut truly worthless QBs)
    if (leagueFormat.isSuperFlex && position === 'QB') {
      if (verdict === 'CUT') {
        // Ascending QBs always worth a roster spot in SF
        if (ageCurveDirection === 'ascending' || ageCurveDirection === 'stable') {
          verdict = 'TRADE';
          confidence = Math.max(15, confidence);
        }
        // Only CUT truly replacement-level QBs: negative WAR AND near-zero dynasty value AND old
        else if (dynastyValue != null && dynastyValue >= 500) {
          verdict = 'TRADE';
          confidence = Math.max(15, confidence);
        }
      }
    }

    // 6. Required starter with no replacement -> floor at HOLD
    if (isStarter) {
      const posCount = rosterCountByPos.get(position) ?? 0;
      const starterCount = starterCountByPos.get(position) ?? 0;
      const requiredSlots = leagueFormat.starterSlots[position] ?? 0;
      // If removing this player would leave fewer players than required starter slots
      if (posCount - 1 < requiredSlots || (posCount <= starterCount && requiredSlots > 0)) {
        if (verdict !== 'HOLD') {
          verdict = 'HOLD';
          confidence = Math.max(15, confidence);
        }
      }
    }

    // ---- Trade type classification ----

    const tradeType: TradeType | null =
      verdict === 'TRADE'
        ? classifyTradeType(
            dynastyValue,
            ageCurveDirection,
            ageCurveTrajectory,
            posRankMap.get(position),
            totalTeams,
            mode,
            playerWAR,
          )
        : null;

    // ---- Dominant factor ----

    const dominantFactor = findDominantFactor(dimensionScores, weights);

    // ---- Reason string ----

    const reason = generateReason(
      verdict,
      tradeType,
      position,
      age,
      playerWAR,
      dynastyValue,
      ageCurveDirection,
      dominantFactor,
      windowLength,
      mode,
      isStarter,
      injuryStatus,
      upsideRatio,
      leagueFormat.isSuperFlex,
    );

    // ---- Build full dimension scores with composite ----

    const fullScores: DimensionScores = {
      ...dimensionScores,
      composite,
    };

    recommendations.push({
      playerId: pid,
      playerName,
      position,
      age,
      verdict,
      tradeType,
      confidence: Math.round(confidence),
      reason,
      scores: fullScores,
      playerWAR,
      dynastyValue,
      ageCurveDirection,
      injuryStatus,
      isStarter,
      dominantFactor,
    });
  }

  // ---- Sort: HOLD first, then TRADE, then CUT; within each group by composite desc ----

  const verdictOrder: Record<PlayerVerdict, number> = { HOLD: 0, TRADE: 1, CUT: 2 };
  recommendations.sort((a, b) => {
    const vDiff = verdictOrder[a.verdict] - verdictOrder[b.verdict];
    if (vDiff !== 0) return vDiff;
    return b.scores.composite - a.scores.composite;
  });

  // ---- Build summary ----

  let holdCount = 0;
  let tradeCount = 0;
  let cutCount = 0;
  let totalRosterValue = 0;
  let tradeableValue = 0;
  const tradeTypeBreakdown: Record<TradeType, number> = {
    'sell-high': 0,
    'sell-declining': 0,
    'surplus-depth': 0,
    'rebuild-asset': 0,
  };

  for (const rec of recommendations) {
    if (rec.verdict === 'HOLD') holdCount++;
    else if (rec.verdict === 'TRADE') tradeCount++;
    else cutCount++;

    if (rec.dynastyValue != null) {
      totalRosterValue += rec.dynastyValue;
      if (rec.verdict === 'TRADE') {
        tradeableValue += rec.dynastyValue;
      }
    }

    if (rec.verdict === 'TRADE' && rec.tradeType != null) {
      tradeTypeBreakdown[rec.tradeType]++;
    }
  }

  return {
    userId,
    strategyMode: mode,
    tier,
    windowLength,
    leagueFormat,
    players: recommendations,
    summary: {
      holdCount,
      tradeCount,
      cutCount,
      totalRosterValue,
      tradeableValue,
      tradeTypeBreakdown,
    },
  };
}

// ---- Lightweight HTC (cross-roster, 4-dimension) ----

/**
 * Lightweight HTC for a single player using only data available in rawContext.
 * Omits productionAlignment (needs rosterStats) and situationScore (needs snap data).
 * Used to identify motivated sellers across all league rosters.
 */
export function computeLightweightHTC(
  player: SleeperPlayer,
  _playerId: string,
  playerWAR: number,
  dynastyValue: number | null,
  maxDynastyValueOnRoster: number,
  outlook: FranchiseOutlookResult,
  rawContext: FranchiseOutlookRawContext,
  leagueFormat: LeagueFormatContext,
  ownerRosterId: number,
): LightweightHTCResult {
  const mode = outlook.strategyRecommendation.mode;
  const position = player.position ?? 'UNKNOWN';
  const age = player.age ?? null;
  const windowLength = outlook.windowLength;
  const totalTeams = rawContext.allRosters.length;

  // Lightweight weight profiles (4 dimensions only, renormalized)
  // Original weights sum to 1.0 across 6 dims; here we use 4 and renormalize.
  // ageCurve: 0.30, sellWindow: 0.30, positional: 0.20, strategicFit: 0.20
  const weights = {
    ageCurve: 0.30,
    sellWindow: 0.30,
    positional: 0.20,
    strategicFit: 0.20,
  };

  const { score: ageCurveTrajectory, direction: ageCurveDirection } = scoreAgeCurveTrajectory(
    position,
    age,
    windowLength,
  );

  const sellWindowScore = scoreSellWindow(
    dynastyValue,
    maxDynastyValueOnRoster,
    ageCurveTrajectory,
    undefined,
  );

  const positionalContext = scorePositionalContext(
    position,
    playerWAR,
    outlook.warByPosition,
    outlook.focusAreas,
    leagueFormat,
    false, // conservative: no starter info available cross-roster
    totalTeams,
  );

  const upsideRatio = outlook.youngAssets.find(
    (ya) => ya.name === `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim(),
  )?.upsideRatio ?? null;

  const strategicFit = scoreStrategicFit(
    mode,
    position,
    age,
    playerWAR,
    windowLength,
    upsideRatio,
    false,
  );

  // Invert sellWindow for composite (high sell signal = lower composite = more tradeable)
  const composite =
    ageCurveTrajectory * weights.ageCurve +
    (100 - sellWindowScore) * weights.sellWindow +
    positionalContext * weights.positional +
    strategicFit * weights.strategicFit;

  // Use lightweight thresholds (slightly more aggressive toward TRADE)
  const LIGHTWEIGHT_HOLD_THRESHOLD = 58;
  const LIGHTWEIGHT_CUT_THRESHOLD = 30;

  let verdict: PlayerVerdict;
  if (composite >= LIGHTWEIGHT_HOLD_THRESHOLD) verdict = 'HOLD';
  else if (composite < LIGHTWEIGHT_CUT_THRESHOLD) verdict = 'CUT';
  else verdict = 'TRADE';

  // Force CUT for truly worthless players
  if ((dynastyValue == null || dynastyValue <= 0) && playerWAR <= 0) {
    verdict = 'CUT';
  }

  // Classify trade type
  const posRankMap = new Map<string, number>();
  for (const wp of outlook.warByPosition) posRankMap.set(wp.position, wp.rank);
  const tradeType: TradeType | null =
    verdict === 'TRADE'
      ? classifyTradeType(
          dynastyValue,
          ageCurveDirection,
          ageCurveTrajectory,
          posRankMap.get(position),
          totalTeams,
          mode,
          playerWAR,
        )
      : null;

  return {
    verdict,
    tradeType,
    htcScore: Math.round(composite),
    sellWindowScore: Math.round(sellWindowScore),
    ageCurveDirection,
    ownerRosterId,
    strategyMode: mode,
  };
}
