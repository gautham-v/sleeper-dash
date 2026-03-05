import type { HistoricalRookie } from '@/lib/supabase';

// ── Outcome tier thresholds (calibrated against historical_rookies DB, 2015-2024) ──
// These PPR-per-season values define dynasty-relevant tiers.
// Old WR thresholds (250/150) were too high — p90 of R1 WRs is only ~234pts.
// Recalibrated so R1 WR shows realistic 14% elite, 49% starter rates.
export const OUTCOME_TIERS: Record<string, { elite: number; starter: number; rotational: number }> = {
  QB: { elite: 380, starter: 260, rotational: 130 }, // top-5 QB / QB1 / streamable
  RB: { elite: 175, starter: 110, rotational: 55  }, // top-8 RB / RB2 / handcuff
  WR: { elite: 225, starter: 130, rotational: 65  }, // top-12 WR / WR2 / flex
  TE: { elite: 150, starter:  90, rotational: 40  }, // top-5 TE / TE1 / streamer
};

// ── Base rate priors for Bayesian shrinkage ───────────────────────────────────
// Empirically derived from historical_rookies (2015-2024, Year 2 PPR).
// Used to shrink comp-pool probabilities toward reality when the comp pool is small.
// Formula: P_adjusted = (N/(N+K)) * P_comps + (K/(N+K)) * P_prior   (K=20)
export const BASE_RATES: Record<string, Record<number, { pElite: number; pStarter: number }>> = {
  WR: {
    1: { pElite: 0.140, pStarter: 0.488 },
    2: { pElite: 0.064, pStarter: 0.340 },
    3: { pElite: 0.020, pStarter: 0.216 }, // 0% observed; floor at 2% (n=28, limited)
    4: { pElite: 0.043, pStarter: 0.174 },
    5: { pElite: 0.030, pStarter: 0.150 },
    6: { pElite: 0.010, pStarter: 0.050 },
    7: { pElite: 0.010, pStarter: 0.040 },
  },
  RB: {
    1: { pElite: 0.643, pStarter: 0.786 },
    2: { pElite: 0.375, pStarter: 0.500 },
    3: { pElite: 0.296, pStarter: 0.430 }, // raw DB shows 55.6% — smoothed down (N=25, noisy)
    4: { pElite: 0.063, pStarter: 0.188 },
    5: { pElite: 0.060, pStarter: 0.180 },
    6: { pElite: 0.020, pStarter: 0.095 },
    7: { pElite: 0.020, pStarter: 0.080 },
  },
  TE: {
    1: { pElite: 0.200, pStarter: 0.600 },
    2: { pElite: 0.118, pStarter: 0.412 },
    3: { pElite: 0.095, pStarter: 0.143 },
    4: { pElite: 0.037, pStarter: 0.222 },
    5: { pElite: 0.030, pStarter: 0.063 },
    6: { pElite: 0.010, pStarter: 0.050 },
    7: { pElite: 0.010, pStarter: 0.040 },
  },
  QB: {
    1: { pElite: 0.057, pStarter: 0.371 },
    2: { pElite: 0.010, pStarter: 0.200 },
    3: { pElite: 0.010, pStarter: 0.050 },
    4: { pElite: 0.010, pStarter: 0.040 },
    5: { pElite: 0.010, pStarter: 0.030 },
    6: { pElite: 0.010, pStarter: 0.020 },
    7: { pElite: 0.010, pStarter: 0.020 },
  },
};

// Bayesian shrinkage strength: K=20 means we need N≥20 comps before comp pool
// contributes more than the prior. Below N=10, prior dominates (correct behavior).
const SHRINKAGE_K = 20;

/** Get base rate prior for a position+round, defaulting to round 4+ rates */
function getBaseRate(position: string, draftRound: number | undefined): { pElite: number; pStarter: number } {
  const posRates = BASE_RATES[position];
  if (!posRates) return { pElite: 0.02, pStarter: 0.10 };
  const round = Math.min(7, Math.max(1, draftRound ?? 4));
  return posRates[round] ?? posRates[4] ?? { pElite: 0.02, pStarter: 0.10 };
}

// Max position rank for normalizing distance
const MAX_POS_RANK = 24;
// Max breakout age delta for normalizing (typical range ≈ 20-25 years)
const MAX_BREAKOUT_AGE_DELTA = 5;
// Athletic score (RAS) is 0-10 scale; max meaningful delta is 10
const MAX_ATHLETIC_DELTA = 10;
// Dominator rating is 0–100 scale; max practical spread is ~40 (elite=35+, late-round=5)
const MAX_DOMINATOR_DELTA = 40;

// ── Output types ──────────────────────────────────────────────────────────────

export interface CompPlayer {
  name: string;
  draftYear: number;
  draftRound?: number;
  draftPick?: number;
  year1PPR?: number;
  year2PPR?: number;
  year3PPR?: number;
  similarity: number; // 1 - distance, range 0–1
}

