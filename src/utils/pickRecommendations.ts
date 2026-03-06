/**
 * Pick Hold / Trade / Trade-Up / Trade-Down Recommendation Engine
 *
 * Pure computation module — no React, no hooks, no API calls.
 * Takes pre-computed franchise outlook data and returns per-pick recommendations.
 */

import type {
  FutureDraftPick,
  FranchiseOutlookResult,
  FranchiseOutlookRawContext,
  StrategyMode,
} from '../types/sleeper';

import type {
  LeagueFormatContext,
  PickVerdict,
  PickRecommendation,
  PickDimensionScores,
} from '../types/recommendations';

// ---- Constants ----

const PICK_WAR_BY_ROUND: Record<number, number> = { 1: 4.0, 2: 2.0, 3: 0.8, 4: 0.3 };
const DEFAULT_PICK_WAR = 0.1;
const YEAR_DISCOUNT = 0.85;

// ---- Strategy-Dependent Weight Tables ----

interface PickWeightProfile {
  rosterImpact: number;
  timelineFit: number;
  portfolioDepth: number;  // inverted before compositing: high depth = more tradeable = lower hold
  warSurplus: number;
  marketTiming: number;    // inverted before compositing: high timing = easy sell = lower hold
}

const PICK_WEIGHT_PROFILES: Record<StrategyMode, PickWeightProfile> = {
  'Full Rebuild':        { rosterImpact: 0.15, timelineFit: 0.25, portfolioDepth: 0.30, warSurplus: 0.10, marketTiming: 0.20 },
  'Asset Accumulation':  { rosterImpact: 0.20, timelineFit: 0.20, portfolioDepth: 0.25, warSurplus: 0.15, marketTiming: 0.20 },
  'Win-Now Pivot':       { rosterImpact: 0.25, timelineFit: 0.20, portfolioDepth: 0.15, warSurplus: 0.25, marketTiming: 0.15 },
  'Steady State':        { rosterImpact: 0.22, timelineFit: 0.18, portfolioDepth: 0.20, warSurplus: 0.22, marketTiming: 0.18 },
  'Push All-In Now':     { rosterImpact: 0.20, timelineFit: 0.10, portfolioDepth: 0.15, warSurplus: 0.30, marketTiming: 0.25 },
};

// ---- Main Export ----

