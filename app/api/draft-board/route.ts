import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { evaluateProspect } from '@/utils/prospectEvaluator';
import { scoreDraftTarget } from '@/utils/draftBoardScorer';
import type { HistoricalRookie, ProspectProfile } from '@/lib/supabase';
import type { DraftBoardRequest, DraftBoardTarget, FranchiseTier } from '@/types/sleeper';
import type { CompResults } from '@/utils/prospectEvaluator';

// ── Module-level cache for historical rookies (stable data, 6h TTL) ───────
let historicalCache: { data: HistoricalRookie[]; fetchedAt: number } | null = null;
const HIST_TTL = 6 * 60 * 60 * 1000;

async function getHistoricalPool(): Promise<HistoricalRookie[]> {
  if (historicalCache && Date.now() - historicalCache.fetchedAt < HIST_TTL) {
    return historicalCache.data;
  }

  const pool: HistoricalRookie[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('historical_rookies')
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`historical_rookies fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    pool.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  historicalCache = { data: pool, fetchedAt: Date.now() };
  return pool;
}

// ── Synthetic archetype fallback (pre-draft) ──────────────────────────────
// Dynasty value estimates per round per position (FantasyCalc historical averages)
const ARCHETYPE_VALUES: Record<number, Record<string, number>> = {
  1: { QB: 4200, RB: 3800, WR: 4000, TE: 2800 },
  2: { QB: 2200, RB: 1800, WR: 2000, TE: 1400 },
  3: { QB: 900,  RB: 750,  WR: 850,  TE: 600  },
};

function buildArchetypes(
  warByPosition: DraftBoardRequest['warByPosition'],
  tier: FranchiseTier,
  peakYearOffset: number,
  historicalPool: HistoricalRookie[],
): DraftBoardTarget[] {
  const targets: DraftBoardTarget[] = [];
  for (const round of [1, 2, 3]) {
    for (const position of ['QB', 'RB', 'WR', 'TE']) {
      const dynastyValue = ARCHETYPE_VALUES[round]?.[position] ?? 500;
      const overallRank = (round - 1) * 16 + (['QB', 'RB', 'WR', 'TE'].indexOf(position) + 1);
      const positionRank = round;

      // Partition historical pool by position and run comp engine
      const posPool = historicalPool.filter((p) => p.position === position);
      const compResults: CompResults = evaluateProspect(
        { position, draftRound: round },
        posPool,
      );

      const scoring = scoreDraftTarget({
        position,
        dynastyValue,
        overallRank,
        compResults,
        warByPosition,
        tier,
        peakYearOffset,
      });

      targets.push({
        name: `Round ${round} ${position}`,
        position,
        dynastyValue,
        overallRank,
        positionRank,
        draftRound: round,
        targetScore: scoring.targetScore,
        pStarter: scoring.pStarter,
        pElite: scoring.pElite,
        confidence: compResults.confidence,
        timelineBadge: scoring.timelineBadge,
        needLabel: scoring.needLabel,
        comps: compResults.comps.slice(0, 3),
        surplusFlag: false, // archetypes have no surplus concept
        reason: scoring.reason,
        impactSummary: scoring.impactSummary,
        isArchetype: true,
      });
    }
  }
  return targets.sort((a, b) => b.targetScore - a.targetScore);
}

// ── Main handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DraftBoardRequest;
    const { draftYear, warByPosition, tier, peakYearOffset } = body;

    if (!draftYear || !warByPosition || !tier) {
      return NextResponse.json(
        { error: 'Missing required fields: draftYear, warByPosition, tier' },
        { status: 400 },
      );
    }

    // 1. Load historical pool (cached)
    const historicalPool = await getHistoricalPool();

    // 2. Partition by position in memory (avoid 4 separate DB queries)
    const poolByPosition = new Map<string, HistoricalRookie[]>();
    for (const p of historicalPool) {
      const arr = poolByPosition.get(p.position) ?? [];
      arr.push(p);
      poolByPosition.set(p.position, arr);
    }

    // 3. Load prospect profiles for this draft year
    const { data: prospects, error: prospectsError } = await supabase
      .from('prospect_profiles')
      .select('*')
      .eq('draft_year', draftYear)
      .order('overall_rank', { ascending: true });

    if (prospectsError) {
      return NextResponse.json({ error: prospectsError.message }, { status: 500 });
    }

    // 4. isPreDraft = true if the table is empty OR if no prospect has a confirmed NFL draft pick
    const isPreDraft =
      !prospects ||
      prospects.length === 0 ||
      (prospects as ProspectProfile[]).every((p) => p.draft_pick == null);

    // If completely empty, use archetype fallback
    if (!prospects || prospects.length === 0) {
      const archetypes = buildArchetypes(warByPosition, tier, peakYearOffset, historicalPool);
      return NextResponse.json({ targets: archetypes, isPreDraft: true });
    }

    // 5. Compute class-relative ranks (within 2026 class, not global dynasty rank)
    //    Also derive estimated NFL draft pick from class rank for comp matching.
    //    All 2026 prospects have draft_pick=null pre-draft, so without this the
    //    computeDistance() fallback returns 1.0 for everyone → identical comps.
    const prospectsTyped = prospects as ProspectProfile[];
    const sortedByValue = [...prospectsTyped].sort(
      (a, b) => (b.fantasycalc_value ?? 0) - (a.fantasycalc_value ?? 0),
    );
    const classRankMap = new Map<string, number>();
    const classPosRankMap = new Map<string, number>();
    const posCounter: Record<string, number> = {};
    for (let i = 0; i < sortedByValue.length; i++) {
      const p = sortedByValue[i];
      classRankMap.set(p.name, i + 1);
      posCounter[p.position] = (posCounter[p.position] ?? 0) + 1;
      classPosRankMap.set(p.name, posCounter[p.position]);
    }

    // 6. Score each real prospect
    const targets: DraftBoardTarget[] = [];

    for (const prospect of prospectsTyped) {
      const classRank = classRankMap.get(prospect.name) ?? 99;
      const classPosRank = classPosRankMap.get(prospect.name) ?? 99;

      // For pre-draft prospects with no confirmed NFL pick, estimate from class rank.
      // Class rank 1 ≈ top NFL pick, class rank 12 ≈ late round 1 / early round 2, etc.
      const estimatedPick = prospect.draft_pick ?? classRank;
      const estimatedRound = prospect.draft_round ?? Math.min(7, Math.ceil(classRank / 12));

      // Use cached comp results if available, else compute in memory
      let compResults: CompResults;
      if (prospect.comp_results_json) {
        compResults = prospect.comp_results_json as unknown as CompResults;
      } else {
        const posPool = poolByPosition.get(prospect.position) ?? [];
        compResults = evaluateProspect(
          {
            position: prospect.position,
            draftRound: estimatedRound,
            draftPick: estimatedPick,
          },
          posPool,
        );
      }

      const scoring = scoreDraftTarget({
        position: prospect.position,
        dynastyValue: prospect.fantasycalc_value ?? 0,
        overallRank: classRank, // use class-relative rank for surplus calc
        compResults,
        warByPosition,
        tier,
        peakYearOffset,
      });

      targets.push({
        name: prospect.name,
        position: prospect.position,
        dynastyValue: prospect.fantasycalc_value ?? 0,
        overallRank: classRank,
        positionRank: classPosRank,
        draftRound: prospect.draft_round ?? estimatedRound,
        draftPick: prospect.draft_pick ?? undefined,
        targetScore: scoring.targetScore,
        pStarter: scoring.pStarter,
        pElite: scoring.pElite,
        confidence: compResults.confidence,
        timelineBadge: scoring.timelineBadge,
        needLabel: scoring.needLabel,
        comps: compResults.comps.slice(0, 3),
        surplusFlag: scoring.surplusFlag,
        reason: scoring.reason,
        impactSummary: scoring.impactSummary,
      });
    }

    targets.sort((a, b) => b.targetScore - a.targetScore);

    return NextResponse.json({ targets, isPreDraft });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