export interface OutcomeDistribution {
  elite: number;       // percentage 0–100 (Bayesian-shrunk toward base rate)
  starter: number;
  rotational: number;
  bust: number;
  sampleSize: number;
}

export interface CompResults {
  comps: CompPlayer[];
  distributions: {
    year1: OutcomeDistribution | null;
    year2: OutcomeDistribution | null;
    year3: OutcomeDistribution | null;
  };
  medianPPR: { year1: number | null; year2: number | null; year3: number | null };
  confidence: 'high' | 'medium' | 'low';
  poolSize: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute normalized distance between a prospect and a historical rookie.
 *
 * Priority / weighting:
 * 1. Position rank within class  (primary: WR#3 in class → historical WR#3s)
 * 2. Overall pick number         (log-transformed: early picks more differentiated)
 * 3. Breakout age                (age-at-draft proxy for development stage)
 * 4. Athletic score              (RAS-style 0–10 score from combine measurements)
 * 5. Draft round                 (coarse fallback when nothing else is available)
 *
 * Pick distance is LOG-TRANSFORMED so picks 1-10 are far more differentiated
 * from each other than picks 100-110, matching real draft capital value curves.
 */
function computeDistance(
  prospect: {
    draftRound?: number;
    draftPick?: number;
    positionRank?: number;
    breakoutAge?: number;
    athleticScore?: number;
    /**
     * Dominator rating (0–100): share of team's receiving/rushing output in final
     * college season. Elite WR: 30+, avg R1 WR: ~24. Computed from CFBD stats.
     */
    dominatorRating?: number;
  },
  historical: HistoricalRookie,
): number {
  const hasPosRank  = prospect.positionRank != null && historical.pos_rank_in_class != null;
  const hasPick     = prospect.draftPick != null && historical.draft_pick != null;
  const hasAge      = prospect.breakoutAge != null && historical.breakout_age != null;
  const hasAthletic = prospect.athleticScore != null && historical.athletic_score != null;
  const hasDominator = prospect.dominatorRating != null && historical.dominator_rating != null;

  // Log-transformed pick distance: |ln(p+1) - ln(q+1)| / ln(263)
  const logPickDist = hasPick
    ? Math.abs(Math.log(prospect.draftPick! + 1) - Math.log(historical.draft_pick! + 1))
      / Math.log(263)
    : null;

  const posRankDist = hasPosRank
    ? Math.min(1, Math.abs(prospect.positionRank! - historical.pos_rank_in_class!) / MAX_POS_RANK)
    : null;

  const ageDist = hasAge
    ? Math.min(1, Math.abs(prospect.breakoutAge! - historical.breakout_age!) / MAX_BREAKOUT_AGE_DELTA)
    : null;

  const athleticDist = hasAthletic
    ? Math.min(1, Math.abs(prospect.athleticScore! - historical.athletic_score!) / MAX_ATHLETIC_DELTA)
    : null;

  const dominatorDist = hasDominator
    ? Math.min(1, Math.abs(prospect.dominatorRating! - historical.dominator_rating!) / MAX_DOMINATOR_DELTA)
    : null;

  // Count available signals to select weight combination
  // Priority: posRank > dominator > pick > age > athletic (by predictive value)
  // When all 5 present: posRank(42%) + dominator(18%) + pick(20%) + age(12%) + athletic(8%)
  if (hasPosRank && hasDominator && hasPick && hasAge && hasAthletic) {
    return posRankDist! * 0.42 + dominatorDist! * 0.18 + logPickDist! * 0.20 + ageDist! * 0.12 + athleticDist! * 0.08;
  }
  if (hasPosRank && hasDominator && hasPick && hasAthletic) {
    return posRankDist! * 0.45 + dominatorDist! * 0.22 + logPickDist! * 0.22 + athleticDist! * 0.11;
  }
  if (hasPosRank && hasDominator && hasPick && hasAge) {
    return posRankDist! * 0.44 + dominatorDist! * 0.22 + logPickDist! * 0.22 + ageDist! * 0.12;
  }
  if (hasPosRank && hasDominator && hasPick) {
    return posRankDist! * 0.48 + dominatorDist! * 0.26 + logPickDist! * 0.26;
  }
  if (hasPosRank && hasDominator && hasAge) {
    return posRankDist! * 0.50 + dominatorDist! * 0.30 + ageDist! * 0.20;
  }
  if (hasPosRank && hasDominator) {
    return posRankDist! * 0.55 + dominatorDist! * 0.45;
  }
  if (hasPosRank && hasPick && hasAge && hasAthletic) {
    return posRankDist! * 0.48 + logPickDist! * 0.25 + ageDist! * 0.15 + athleticDist! * 0.12;
  }
  if (hasPosRank && hasPick && hasAthletic) {
    return posRankDist! * 0.55 + logPickDist! * 0.28 + athleticDist! * 0.17;
  }
  if (hasPosRank && hasAge && hasAthletic) {
    return posRankDist! * 0.55 + ageDist! * 0.25 + athleticDist! * 0.20;
  }
  if (hasPosRank && hasPick && hasAge) {
    return posRankDist! * 0.55 + logPickDist! * 0.30 + ageDist! * 0.15;
  }
  if (hasPosRank && hasPick) {
    return posRankDist! * 0.65 + logPickDist! * 0.35;
  }
  if (hasPosRank && hasAge) {
    return posRankDist! * 0.70 + ageDist! * 0.30;
  }
  if (hasPosRank && hasAthletic) {
    return posRankDist! * 0.75 + athleticDist! * 0.25;
  }
  if (hasPosRank) {
    return posRankDist!;
  }
  if (hasPick && hasAge && hasAthletic) {
    return logPickDist! * 0.55 + ageDist! * 0.25 + athleticDist! * 0.20;
  }
  if (hasPick && hasAthletic) {
    return logPickDist! * 0.65 + athleticDist! * 0.35;
  }
  if (hasPick && hasAge) {
    return logPickDist! * 0.70 + ageDist! * 0.30;
  }
  if (hasPick) {
    return logPickDist!;
  }
  if (prospect.draftRound != null && historical.draft_round != null) {
    return Math.abs(prospect.draftRound - historical.draft_round) / 7;
  }

  return 1.0;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Compute similarity-weighted outcome distribution.
 * Closer comps (higher similarity) contribute more to probabilities.
 */
function computeWeightedDistribution(
  pool: Array<{ player: HistoricalRookie; weight: number }>,
  yearKey: 'year1_ppr' | 'year2_ppr' | 'year3_ppr',
  tiers: { elite: number; starter: number; rotational: number },
): { elite: number; starter: number; rotational: number; bust: number; sampleSize: number } | null {
  const pairs = pool
    .map(({ player, weight }) => ({ value: player[yearKey], weight }))
    .filter(({ value }) => value != null) as Array<{ value: number; weight: number }>;

  if (pairs.length < 3) return null;

  let totalWeight = 0;
  let weightedElite = 0;
  let weightedStarter = 0;
  let weightedRotational = 0;
  let weightedBust = 0;

  for (const { value, weight } of pairs) {
    totalWeight += weight;
    if (value >= tiers.elite)      weightedElite += weight;
    else if (value >= tiers.starter)    weightedStarter += weight;
    else if (value >= tiers.rotational) weightedRotational += weight;
    else                                weightedBust += weight;
  }

  if (totalWeight === 0) return null;

  return {
    elite:      (weightedElite / totalWeight) * 100,
    starter:    (weightedStarter / totalWeight) * 100,
    rotational: (weightedRotational / totalWeight) * 100,
    bust:       (weightedBust / totalWeight) * 100,
    sampleSize: pairs.length,
  };
}

/**
 * Apply Bayesian shrinkage to comp-pool probabilities.
 *
 * When the comp pool is small (N < 20), the raw comp percentages are unreliable.
 * We shrink toward empirically-derived base rates for the position + draft round.
 *
 * shrinkageWeight = N / (N + K)
 * - At N=5:  comp contributes 20%, prior 80%
 * - At N=10: comp contributes 33%, prior 67%
 * - At N=20: comp contributes 50%, prior 50%
 * - At N=40: comp contributes 67%, prior 33%
 */
function applyBayesianShrinkage(
  raw: { elite: number; starter: number; rotational: number; bust: number; sampleSize: number },
  position: string,
  estimatedRound: number | undefined,
): OutcomeDistribution {
  const prior = getBaseRate(position, estimatedRound);
  const n = raw.sampleSize;
  const w = n / (n + SHRINKAGE_K); // shrinkage weight toward comp pool

  const shrunkElite   = w * (raw.elite / 100)   + (1 - w) * prior.pElite;
  const shrunkStarter = w * (raw.starter / 100)  + (1 - w) * prior.pStarter;

  // Rotational and bust: derive from remaining probability mass after elite+starter
  const remaining = Math.max(0, 1 - shrunkElite - shrunkStarter);
  // Maintain the raw elite/starter ratio for the remaining tiers
  const rawBustRatio = raw.sampleSize > 0
    ? (raw.bust / 100) / Math.max(0.01, (raw.rotational + raw.bust) / 100)
    : 0.6; // default bust ratio when no data
  const shrunkBust       = remaining * rawBustRatio;
  const shrunkRotational = remaining * (1 - rawBustRatio);

  return {
    elite:      Math.min(100, shrunkElite * 100),
    starter:    Math.min(100, shrunkStarter * 100),
    rotational: Math.min(100, shrunkRotational * 100),
    bust:       Math.min(100, shrunkBust * 100),
    sampleSize: n,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function evaluateProspect(
  prospect: {
    position: string;
    draftRound?: number;
    draftPick?: number;
    /**
     * Position rank within the draft class (e.g. 3 = 3rd-best WR in this class).
     * Primary comp matching dimension.
     */
    positionRank?: number;
    /**
     * Age at draft (breakout age proxy). Distinguishes young-entry vs older-entry
     * players at the same draft slot. Populated from birth_date on ProspectProfile.
     */
    breakoutAge?: number;
    /**
     * RAS-style athletic score (0–10). Computed from nflverse combine measurements.
     * Available for ~45% of historical pool (combine participants only).
     * For 2026 prospects: stored in athletic_profile_json after combine results.
     */
    athleticScore?: number;
    /**
     * College dominator rating (0–100): share of team receiving/rushing output
     * in final college season. Computed from CFBD stats. Elite WR: 30+.
     * For 2026 prospects: stored in college_stats_json.dominator_rating.
     */
    dominatorRating?: number;
  },
  historicalPool: HistoricalRookie[],
  options?: { topN?: number },
): CompResults {
  const topN = options?.topN ?? 20;

  // 1. Filter to same position
  const positionPool = historicalPool.filter((p) => p.position === prospect.position);

  // 2. Compute distances and sort
  const withDistances = positionPool.map((p) => ({
    player: p,
    distance: computeDistance(
      {
        draftRound: prospect.draftRound,
        draftPick: prospect.draftPick,
        positionRank: prospect.positionRank,
        breakoutAge: prospect.breakoutAge,
        athleticScore: prospect.athleticScore,
        dominatorRating: prospect.dominatorRating,
      },
      p,
    ),
  }));
  withDistances.sort((a, b) => a.distance - b.distance);

  // 3. Take top N; filter out distance=1.0 (no match data) when better comps exist
  const hasGoodComps = withDistances.some(({ distance }) => distance < 1.0);
  const topComps = hasGoodComps
    ? withDistances.filter(({ distance }) => distance < 1.0).slice(0, topN)
    : withDistances.slice(0, topN);

  const poolSize = topComps.length;

  // 4. Confidence: based on number of close comps (distance < 0.3)
  const closeComps = topComps.filter(({ distance }) => distance < 0.3).length;
  let confidence: 'high' | 'medium' | 'low';
  if (closeComps >= 10) confidence = 'high';
  else if (closeComps >= 5) confidence = 'medium';
  else confidence = 'low';

  // 5. Top 5 for display (exclude distance=1.0 no-match entries)
  const top5 = withDistances
    .filter(({ distance }) => distance < 1.0)
    .slice(0, 5)
    .map(({ player, distance }): CompPlayer => ({
      name: player.name,
      draftYear: player.draft_year,
      draftRound: player.draft_round,
      draftPick: player.draft_pick,
      year1PPR: player.year1_ppr,
      year2PPR: player.year2_ppr,
      year3PPR: player.year3_ppr,
      similarity: 1 - distance,
    }));

  // 6. Outcome tiers for this position
  const tiers = OUTCOME_TIERS[prospect.position] ?? { elite: 999, starter: 999, rotational: 999 };

  // 7. Similarity-weighted distributions
  const weightedPool = topComps.map(({ player, distance }) => ({
    player,
    weight: Math.max(0.1, 1 - distance),
  }));

  // Compute raw (comp-pool only) distributions first
  const rawDist1 = computeWeightedDistribution(weightedPool, 'year1_ppr', tiers);
  const rawDist2 = computeWeightedDistribution(weightedPool, 'year2_ppr', tiers);
  const rawDist3 = computeWeightedDistribution(weightedPool, 'year3_ppr', tiers);

  // Apply Bayesian shrinkage toward position+round base rates
  const estimatedRound = prospect.draftRound;
  const distributions = {
    year1: rawDist1 ? applyBayesianShrinkage(rawDist1, prospect.position, estimatedRound) : null,
    year2: rawDist2 ? applyBayesianShrinkage(rawDist2, prospect.position, estimatedRound) : null,
    year3: rawDist3 ? applyBayesianShrinkage(rawDist3, prospect.position, estimatedRound) : null,
  };

  // 8. Median PPR
  const year1Values = topComps.map((c) => c.player.year1_ppr).filter((v): v is number => v != null);
  const year2Values = topComps.map((c) => c.player.year2_ppr).filter((v): v is number => v != null);
  const year3Values = topComps.map((c) => c.player.year3_ppr).filter((v): v is number => v != null);

  return {
    comps: top5,
    distributions,
    medianPPR: {
      year1: median(year1Values),
      year2: median(year2Values),
      year3: median(year3Values),
    },
    confidence,
    poolSize,
  };
}
