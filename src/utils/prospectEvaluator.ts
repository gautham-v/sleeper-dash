import type { HistoricalRookie } from '@/lib/supabase';

// ── Outcome tier thresholds ───────────────────────────────────────────────────

export const OUTCOME_TIERS: Record<string, { elite: number; starter: number; rotational: number }> = {
  QB: { elite: 350, starter: 225, rotational: 100 },
  RB: { elite: 200, starter: 125, rotational: 60 },
  WR: { elite: 250, starter: 150, rotational: 75 },
  TE: { elite: 150, starter: 80, rotational: 30 },
};

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

function computeDistance(
  prospect: { draftRound?: number; draftPick?: number },
  historical: HistoricalRookie,
): number {
  // Both have overall pick number
  if (prospect.draftPick != null && historical.draft_pick != null) {
    return Math.abs(prospect.draftPick - historical.draft_pick) / 262;
  }
  // Both have round
  if (prospect.draftRound != null && historical.draft_round != null) {
    return Math.abs(prospect.draftRound - historical.draft_round) / 7;
  }
  // No capital info
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

function computeDistribution(
  pool: HistoricalRookie[],
  yearKey: 'year1_ppr' | 'year2_ppr' | 'year3_ppr',
  tiers: { elite: number; starter: number; rotational: number },
): OutcomeDistribution | null {
  const values = pool
    .map((p) => p[yearKey])
    .filter((v): v is number => v != null);

  if (values.length < 3) return null;

  let elite = 0;
  let starter = 0;
  let rotational = 0;
  let bust = 0;

  for (const v of values) {
    if (v >= tiers.elite) elite++;
    else if (v >= tiers.starter) starter++;
    else if (v >= tiers.rotational) rotational++;
    else bust++;
  }

  const n = values.length;
  return {
    elite: (elite / n) * 100,
    starter: (starter / n) * 100,
    rotational: (rotational / n) * 100,
    bust: (bust / n) * 100,
    sampleSize: n,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function evaluateProspect(
  prospect: { position: string; draftRound?: number; draftPick?: number },
  historicalPool: HistoricalRookie[],
  options?: { topN?: number },
): CompResults {
  const topN = options?.topN ?? 20;

  // 1. Filter to same position
  const positionPool = historicalPool.filter(
    (p) => p.position === prospect.position,
  );

  // 2. Compute distances and sort
  const withDistances = positionPool.map((p) => ({
    player: p,
    distance: computeDistance(prospect, p),
  }));

  withDistances.sort((a, b) => a.distance - b.distance);

  // 3. Take top N comps
  const topComps = withDistances.slice(0, topN).map(({ player }) => player);

  const poolSize = topComps.length;

  // 4. Confidence
  let confidence: 'high' | 'medium' | 'low';
  if (poolSize >= 15) confidence = 'high';
  else if (poolSize >= 8) confidence = 'medium';
  else confidence = 'low';

  // 5. Top 5 for display
  const top5 = withDistances.slice(0, 5).map(({ player, distance }): CompPlayer => ({
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

  // 7. Distributions
  const distributions = {
    year1: computeDistribution(topComps, 'year1_ppr', tiers),
    year2: computeDistribution(topComps, 'year2_ppr', tiers),
    year3: computeDistribution(topComps, 'year3_ppr', tiers),
  };

  // 8. Median PPR
  const year1Values = topComps.map((p) => p.year1_ppr).filter((v): v is number => v != null);
  const year2Values = topComps.map((p) => p.year2_ppr).filter((v): v is number => v != null);
  const year3Values = topComps.map((p) => p.year3_ppr).filter((v): v is number => v != null);

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
