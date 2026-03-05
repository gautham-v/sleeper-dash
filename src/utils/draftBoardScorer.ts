import type { CompResults } from '@/utils/prospectEvaluator';
import type { FranchiseTier } from '@/types/sleeper';

// Per-position estimated NFL contribution onset (years from draft)
const PROSPECT_PEAK_OFFSET: Record<string, number> = {
  QB: 3.5,
  RB: 1.5,
  WR: 2.5,
  TE: 3.5,
};

// Expected dynasty value by overall rank (rough linear model)
// Top 5 picks ~5500, pick 32 ~2000, pick 100+ ~500
function expectedValueForRank(overallRank: number): number {
  return Math.max(500, 6000 - overallRank * 115);
}

interface ScorerInput {
  position: string;
  dynastyValue: number;
  overallRank: number;
  compResults: CompResults;
  warByPosition: { position: string; war: number; leagueAvgWAR: number; rank: number; avgAge?: number }[];
  tier: FranchiseTier;
  peakYearOffset: number;
}

interface ScoringOutput {
  targetScore: number;
  pStarter: number;      // 0–100
  pElite: number;        // 0–100
  timelineBadge: 'immediate' | 'year2' | 'year3+';
  needLabel: 'Critical Need' | 'Need' | 'Value';
  surplusFlag: boolean;
  reason: string;
  impactSummary: string;
}

export function scoreDraftTarget(input: ScorerInput): ScoringOutput {
  const { position, dynastyValue, overallRank, compResults, warByPosition, tier, peakYearOffset } = input;

  // ── 1. pHit: P(starter+) using Year2 distribution (most predictive) ──────
  const dist = compResults.distributions.year2
    ?? compResults.distributions.year1
    ?? compResults.distributions.year3;
  const pHit = dist ? (dist.elite + dist.starter) / 100 : 0.30;
  const pEliteRaw = dist ? dist.elite / 100 : 0.10;

  // ── 2. needWeight: WAR deficit at this position, normalized ───────────────
  const posNeed = warByPosition.find((p) => p.position === position);
  const deficits = warByPosition.map((p) => Math.max(0, p.leagueAvgWAR - p.war));
  const maxDeficit = Math.max(...deficits, 0.01);
  const myDeficit = posNeed ? Math.max(0, posNeed.leagueAvgWAR - posNeed.war) : 0;
  const needWeight = myDeficit / maxDeficit;

  // ── 3. timelineScore: tier-based alignment bonus ──────────────────────────
  // Rookies inherently have delayed impact (2–4 years). Penalize based on team urgency.
  // Contenders need impact NOW → low bonus; Rebuilders benefit most from rookies → full bonus.
  const timelineScore = tier === 'Rebuilding' ? 1.0 : tier === 'Fringe' ? 0.65 : 0.35;

  // ── 4. surplusScore: dynasty value vs pick slot expectation ───────────────
  const expectedValue = expectedValueForRank(overallRank);
  const surplusScore = Math.max(0, Math.min(1, dynastyValue / expectedValue - 1));
  const surplusFlag = dynastyValue > expectedValue * 1.15;

  // ── 5. roleFitScore: top-2 positional need bonus ──────────────────────────
  // Sort a COPY to avoid mutating the caller's array
  const sortedNeeds = [...warByPosition].sort(
    (a, b) => (b.leagueAvgWAR - b.war) - (a.leagueAvgWAR - a.war),
  );
  const top2Needs = new Set(sortedNeeds.slice(0, 2).map((p) => p.position));
  const roleFitScore = top2Needs.has(position) ? 1.0 : 0.5;

  // ── 6. Final score ────────────────────────────────────────────────────────
  const targetScore =
    pHit * 40 +
    needWeight * 25 +
    timelineScore * 20 +
    surplusScore * 10 +
    roleFitScore * 5;

  // ── 7. Badges and labels ──────────────────────────────────────────────────
  // timelineBadge: prospect readiness based on position (NOT team alignment)
  const prospectPeakOffset = PROSPECT_PEAK_OFFSET[position] ?? 2.5;
  const timelineBadge: 'immediate' | 'year2' | 'year3+' =
    prospectPeakOffset <= 1.5 ? 'immediate' : prospectPeakOffset <= 2.5 ? 'year2' : 'year3+';

  const needLabel: 'Critical Need' | 'Need' | 'Value' =
    needWeight > 0.7 ? 'Critical Need' : needWeight > 0.3 ? 'Need' : 'Value';

  // ── 8. Human-readable context strings ────────────────────────────────────
  const reason = posNeed
    ? `Your ${position} group is #${posNeed.rank} in the league${posNeed.avgAge != null && posNeed.avgAge > 27 ? ` (avg age ${posNeed.avgAge.toFixed(0)})` : ''}.`
    : `Adds depth at ${position}.`;

  const estimatedPeakWAR = Math.round((dynastyValue / 450) * 10) / 10;
  let impactSummary: string;
  if (posNeed) {
    const delta = estimatedPeakWAR - Math.max(posNeed.war, 0);
    if (delta > 4) {
      impactSummary = `Franchise-altering at ${position} — projects top-3 in league at peak`;
    } else if (delta > 2) {
      impactSummary = `Pushes ${position} room from #${posNeed.rank} to top-half of league`;
    } else if (delta > 0.5) {
      impactSummary = `Meaningful upgrade at ${position} — narrows gap from #${posNeed.rank}`;
    } else {
      impactSummary = `Depth addition at ${position} — pipeline for aging room`;
    }
  } else {
    impactSummary = estimatedPeakWAR > 5
      ? `Elite prospect — projects ~${estimatedPeakWAR.toFixed(1)} peak WAR`
      : `Adds depth and future flexibility`;
  }

  // Suppress unused variable warning for peakYearOffset (used by caller for context)
  void peakYearOffset;

  return {
    targetScore,
    pStarter: Math.round(pHit * 100),
    pElite: Math.round(pEliteRaw * 100),
    timelineBadge,
    needLabel,
    surplusFlag,
    reason,
    impactSummary,
  };
}
