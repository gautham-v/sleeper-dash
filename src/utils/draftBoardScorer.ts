import type { CompResults } from '@/utils/prospectEvaluator';
import type { FranchiseTier } from '@/types/sleeper';

/**
 * Reference dynasty value for a top-tier #1 overall prospect.
 * Used to normalize dynasty value to 0–60 scale.
 * 7000 = roughly what FantasyCalc assigns an elite top pick (e.g. Jeremiyah Love 2026).
 */
const MAX_DYNASTY_REF = 7000;

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

// Per-position estimated NFL contribution onset (years from draft)
const PROSPECT_PEAK_OFFSET: Record<string, number> = {
  QB: 3.5,
  RB: 1.5,
  WR: 2.5,
  TE: 3.5,
};

// Expected dynasty value by overall class rank (linear model)
// Used only for surplus detection, not as a scoring input
function expectedValueForClassRank(classRank: number): number {
  return Math.max(400, 7500 - classRank * 120);
}

export function scoreDraftTarget(input: ScorerInput): ScoringOutput {
  const { position, dynastyValue, overallRank, compResults, warByPosition, tier, peakYearOffset } = input;

  // ── 1. Dynasty value score (0–60): primary talent signal ─────────────────
  // Dynasty value IS the market's best estimate of a prospect's long-term worth.
  // This must dominate — a #3 overall should always rank above a #44 regardless of need.
  const dynastyScore = Math.min(60, (dynastyValue / MAX_DYNASTY_REF) * 60);

  // ── 2. Talent bonus from comp analysis (0–15) ─────────────────────────────
  // Use Year2 distribution as primary — most predictive year for dynasty value.
  // Fall back to Year1 or Year3 if Year2 unavailable.
  const dist = compResults.distributions.year2
    ?? compResults.distributions.year1
    ?? compResults.distributions.year3;
  const pHit = dist ? (dist.elite + dist.starter) / 100 : 0.30;
  const pEliteRaw = dist ? dist.elite / 100 : 0.10;
  const talentBonus = pHit * 15;

  // ── 3. Positional need adjustment (0–15): secondary signal ────────────────
  // Compressed significantly vs old formula (was 25). Need can only shift
  // rankings modestly — it should never elevate a weak prospect over a strong one.
  const posNeed = warByPosition.find((p) => p.position === position);
  const deficits = warByPosition.map((p) => Math.max(0, p.leagueAvgWAR - p.war));
  const maxDeficit = Math.max(...deficits, 0.01);
  const myDeficit = posNeed ? Math.max(0, posNeed.leagueAvgWAR - posNeed.war) : 0;
  const needWeight = myDeficit / maxDeficit;
  const needBonus = needWeight * 15;

  // ── 4. Timeline fit (0–8): rebuilding teams benefit more from rookies ──────
  // Contenders need immediate starters — deep rebuilding is OK for any rookie.
  // This is a modest signal that only tips tiebreakers between similar prospects.
  const tierMultiplier = tier === 'Rebuilding' ? 1.0 : tier === 'Fringe' ? 0.65 : 0.35;
  const timelineFit = tierMultiplier * 8;

  // ── 5. Surplus value bonus (0–7): value over expected for draft slot ───────
  const expectedValue = expectedValueForClassRank(overallRank);
  const surplusRatio = dynastyValue / expectedValue - 1;
  const surplusBonus = Math.max(0, Math.min(7, surplusRatio * 7));
  const surplusFlag = dynastyValue > expectedValue * 1.15;

  // ── 6. Final score (practical range 20–100) ───────────────────────────────
  const rawScore = dynastyScore + talentBonus + needBonus + timelineFit + surplusBonus;
  const targetScore = Math.min(100, Math.round(rawScore));

  // ── 7. Badges and labels ──────────────────────────────────────────────────
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