export function computePickRecommendations(
  _userId: string,
  picks: FutureDraftPick[],
  outlook: FranchiseOutlookResult,
  rawContext: FranchiseOutlookRawContext,
  leagueFormat: LeagueFormatContext,
): PickRecommendation[] {
  const currentYear = new Date().getFullYear();
  const totalManagers = rawContext.allRosters.length;
  const strategyMode = outlook.strategyRecommendation.mode;
  const weights = PICK_WEIGHT_PROFILES[strategyMode];

  const { warRank, currentWAR, contenderThreshold, windowLength, youngAssets, warByPosition } = outlook;
  const neededWAR = Math.max(0, contenderThreshold - currentWAR);

  // Franchise WAR percentile (0 = best team, 1 = worst team)
  const warRankPercentile = totalManagers > 0 ? warRank / totalManagers : 0.5;

  // WAR multiplier: WAR-poor teams benefit more from picks than WAR-rich teams
  const franchiseWARMultiplier =
    warRankPercentile >= 0.75 ? 0.7
    : warRankPercentile >= 0.5  ? 0.9
    : warRankPercentile >= 0.25 ? 1.1
    : 1.35;

  // Worst positional deficit (highest rank number = worst = highest need)
  const sortedPositions = [...warByPosition].sort((a, b) => b.rank - a.rank);
  const worstPosition = sortedPositions[0];
  const needWeight = worstPosition && totalManagers > 0
    ? worstPosition.rank / totalManagers
    : 0.5;
  const criticalNeedPosition = needWeight > 0.7 ? (worstPosition?.position ?? null) : null;

  // SuperFlex QB scarcity override signal
  const qbPositionData = warByPosition.find(p => p.position === 'QB');
  const hasQBCriticalNeed = leagueFormat.isSuperFlex &&
    qbPositionData !== undefined &&
    totalManagers > 0 &&
    qbPositionData.rank / totalManagers > 0.7;

  // Count future first-round picks for portfolio depth
  const futureFirsts = picks.filter(p => p.round === 1 && Number(p.season) > currentYear).length;
  const youngAssetsCount = youngAssets.length;

  return picks.map(pick => {
    const yearOffset = Math.max(0, Number(pick.season) - currentYear);
    const baseWAR = PICK_WAR_BY_ROUND[pick.round] ?? DEFAULT_PICK_WAR;
    const yearDiscount = YEAR_DISCOUNT ** yearOffset;

    // Positional scarcity modifier
    const posScarcityModifier = needWeight > 0.7 ? 1.25 : needWeight > 0.3 ? 1.10 : 0.85;

    // Window alignment modifier: picks maturing after window close lose value fast
    let windowAlignmentModifier = 1.0;
    if (yearOffset > windowLength + 2) windowAlignmentModifier = 0.50;
    else if (yearOffset === windowLength + 2) windowAlignmentModifier = 0.65;
    else if (yearOffset === windowLength + 1) windowAlignmentModifier = 0.75;

    const contextualWAR = baseWAR * yearDiscount * franchiseWARMultiplier * posScarcityModifier * windowAlignmentModifier;

    // ---- Dimension Scoring ----

    // 1. Roster Impact (0-100): positional need intensity
    const rosterImpact = Math.min(100, Math.max(0,
      needWeight * 100 + (criticalNeedPosition ? 20 : 0) - (needWeight < 0.3 ? 20 : 0)
    ));

    // 2. Timeline Fit (0-100): does pick mature within franchise window?
    let timelineFit: number;
    if (yearOffset <= windowLength) timelineFit = 100;
    else if (yearOffset === windowLength + 1) timelineFit = 60;
    else if (yearOffset === windowLength + 2) timelineFit = 30;
    else timelineFit = 10;

    // 3. Portfolio Depth (0-100): higher = asset-rich = more tradeable (inverted in composite)
    let portfolioDepth: number;
    if (futureFirsts <= 1 && youngAssetsCount <= 2) portfolioDepth = 20;      // scarce — hold everything
    else if (futureFirsts <= 2 && youngAssetsCount <= 3) portfolioDepth = 45;
    else if (futureFirsts >= 3 || youngAssetsCount >= 4) portfolioDepth = 80;  // asset-rich — liquid
    else portfolioDepth = 55;

    // 4. WAR Surplus (0-100): does contextual pick WAR meaningfully close the gap?
    let warSurplus: number;
    if (neededWAR <= 0) {
      warSurplus = 20;  // already a contender — draft picks less urgent
    } else if (contextualWAR >= neededWAR) {
      warSurplus = 80;
    } else if (contextualWAR >= neededWAR / 2) {
      warSurplus = 55;
    } else {
      warSurplus = 25;
    }

    // 5. Market Timing (0-100): distant picks are easier to sell (inverted in composite)
    let marketTiming: number;
    if (yearOffset >= 3) marketTiming = 80;
    else if (yearOffset === 2) marketTiming = 65;
    else if (yearOffset === 1) marketTiming = 45;
    else marketTiming = 30;  // current draft picks are discounted by buyers

    // Composite: high score = strong HOLD signal
    // portfolioDepth inverted: rich portfolio = more tradeable = lower hold
    // marketTiming inverted: easy to sell = deploy as currency = lower hold
    const composite = Math.round(
      rosterImpact * weights.rosterImpact
      + timelineFit * weights.timelineFit
      + (100 - portfolioDepth) * weights.portfolioDepth
      + warSurplus * weights.warSurplus
      + (100 - marketTiming) * weights.marketTiming
    );

    const scores: PickDimensionScores = {
      rosterImpact: Math.round(rosterImpact),
      timelineFit: Math.round(timelineFit),
      portfolioDepth: Math.round(portfolioDepth),
      warSurplus: Math.round(warSurplus),
      marketTiming: Math.round(marketTiming),
      composite,
    };

    // ---- Verdict Classification + Edge-Case Overrides ----

    let verdict: PickVerdict;
    let overrideApplied: string | null = null;

    // Override 1: Last future 1st — never trade it
    if (pick.round === 1 && futureFirsts <= 1 && composite < 65) {
      verdict = 'HOLD';
      overrideApplied = 'last-future-first';
    }
    // Override 2: Push All-In + pick matures well after window → force TRADE
    else if (strategyMode === 'Push All-In Now' && yearOffset > windowLength + 2) {
      verdict = 'TRADE';
      overrideApplied = 'window-expired';
    }
    // Override 3: Top-4 contender with closing window → all picks are currency
    else if (warRank <= 4 && windowLength <= 2 && yearOffset > 0) {
      verdict = 'TRADE';
      overrideApplied = 'contender-deadline';
    }
    // Override 4: SuperFlex QB critical need in round 1
    else if (hasQBCriticalNeed && pick.round === 1 && composite < 65) {
      verdict = 'HOLD';
      overrideApplied = 'sf-qb-scarcity';
    }
    // Standard thresholds
    else if (composite >= 65) {
      verdict = 'HOLD';
    } else if (composite >= 45) {
      verdict = 'TRADE';
    } else {
      // Low composite: TRADE_UP vs TRADE_DOWN based on mode + roster context
      const isAssetRich = portfolioDepth >= 55;
      const isRebuildMode = strategyMode === 'Full Rebuild' || strategyMode === 'Asset Accumulation';

      if (pick.round === 1 && isAssetRich && criticalNeedPosition !== null) {
        // Asset-rich with critical need in round 1 → trade up for certainty
        verdict = 'TRADE_UP';
      } else if (isRebuildMode && pick.round === 1 && needWeight < 0.5) {
        // Rebuild mode, no critical need → trade down for volume
        verdict = 'TRADE_DOWN';
      } else {
        verdict = 'TRADE';
      }
    }

    // Confidence: how far the composite is from the nearest threshold
    const nearestThreshold = verdict === 'HOLD' ? 65 : 45;
    const confidence = Math.min(100, Math.abs(composite - nearestThreshold) * 3);

    const pickLabel = pick.slot != null
      ? `${pick.season} ${pick.round}.${pick.slot.toString().padStart(2, '0')}`
      : `${pick.season} Rd ${pick.round}`;

    const reason = generatePickReason(
      verdict, pick, pickLabel, yearOffset, windowLength,
      strategyMode, criticalNeedPosition, contextualWAR,
      overrideApplied, leagueFormat.isSuperFlex,
    );

    return {
      pick,
      verdict,
      confidence,
      reason,
      contextualWAR: Math.round(contextualWAR * 100) / 100,
      baseWAR,
      scores,
      criticalNeedPosition,
      overrideApplied,
    };
  });
}

