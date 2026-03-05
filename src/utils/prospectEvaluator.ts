import type { HistoricalRookie } from '@/lib/supabase';

// ── Outcome tier thresholds ───────────────────────────────────────────────────
// PPR point totals per season that define each tier
export const OUTCOME_TIERS: Record<string, { elite: number; starter: number; rotational: number }> = {
  QB: { elite: 350, starter: 225, rotational: 100 },
  RB: { elite: 200, starter: 125, rotational: 60 },
  WR: { elite: 250, starter: 150, rotational: 75 },
  TE: { elite: 150, starter: 80, rotational: 30 },
};

// Max position rank used to normalize distance — top 24 positional prospects are meaningful
const MAX_POS_RANK = 24;

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
  elite: number;       // percentage 0–100
  starter: number;
  rotational: number;
  bust: number;
  sampleSize: number;  // how many comps had data for this year
}

export interface CompResults {
  comps: CompPlayer[];         // top 5 closest (for display)
  distributions: {
    year1: OutcomeDistribution | null;
    year2: OutcomeDistribution | null;
    year3: OutcomeDistribution | null;
  };
  medianPPR: { year1: number | null; year2: number | null; year3: number | null };
  confidence: 'high' | 'medium' | 'low';
  poolSize: number;            // total comps found
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute normalized distance between a prospect and a historical rookie.
 *
 * Priority order:
 * 1. Position rank within class (positionRank vs pos_rank_in_class) — best signal
 *    because it matches e.g. "WR#3 in class" to historical WR3s regardless of overall pick.
 * 2. Overall pick number — fallback when pos_rank_in_class is unavailable
 * 3. Draft round — coarse fallback
 * 4. 1.0 (no match data)
 */
function computeDistance(
  prospect: { draftRound?: number; draftPick?: number; positionRank?: number },
  historical: HistoricalRookie,
): number {
  const hasPosRank = prospect.positionRank != null && historical.pos_rank_in_class != null;
  const hasPick = prospect.draftPick != null && historical.draft_pick != null;

  if (hasPosRank && hasPick) {
    // Both signals available: weight position rank higher (primary signal)
    const posRankDist = Math.min(1, Math.abs(prospect.positionRank! - historical.pos_rank_in_class!) / MAX_POS_RANK);
    const pickDist = Math.abs(prospect.draftPick! - historical.draft_pick!) / 262;
    return posRankDist * 0.65 + pickDist * 0.35;
  }

  if (hasPosRank) {
    return Math.min(1, Math.abs(prospect.positionRank! - historical.pos_rank_in_class!) / MAX_POS_RANK);
  }

  if (hasPick) {
    return Math.abs(prospect.draftPick! - historical.draft_pick!) / 262;
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
 *
 * Closer comps (higher similarity = lower distance) contribute more to the
 * probability estimate than distant comps. This avoids flattening the signal
 * when the pool includes borderline matches.
 */
function computeWeightedDistribution(
  pool: Array<{ player: HistoricalRookie; weight: number }>,
  yearKey: 'year1_ppr' | 'year2_ppr' | 'year3_ppr',
  tiers: { elite: number; starter: number; rotational: number },
): OutcomeDistribution | null {
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
    if (value >= tiers.elite) weightedElite += weight;
    else if (value >= tiers.starter) weightedStarter += weight;
    else if (value >= tiers.rotational) weightedRotational += weight;
    else weightedBust += weight;
  }

  if (totalWeight === 0) return null;

  return {
    elite: (weightedElite / totalWeight) * 100,
    starter: (weightedStarter / totalWeight) * 100,
    rotational: (weightedRotational / totalWeight) * 100,
    bust: (weightedBust / totalWeight) * 100,
    sampleSize: pairs.length,
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
     * For 2026 pre-draft prospects this comes from FantasyCalc position_rank.
     * For archetypes this is set to the draft round number (1, 2, 3).
     */
    positionRank?: number;
  },
  historicalPool: HistoricalRookie[],
  options?: { topN?: number },
): CompResults {
  const topN = options?.topN ?? 20;

  // 1. Filter to same position (pool is pre-filtered by caller but guard anyway)
  const positionPool = historicalPool.filter(
    (p) => p.position === prospect.position,
  );

  // 2. Compute distances and sort
  const withDistances = positionPool.map((p) => ({
    player: p,
    distance: computeDistance(prospect, p),
  }));

  withDistances.sort((a, b) => a.distance - b.distance);

  // 3. Take top N comps; filter out distance=1.0 (no match data) when better comps exist
  const hasGoodComps = withDistances.some(({ distance }) => distance < 1.0);
  const topComps = hasGoodComps
    ? withDistances.filter(({ distance }) => distance < 1.0).slice(0, topN)
    : withDistances.slice(0, topN);

  const poolSize = topComps.length;

  // 4. Confidence based on number of close comps (distance < 0.3)
  const closeComps = topComps.filter(({ distance }) => distance < 0.3).length;
  let confidence: 'high' | 'medium' | 'low';
  if (closeComps >= 10) confidence = 'high';
  else if (closeComps >= 5) confidence = 'medium';
  else confidence = 'low';

  // 5. Top 5 for display
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
  // Use similarity (1 - distance) as weight so closer comps drive probabilities
  const weightedPool = topComps.map(({ player, distance }) => ({
    player,
    weight: Math.max(0.1, 1 - distance), // floor weight at 0.1 to avoid zero-weight
  }));

  const distributions = {
    year1: computeWeightedDistribution(weightedPool, 'year1_ppr', tiers),
    year2: computeWeightedDistribution(weightedPool, 'year2_ppr', tiers),
    year3: computeWeightedDistribution(weightedPool, 'year3_ppr', tiers),
  };

  // 8. Median PPR
  const year1Values = topComps.map((c) => c.player.year1_ppr).filter((v): v is number => v != null);
  const year2Values = topComps.map((c) => c.player.year2_ppr).filter((v): v is number => v != null);
  const year3Values = topComps.map((c) => c.player.year3_ppr).filter((v): v is number => v != null);

  const medianPPR = {
    year1: median(year1Values),
    year2: median(year2Values),
    year3: median(year3Values),
  };

  return {
    comps: top5,
    distributions,
    medianPPR,
    confidence,
    poolSize,
  };
}