// ---- Reason String Generator ----

function generatePickReason(
  verdict: PickVerdict,
  _pick: FutureDraftPick,
  pickLabel: string,
  yearOffset: number,
  windowLength: number,
  mode: StrategyMode,
  criticalNeedPosition: string | null,
  contextualWAR: number,
  overrideApplied: string | null,
  isSuperFlex: boolean,
): string {
  if (overrideApplied === 'last-future-first') {
    return `You own no other future 1sts — this is a non-negotiable hold. 1st-round picks are your best path to franchise cornerstones.`;
  }
  if (overrideApplied === 'window-expired') {
    const yearsOver = yearOffset - windowLength;
    return `This pick matures ${yearsOver} year${yearsOver > 1 ? 's' : ''} after your window closes. Deploy it as currency for a proven contributor now.`;
  }
  if (overrideApplied === 'contender-deadline') {
    return `Top-4 contender with a ${windowLength}-year window — picks maturing after your window are better deployed to win now.`;
  }
  if (overrideApplied === 'sf-qb-scarcity') {
    return `Critical QB need in a SuperFlex league — 1st-round picks are your best path to a franchise QB. Hold regardless of other signals.`;
  }

  switch (verdict) {
    case 'HOLD':
      if (yearOffset <= windowLength) {
        return `${pickLabel} matures within your ${windowLength}-year window${criticalNeedPosition ? ` and your ${criticalNeedPosition} depth needs reinforcement` : ''}. Keep this for your draft board.`;
      }
      if (isSuperFlex) {
        return `${pickLabel} is a long-term asset. In SuperFlex, 1st-round picks carry QB upside — worth more on your board than as trade currency.`;
      }
      return `${pickLabel} is a long-term asset worth more on your board than as trade currency given your rebuild timeline.`;

    case 'TRADE':
      if (yearOffset > windowLength) {
        return `${pickLabel} matures after your window — its contextual value (${contextualWAR.toFixed(1)} WAR) is better realized by trading for a proven starter now.`;
      }
      return `${pickLabel} (${contextualWAR.toFixed(1)} contextual WAR) is best deployed as currency. Find a known player at your biggest positional need and include this pick in the offer.`;

    case 'TRADE_UP':
      return `${pickLabel} combined with other picks could land a higher-upside prospect${criticalNeedPosition ? ` at ${criticalNeedPosition}` : ''}. Look to move up 3–6 spots above any tier break in Rd ${_pick.round}.`;

    case 'TRADE_DOWN':
      return `No critical positional need makes an elite pick less urgent. In ${mode} mode, trade down for an extra 2nd or 3rd — pick volume beats marginal quality.`;
  }
}
