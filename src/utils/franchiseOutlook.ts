import type {
  SleeperRoster,
  SleeperPlayer,
  FutureDraftPick,
  FranchiseOutlookResult,
  FranchiseTier,
  AgeCategory,
  RiskCategory,
  FCPlayerEntry,
  StrategyRecommendation,
  StrategyMode,
  RookieDraftTarget,
  TradeTargetPlayer,
  TradeTargetPick,
  TradePartner,
} from '../types/sleeper';
import type { LightweightHTCResult } from '../types/recommendations';

// ---- Static Age Curve Tables ----
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

const CURVE_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);
const MULTIPLIER_FLOOR = 0.4;
const PICK_WAR_BY_ROUND: Record<number, number> = { 1: 4.0, 2: 2.0, 3: 0.8, 4: 0.3 };
const POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;

const POSITION_LIQUIDITY: Record<string, number> = { QB: 0.5, RB: 1.0, WR: 0.9, TE: 0.7 };
const DECLINE_AGE: Record<string, number> = { QB: 33, RB: 27, WR: 30, TE: 30 };

function pickWARValue(round: number): number {
  return PICK_WAR_BY_ROUND[round] ?? 0.1;
}

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

function peakMultiplierFor(position: string): number {
  const curve = AGE_CURVES[position];
  if (!curve) return 1.0;
  return Math.max(...Object.values(curve));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentile75(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.75) - 1;
  return sorted[Math.max(0, idx)];
}

function percentileRank(value: number, values: number[]): number {
  if (values.length <= 1) return 50;
  const below = values.filter((v) => v < value).length;
  return Math.round((below / (values.length - 1)) * 100);
}

function ageCategory(weightedAge: number): AgeCategory {
  if (weightedAge < 25.5) return 'Young';
  if (weightedAge <= 28.5) return 'Prime';
  return 'Aging';
}

function riskCategory(riskScore: number): RiskCategory {
  if (riskScore < 25) return 'Low';
  if (riskScore < 50) return 'Moderate';
  if (riskScore < 75) return 'High';
  return 'Extreme';
}

// ── Feature 1: Strategy Recommendation ───────────────────────────────────────

function computeStrategyRecommendation(
  tier: FranchiseTier,
  windowLength: number,
  luckScore: number,
  riskScore: number,
  peakYearOffset: number,
  projectedWAR: { yearOffset: number; totalWAR: number }[],
  currentWAR: number,
  _focusAreas: FranchiseOutlookResult['focusAreas'],
  futurePicks: FutureDraftPick[],
  youngAssetsCount: number,
  warRank: number,
  numTeams: number,
  keyPlayers: FranchiseOutlookResult['keyPlayers'],
  youngAssets: FranchiseOutlookResult['youngAssets'],
  warByPosition: FranchiseOutlookResult['warByPosition'],
  contenderThreshold: number,
): StrategyRecommendation {
  const futureFirsts = futurePicks.filter((p) => p.round === 1).length;
  const projYear2 = projectedWAR.find((p) => p.yearOffset === 2)?.totalWAR ?? currentWAR;
  const projDropPct = currentWAR > 0 ? (currentWAR - projYear2) / currentWAR : 0;

  let mode: StrategyMode;
  let headline: string;
  let urgencyScore: number;

  if (tier === 'Contender' && windowLength >= 3 && riskScore < 30) {
    mode = 'Steady State';
    headline = "You're a sustained contender — maintain course.";
    urgencyScore = 15 + Math.min(15, riskScore / 2);
  } else if (tier === 'Contender' && (windowLength <= 2 || projDropPct > 0.15)) {
    mode = 'Push All-In Now';
    headline = 'Short window — maximize wins while you can.';
    urgencyScore = Math.min(98, 72 + riskScore / 5 + (windowLength === 0 ? 18 : 0));
  } else if (tier === 'Fringe' && warRank <= Math.ceil(numTeams / 2)) {
    mode = 'Win-Now Pivot';
    headline = 'Close to contention — targeted upgrades can push you over.';
    urgencyScore = 50 + Math.min(20, riskScore / 4);
  } else if (tier === 'Rebuilding' && (futureFirsts >= 2 || youngAssetsCount >= 3)) {
    mode = 'Asset Accumulation';
    headline = 'Strong foundation — stay patient and accumulate value.';
    urgencyScore = 15 + Math.min(20, youngAssetsCount * 3 + futureFirsts * 3);
  } else {
    mode = 'Full Rebuild';
    headline = 'Reset mode — prioritize future assets aggressively.';
    urgencyScore = 35 + Math.min(30, (numTeams - warRank) * 3);
  }

  const rationale: string[] = [];
  const currentYear = new Date().getFullYear();

  if (mode === 'Push All-In Now') {
    if (currentWAR > 0) {
      const dropPct = Math.round((1 - projYear2 / currentWAR) * 100);
      if (dropPct > 0) {
        rationale.push(`Roster projected to drop ~${dropPct}% by ${currentYear + 2} — the window is closing fast.`);
      }
    }
    const topPlayer = keyPlayers[0];
    if (topPlayer?.age != null && topPlayer.age >= 27) {
      rationale.push(`Your top asset ${topPlayer.name} (age ${topPlayer.age}) is approaching decline — maximize value while they're at peak.`);
    }
    if (luckScore <= -2) {
      rationale.push(`Unlucky record masks true talent — sellers may underestimate you. Strike now.`);
    } else {
      const topPos = warByPosition.find((p) => p.rank === 1);
      if (topPos) {
        rationale.push(`Your ${topPos.position} group is the best in the league — use that as trade leverage.`);
      } else {
        rationale.push(`Prioritize proven contributors over developmental players this offseason.`);
      }
    }

  } else if (mode === 'Steady State') {
    rationale.push(`Ranked #${warRank} of ${numTeams} in WAR with a ${windowLength}-year contender window.`);
    const youngStrength = warByPosition.find((p) => p.rank === 1 && p.avgAge > 0 && p.avgAge <= 26);
    if (youngStrength) {
      rationale.push(`Your ${youngStrength.position} group is #1 in the league (avg age ${youngStrength.avgAge.toFixed(0)}) — a long-term foundation.`);
    } else {
      rationale.push(`Roster is balanced with no glaring positional weakness.`);
    }
    if (riskScore > 20) {
      const oldestKey = [...keyPlayers].filter((p) => p.age !== null).sort((a, b) => (b.age ?? 0) - (a.age ?? 0))[0];
      if (oldestKey?.age != null) {
        rationale.push(`Watch ${oldestKey.name} (age ${oldestKey.age}) — aging veterans carry moderate decline risk.`);
      } else {
        rationale.push(`Moderate age risk — monitor key contributors heading into next season.`);
      }
    } else {
      rationale.push(`Low age risk — no significant decline signals in the next 2 years.`);
    }

  } else if (mode === 'Win-Now Pivot') {
    const gap = (contenderThreshold - currentWAR).toFixed(1);
    rationale.push(`You're ${gap} WAR behind the contender threshold — one targeted upgrade could push you over.`);
    const weakest = [...warByPosition].sort((a, b) => (a.war - a.leagueAvgWAR) - (b.war - b.leagueAvgWAR))[0];
    if (weakest) {
      rationale.push(`Your weakest position is ${weakest.position} (#${weakest.rank} of ${numTeams}) — the clearest upgrade target.`);
    }
    if (youngAssets.length >= 2) {
      rationale.push(`You have ${youngAssets.length} players under 25 — potential chips to move for proven contributors.`);
    } else {
      rationale.push(`Target players ages 24–27 for the best balance of upside and proven production.`);
    }

  } else if (mode === 'Asset Accumulation') {
    const youngCount = youngAssets.length;
    rationale.push(`${futureFirsts} future first${futureFirsts !== 1 ? 's' : ''} and ${youngCount} player${youngCount !== 1 ? 's' : ''} under 25 — real rebuild capital.`);
    if (youngAssets[0]) {
      const ya = youngAssets[0];
      const valStr = ya.dynastyValue != null ? `, value ${ya.dynastyValue.toLocaleString()}` : '';
      rationale.push(`Your best young asset is ${ya.name} (age ${ya.age}${valStr}) — don't sell cheap.`);
    } else {
      rationale.push(`Focus on acquiring skill players in the 21–24 age range before rookie prices rise.`);
    }
    rationale.push(`Roster is projected to peak in ${peakYearOffset} year${peakYearOffset !== 1 ? 's' : ''} — patience is your edge right now.`);

  } else {
    // Full Rebuild
    rationale.push(`Ranked #${warRank} of ${numTeams} in WAR — this is a full reset situation.`);
    rationale.push(`Accumulate first-round picks aggressively. Two early picks can restart a roster within 2 years.`);
    if (luckScore >= 2) {
      rationale.push(`Your record is better than your talent — don't let a fortunate W-L delay the rebuild.`);
    } else {
      const chipPlayer = keyPlayers.find((p) => p.age !== null && (p.age ?? 0) >= 28);
      if (chipPlayer?.age != null) {
        rationale.push(`${chipPlayer.name} (age ${chipPlayer.age}) is your best trade chip — consider selling at peak value.`);
      } else {
        rationale.push(`Be aggressive in moving any veterans for draft capital while their value is high.`);
      }
    }
  }

  return {
    mode,
    headline,
    rationale: rationale.filter(Boolean).slice(0, 3),
    urgencyScore: Math.round(urgencyScore),
  };
}

// ── Feature 2: Rookie Draft Targets ──────────────────────────────────────────

function computeRookieDraftTargets(
  warByPosition: FranchiseOutlookResult['warByPosition'],
  rookiePool: FCPlayerEntry[],
  maxResults = 5,
): RookieDraftTarget[] {
  if (rookiePool.length === 0) return [];

  // Score positions by need severity
  const positionNeeds = warByPosition
    .filter((p) => p.war < p.leagueAvgWAR)
    .sort((a, b) => {
      // Age amplifies urgency for already-weak positions
      const aNeed = (a.leagueAvgWAR - a.war) + (a.avgAge > 27 && a.avgAge > 0 ? (a.avgAge - 27) * 0.5 : 0);
      const bNeed = (b.leagueAvgWAR - b.war) + (b.avgAge > 27 && b.avgAge > 0 ? (b.avgAge - 27) * 0.5 : 0);
      return bNeed - aNeed;
    });

  const targetPositions = positionNeeds.length > 0
    ? positionNeeds.map((p) => p.position)
    : [...POSITIONS];

  const results: RookieDraftTarget[] = [];
  const positionCounts = new Map<string, number>();

  // Sort entire rookie pool by value; distribute across need positions
  const sortedRookies = [...rookiePool]
    .filter((r) => targetPositions.includes(r.player.position))
    .sort((a, b) => b.value - a.value);

  for (const rookie of sortedRookies) {
    if (results.length >= maxResults) break;
    const pos = rookie.player.position;
    const posCount = positionCounts.get(pos) ?? 0;
    const posRank = targetPositions.indexOf(pos);
    // Allocate more slots to higher-need positions
    const maxPerPos = posRank === 0 ? 3 : posRank === 1 ? 2 : 1;
    if (posCount >= maxPerPos) continue;

    const posNeed = warByPosition.find((p) => p.position === pos);
    const reason = posNeed
      ? `Your ${pos} group is #${posNeed.rank} in league${posNeed.avgAge > 27 && posNeed.avgAge > 0 ? ` (avg age ${posNeed.avgAge.toFixed(0)})` : ''} — target young ${pos}s early.`
      : `Add depth at ${pos}.`;

    // Franchise impact estimates
    // Dynasty value ≈ 450 per WAR at peak (4500 = elite ~10 WAR, 1000 = depth ~2 WAR)
    const estimatedPeakWAR = Math.round((rookie.value / 450) * 10) / 10;
    let impactSummary: string;
    if (posNeed) {
      const currentWAR = Math.max(posNeed.war, 0);
      const delta = estimatedPeakWAR - currentWAR;
      if (delta > 4) {
        impactSummary = `Franchise-altering at ${pos} — projects top-3 in league at peak`;
      } else if (delta > 2) {
        impactSummary = `Projects to push ${pos} room from #${posNeed.rank} to top-half of league`;
      } else if (delta > 0.5) {
        impactSummary = `Meaningful upgrade at ${pos} — narrows gap from #${posNeed.rank}`;
      } else {
        impactSummary = `Depth addition at ${pos} — adds pipeline to aging room`;
      }
    } else {
      impactSummary = estimatedPeakWAR > 5
        ? `Elite prospect — projects ~${estimatedPeakWAR.toFixed(1)} peak WAR`
        : `Adds depth and future flexibility`;
    }

    results.push({
      name: rookie.player.name,
      position: pos,
      dynastyValue: rookie.value,
      overallRank: rookie.overallRank,
      positionRank: rookie.positionRank,
      reason,
      estimatedPeakWAR,
      impactSummary,
    });
    positionCounts.set(pos, posCount + 1);
  }

  return results;
}

// ── Features 3 & 4: Trade Target Players ─────────────────────────────────────

function buildSellerContext(
  ownerName: string,
  sellerTier: FranchiseTier,
  warRank: number,
  numTeams: number,
  futureFirsts: number,
  luckMult: number,
  playerAge: number,
): string {
  if (sellerTier === 'Rebuilding') {
    const picksStr = futureFirsts > 0
      ? `, ${futureFirsts} future 1st${futureFirsts > 1 ? 's' : ''}`
      : '';
    return `${ownerName} is rebuilding (#${warRank}/${numTeams} WAR${picksStr}) — likely values picks over veterans`;
  }
  if (sellerTier === 'Contender' && playerAge <= 24) {
    return `${ownerName} is a contender — may sell youth to win now`;
  }
  if (sellerTier === 'Fringe' && luckMult >= 1.3) {
    return `${ownerName} is overperforming their talent — regression likely, may become a seller`;
  }
  if (sellerTier === 'Fringe') {
    return `${ownerName} is Fringe tier — may be open to restructuring`;
  }
  return `${ownerName} is a contender — expect to pay full value`;
}

function computeTradeTargets(
  thisRosterId: number,
  thisRosterPlayerIds: string[],
  warByPosition: FranchiseOutlookResult['warByPosition'],
  allRosters: SleeperRoster[],
  allPlayers: Record<string, SleeperPlayer>,
  playerWARMap: Map<string, number>,
  fcMap: Map<string, number>,
  userDisplayNames: Map<string, string>,
  allPicksByRosterId: Map<number, FutureDraftPick[]>,
  allTeamWarByPosition: Map<number, Map<string, number>>,
  leagueAvgWARByPosition: Map<string, number>,
  myTier: FranchiseTier,
  myPeakYearOffset: number,
  htcByPlayerId: Map<string, LightweightHTCResult>,
  maxResults = 8,
): { players: TradeTargetPlayer[]; picks: TradeTargetPick[] } {
  const ownedSet = new Set(thisRosterPlayerIds);
  const numTeams = allRosters.length;
  const currentYear = new Date().getFullYear();

  // ── Buyer stance ──────────────────────────────────────────────────────────
  type BuyerStance = 'win-now' | 'building' | 'flexible';
  const buyerStance: BuyerStance =
    myTier === 'Contender' && myPeakYearOffset <= 1 ? 'win-now' :
    myTier === 'Rebuilding' || myPeakYearOffset >= 3 ? 'building' : 'flexible';

  // ── Per-roster tier (from total positional WAR) ───────────────────────────
  const rosterTotalWAR = new Map<number, number>();
  for (const [rId, posMap] of allTeamWarByPosition) {
    rosterTotalWAR.set(rId, [...posMap.values()].reduce((s, v) => s + v, 0));
  }
  const allWARValues = [...rosterTotalWAR.values()];
  const p75WAR = percentile75(allWARValues);
  const medWAR = median(allWARValues);
  const rosterTierFn = (rosterId: number): FranchiseTier => {
    const w = rosterTotalWAR.get(rosterId) ?? 0;
    if (w >= p75WAR) return 'Contender';
    if (w >= medWAR) return 'Fringe';
    return 'Rebuilding';
  };

  // ── Dynasty value rank per roster (for pillar detection) ──────────────────
  const rosterValueRanks = new Map<number, Map<string, number>>();
  for (const r of allRosters) {
    const sorted = (r.players ?? [])
      .map((id) => ({ id, value: fcMap.get(id) ?? 0 }))
      .sort((a, b) => b.value - a.value);
    const rankMap = new Map<string, number>();
    sorted.forEach(({ id }, i) => rankMap.set(id, i + 1));
    rosterValueRanks.set(r.roster_id, rankMap);
  }

  // ── Luck multiplier (wins rank vs WAR rank) ───────────────────────────────
  const rosterWinsSorted = [...allRosters]
    .map((r) => ({ id: r.roster_id, wins: r.settings?.wins ?? 0 }))
    .sort((a, b) => b.wins - a.wins);
  const winsRankByRosterId = new Map(rosterWinsSorted.map(({ id }, i) => [id, i + 1]));

  const rosterWARSorted = [...rosterTotalWAR.entries()].sort((a, b) => b[1] - a[1]);
  const warRankByRosterId = new Map(rosterWARSorted.map(([id], i) => [id, i + 1]));

  const luckMultFn = (rosterId: number): number => {
    const wRank = winsRankByRosterId.get(rosterId) ?? numTeams;
    const warRank = warRankByRosterId.get(rosterId) ?? numTeams;
    if (wRank <= numTeams * 0.25 && warRank >= numTeams * 0.6) return 1.3;
    if (warRank <= numTeams * 0.25 && wRank >= numTeams * 0.6) return 0.7;
    return 1.0;
  };

  // ── Need signals ──────────────────────────────────────────────────────────
  let weakPositions = warByPosition
    .filter((p) => p.war < p.leagueAvgWAR)
    .sort((a, b) => (a.war - a.leagueAvgWAR) - (b.war - b.leagueAvgWAR));
  if (weakPositions.length === 0) {
    weakPositions = [...warByPosition].sort((a, b) => a.war - b.war).slice(0, 2);
  }
  const weakPositionSet = new Set(weakPositions.map((p) => p.position));

  const needMultFn = (pos: string): number => {
    const posNeed = warByPosition.find((p) => p.position === pos);
    if (!posNeed) return 0.6;
    const deficit = posNeed.leagueAvgWAR - posNeed.war;
    const deficitPct = deficit / (posNeed.leagueAvgWAR || 1);
    const rankNeed = posNeed.rank / numTeams;
    return 0.6 + Math.min(deficitPct * 0.6 + rankNeed * 0.4, 1.0) * 1.4;
  };

  // ── Timeline penalty ──────────────────────────────────────────────────────
  const timelinePenaltyFn = (age: number, pos: string): number => {
    const declineAge = DECLINE_AGE[pos] ?? 30;
    if (buyerStance === 'win-now') {
      if (pos === 'RB' && age <= 23) return 0.2;
      if (age <= 21) return 0.3;
      if (age >= declineAge + 2) return 0.5;
      return 1.0;
    }
    if (buyerStance === 'building') {
      if (age >= 30) return 0.1;
      if (age >= 28 && pos === 'RB') return 0.2;
      if (age >= 29) return 0.4;
      if (age <= 24) return 1.2;
      return 0.85;
    }
    // flexible
    if (age >= 31 && pos === 'RB') return 0.5;
    if (age >= 32) return 0.6;
    return 1.0;
  };

  // ── Urgency flag ──────────────────────────────────────────────────────────
  const urgencyFlagFn = (age: number, pos: string, dynastyValue: number): 'buy-low' | 'closing-window' | null => {
    const ageMult = getMultiplier(pos, age);
    const twoYrMult = getMultiplier(pos, age + 2);
    const drop = ageMult > 0 ? (ageMult - twoYrMult) / ageMult : 0;
    if (dynastyValue > 3000 && drop > 0.15) return 'buy-low';
    if (drop > 0.07) return 'closing-window';
    return null;
  };

  // ── Seller tier multiplier ────────────────────────────────────────────────
  const sellerTierMultFn = (tier: FranchiseTier, age: number): number => {
    const isVet = age >= 28;
    const isYoung = age <= 24;
    if (tier === 'Rebuilding' && isVet) return 0.85;
    if (tier === 'Rebuilding' && !isYoung) return 0.65;
    if (tier === 'Contender' && isYoung) return 0.80;
    if (tier === 'Rebuilding' && isYoung) return 0.25;
    if (tier === 'Contender' && isVet) return 0.30;
    return 0.50;
  };

  // ── Candidate collection ──────────────────────────────────────────────────
  type PlayerCandidate = TradeTargetPlayer & { finalScore: number; availabilityMult: number; sellerContext: string };
  type PickCandidate = { pick: FutureDraftPick; pickScore: number; estimatedValue: number; ownerUserId: string; ownerName: string; sellerTier: FranchiseTier; slotLabel: string; reason: string };

  const playerCandidates: PlayerCandidate[] = [];
  const pickCandidates: PickCandidate[] = [];

  for (const roster of allRosters) {
    if (roster.roster_id === thisRosterId) continue;
    const ownerUserId = roster.owner_id;
    if (!ownerUserId) continue;
    const ownerName = userDisplayNames.get(ownerUserId) ?? 'Unknown';
    const sellerTier = rosterTierFn(roster.roster_id);
    const luckMult = luckMultFn(roster.roster_id);
    const rankMap = rosterValueRanks.get(roster.roster_id) ?? new Map<string, number>();

    // Player candidates
    for (const pid of roster.players ?? []) {
      if (ownedSet.has(pid)) continue;
      const player = allPlayers[pid];
      if (!player) continue;
      const pos = player.position ?? '';
      if (!CURVE_POSITIONS.has(pos)) continue;
      if (!weakPositionSet.has(pos)) continue;

      const rankOnTeam = rankMap.get(pid) ?? 99;
      if (rankOnTeam <= 2) continue; // hard pillar skip

      const age = player.age ?? 26;
      const war = playerWARMap.get(pid) ?? 0;
      const dynastyValue = fcMap.get(pid) ?? null;
      const baseValue = dynastyValue ?? (Math.max(war, 0) * 450);
      if (baseValue < 200) continue;

      const timelinePenalty = timelinePenaltyFn(age, pos);
      if (timelinePenalty < 0.1) continue;

      // Depth multiplier
      const theirWARAtPos = allTeamWarByPosition.get(roster.roster_id)?.get(pos) ?? 0;
      const playerWAR = Math.max(war, 0);
      const playerShare = theirWARAtPos > 0 ? playerWAR / theirWARAtPos : 1.0;
      const leagueAvgAtPos = leagueAvgWARByPosition.get(pos) ?? 0;
      const surplusWAR = Math.max(theirWARAtPos - leagueAvgAtPos, 0);
      const surplusFrac = surplusWAR / (leagueAvgAtPos || 1);
      const depthMult =
        playerShare > 0.7 ? 0.15 :
        playerShare > 0.5 ? 0.40 :
        surplusFrac > 0.5 && playerShare < 0.3 ? 1.0 :
        surplusFrac > 0.25 ? 0.75 : 0.50;

      const pillarMult = rankOnTeam === 3 ? 0.55 : rankOnTeam === 4 ? 0.80 : 1.0;
      const liquidityMult = POSITION_LIQUIDITY[pos] ?? 1.0;
      const baseSeller = sellerTierMultFn(sellerTier, age);

      // HTC-augmented seller multiplier: use the seller's own algorithm signal
      const htcResult = htcByPlayerId.get(pid);
      let htcSellerMult = baseSeller;
      if (htcResult) {
        if (htcResult.verdict === 'TRADE') {
          const boost =
            htcResult.tradeType === 'sell-high' ? 1.4 :
            htcResult.tradeType === 'sell-declining' ? 1.3 :
            htcResult.tradeType === 'rebuild-asset' ? 1.2 :
            1.15; // surplus-depth
          htcSellerMult = Math.min(1.0, baseSeller * boost);
        } else if (htcResult.verdict === 'HOLD') {
          // Algorithm says keep — hard to pry loose
          htcSellerMult = Math.max(0.05, baseSeller * 0.5);
        }
        // CUT: likely already filtered by baseValue < 200; keep baseSeller
      }

      const availabilityMult = Math.max(0.05, Math.min(1.0,
        htcSellerMult * depthMult * pillarMult * liquidityMult * luckMult,
      ));

      const needMult = needMultFn(pos);

      // HTC confidence boost: very strong trade signal pushes score up
      let htcConfidenceBoost = 1.0;
      if (htcResult) {
        if (htcResult.verdict === 'TRADE' && htcResult.htcScore < 45) {
          htcConfidenceBoost = 1.0 + (45 - htcResult.htcScore) / 100; // up to 1.45x
        } else if (htcResult.verdict === 'HOLD' && htcResult.htcScore > 70) {
          htcConfidenceBoost = 0.7; // strong hold = penalty
        }
      }

      const finalScore = baseValue * needMult * availabilityMult * timelinePenalty * htcConfidenceBoost;

      const urgency = urgencyFlagFn(age, pos, dynastyValue ?? 0);
      const posNeed = warByPosition.find((p) => p.position === pos);
      const timelineMatch: TradeTargetPlayer['timelineMatch'] =
        timelinePenalty >= 0.9 ? 'ideal' : timelinePenalty >= 0.6 ? 'good' : 'marginal';

      // Build reason text (includes HTC signal when available)
      const needPart = posNeed
        ? `Your ${pos} is #${posNeed.rank}/${numTeams} in the league`
        : `Addresses ${pos} depth`;
      const availPart =
        sellerTier === 'Rebuilding' && age >= 26 ? `${ownerName} is rebuilding — may move veterans` :
        sellerTier === 'Contender' && age <= 24 ? `${ownerName} (contender) may sell youth for wins now` :
        depthMult >= 0.75 ? `${ownerName} has ${pos} depth to spare` : '';
      const urgencyPart =
        urgency === 'buy-low' ? `Buy before dynasty value drops` :
        urgency === 'closing-window' ? `Value declining — act soon` : '';
      const htcPart =
        htcResult?.verdict === 'TRADE' && htcResult.tradeType === 'sell-high' ? `Algorithm flags as sell-high` :
        htcResult?.verdict === 'TRADE' && htcResult.tradeType === 'sell-declining' ? `Declining value on their roster` :
        htcResult?.verdict === 'TRADE' && htcResult.tradeType === 'surplus-depth' ? `Surplus depth on their roster` :
        htcResult?.verdict === 'TRADE' && htcResult.tradeType === 'rebuild-asset' ? `Doesn't fit their rebuild` :
        '';
      const reason = [needPart, availPart || htcPart, !availPart ? '' : htcPart, urgencyPart]
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i) // dedupe
        .slice(0, 3)
        .join('. ');

      // HTC signal label for UI
      const htcSignal: TradeTargetPlayer['htcSignal'] =
        htcResult?.verdict === 'TRADE' && (htcResult.tradeType === 'sell-high' || htcResult.tradeType === 'sell-declining')
          ? 'motivated-seller'
          : htcResult?.verdict === 'TRADE'
          ? 'neutral'
          : htcResult?.verdict === 'HOLD'
          ? 'reluctant-seller'
          : null;

      const sellerFutureFirsts = (allPicksByRosterId.get(roster.roster_id) ?? [])
        .filter((p) => p.round === 1).length;
      const sellerWarRank = warRankByRosterId.get(roster.roster_id) ?? numTeams;

      playerCandidates.push({
        name: `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim(),
        position: pos,
        age,
        war: Math.round(war * 10) / 10,
        dynastyValue,
        ownerUserId,
        ownerDisplayName: ownerName,
        reason,
        availabilityScore: Math.round(availabilityMult * 100) / 100,
        timelineMatch,
        urgencyFlag: urgency,
        sellerTierLabel: sellerTier,
        sellerContext: buildSellerContext(ownerName, sellerTier, sellerWarRank, numTeams, sellerFutureFirsts, luckMult, age),
        htcSignal,
        htcTradeType: htcResult?.tradeType ?? null,
        finalScore,
        availabilityMult,
      });
    }

    // Pick candidates
    const theirPicks = (allPicksByRosterId.get(roster.roster_id) ?? [])
      .filter((p) => p.round <= 2)
      .sort((a, b) => Number(a.season) - Number(b.season) || a.round - b.round);
    const bestPick = theirPicks[0];
    if (bestPick) {
      const originalRosterId = bestPick.roster_id;
      const originalTeamWAR = rosterTotalWAR.get(originalRosterId) ?? median(allWARValues);
      const sortedWARsAsc = [...allWARValues].sort((a, b) => a - b);
      const projectedPickSlot = sortedWARsAsc.findIndex((w) => w >= originalTeamWAR) + 1;
      const slotFraction = projectedPickSlot / numTeams;
      const r1Base = slotFraction <= 0.25 ? 7500 : slotFraction <= 0.5 ? 5500 : slotFraction <= 0.75 ? 3500 : 2200;
      const r2Base = slotFraction <= 0.25 ? 3000 : slotFraction <= 0.5 ? 2000 : slotFraction <= 0.75 ? 1300 : 800;
      const basePickValue = bestPick.round === 1 ? r1Base : r2Base;
      const yearOffset = Number(bestPick.season) - currentYear;
      const yearDiscount = Math.pow(0.85, Math.max(0, yearOffset - 1));
      const estimatedValue = Math.round(basePickValue * yearDiscount);

      if (estimatedValue >= 1000) {
        const slotLabel =
          slotFraction <= 0.25 ? `Top-${Math.ceil(numTeams * 0.25)} pick likely` :
          slotFraction <= 0.5 ? `Mid-first likely` : `Late first likely`;
        const pickSellerMult =
          sellerTier === 'Contender' ? 0.90 :
          sellerTier === 'Fringe' ? 0.65 : 0.25;
        const pickAvailability = Math.max(0.05, Math.min(1.0, pickSellerMult * luckMult));
        const pickScore = estimatedValue * pickAvailability;
        const pickReason =
          slotFraction <= 0.25 ? `Top draft pick from a weak team — high rookie upside` :
          slotFraction <= 0.5 ? `Solid mid-first from ${ownerName}` :
          `Late first from ${ownerName} — limited upside`;

        pickCandidates.push({
          pick: bestPick,
          pickScore,
          estimatedValue,
          ownerUserId,
          ownerName,
          sellerTier,
          slotLabel,
          reason: pickReason,
        });
      }
    }
  }

  // ── Sort and deduplicate players ──────────────────────────────────────────
  playerCandidates.sort((a, b) => {
    const diff = b.finalScore - a.finalScore;
    if (Math.abs(diff) > 200) return diff;
    // Motivated sellers surface ahead of neutral signals at similar score
    const aMotivated = a.htcSignal === 'motivated-seller' ? 1 : 0;
    const bMotivated = b.htcSignal === 'motivated-seller' ? 1 : 0;
    if (bMotivated !== aMotivated) return bMotivated - aMotivated;
    return b.availabilityMult - a.availabilityMult;
  });

  const ownerCounts = new Map<string, number>();
  const posCounts = new Map<string, number>();
  const players: TradeTargetPlayer[] = [];

  for (const c of playerCandidates) {
    if (players.length >= maxResults) break;
    const oCount = ownerCounts.get(c.ownerUserId) ?? 0;
    if (oCount >= 2) continue;
    const pCount = posCounts.get(c.position) ?? 0;
    if (pCount >= 2) continue;
    players.push({
      name: c.name, position: c.position, age: c.age, war: c.war,
      dynastyValue: c.dynastyValue, ownerUserId: c.ownerUserId, ownerDisplayName: c.ownerDisplayName,
      reason: c.reason, availabilityScore: c.availabilityScore, timelineMatch: c.timelineMatch,
      urgencyFlag: c.urgencyFlag, sellerTierLabel: c.sellerTierLabel, sellerContext: c.sellerContext,
      htcSignal: c.htcSignal, htcTradeType: c.htcTradeType,
    });
    ownerCounts.set(c.ownerUserId, oCount + 1);
    posCounts.set(c.position, pCount + 1);
  }

  // ── Sort and deduplicate picks ────────────────────────────────────────────
  pickCandidates.sort((a, b) => b.pickScore - a.pickScore);
  const pickOwnerSeen = new Set<string>();
  const picks: TradeTargetPick[] = [];

  for (const c of pickCandidates) {
    if (picks.length >= 3) break;
    if (pickOwnerSeen.has(c.ownerUserId)) continue;
    pickOwnerSeen.add(c.ownerUserId);
    picks.push({
      season: c.pick.season,
      round: c.pick.round,
      estimatedValue: c.estimatedValue,
      projectedSlotLabel: c.slotLabel,
      originalTeamName: c.ownerName,
      ownerUserId: c.ownerUserId,
      ownerDisplayName: c.ownerName,
      reason: c.reason,
      availabilityScore: Math.round(Math.max(0.05, c.pickScore / (c.estimatedValue || 1)) * 100) / 100,
    });
  }

  return { players, picks };
}

// ── Feature 5: Trade Partner Matching ────────────────────────────────────────

/** Find the top player at a given position on a roster, by dynasty value then WAR.
 *  Excludes pillar players (franchise cornerstones unlikely to be traded) and
 *  applies an age-curve bonus to prefer assets that match the receiver's timeline.
 */
function topPlayerAtPosition(
  rosterPlayerIds: string[],
  position: string,
  allPlayers: Record<string, SleeperPlayer>,
  playerWARMap: Map<string, number>,
  fcMap: Map<string, number>,
  excludeIds?: Set<string>,
  receiverTier?: 'Contender' | 'Fringe' | 'Rebuilding',
): { name: string; value: number } | undefined {
  let best: { name: string; score: number; value: number } | null = null;
  for (const pid of rosterPlayerIds) {
    if (excludeIds?.has(pid)) continue;
    const p = allPlayers[pid];
    if (!p || p.position !== position) continue;
    const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
    const war = playerWARMap.get(pid) ?? 0;
    const fc = fcMap.get(pid) ?? 0;
    const baseValue = fc > 0 ? fc : Math.max(war, 0) * 500;
    // Age-curve bonus: prefer assets that match the receiver's timeline
    const age = p.age ?? 26;
    let ageBonus = 0;
    if (receiverTier === 'Rebuilding' && age <= 24) ageBonus = baseValue * 0.1;
    else if (receiverTier === 'Contender' && age >= 26 && age <= 30) ageBonus = baseValue * 0.05;
    const score = baseValue + ageBonus;
    if (!best || score > best.score) best = { name, score, value: baseValue };
  }
  return best ? { name: best.name, value: best.value } : undefined;
}

function computeTradePartners(
  thisRosterId: number,
  thisRosterPlayerIds: string[],
  thisWarByPosition: FranchiseOutlookResult['warByPosition'],
  allRosters: SleeperRoster[],
  allTeamWarByPosition: Map<number, Map<string, number>>,
  positionRanksByRoster: Map<number, Map<string, number>>,
  leagueAvgWARByPosition: Map<string, number>,
  userDisplayNames: Map<string, string>,
  userAvatars: Map<string, string | null>,
  allPlayers: Record<string, SleeperPlayer>,
  playerWARMap: Map<string, number>,
  fcMap: Map<string, number>,
  allPicksByRosterId: Map<number, FutureDraftPick[]>,
  htcByPlayerId: Map<string, LightweightHTCResult>,
  maxResults = 3,
): TradePartner[] {
  type Candidate = TradePartner & { score: number };
  const candidates: Candidate[] = [];

  // ── Pillar sets: top-3 dynasty value players per roster are franchise cornerstones ──
  const rosterPillarIds = new Map<number, Set<string>>();
  for (const r of allRosters) {
    const sorted = (r.players ?? [])
      .map((id) => ({ id, value: fcMap.get(id) ?? 0 }))
      .sort((a, b) => b.value - a.value);
    rosterPillarIds.set(r.roster_id, new Set(sorted.slice(0, 3).map((p) => p.id)));
  }
  const myPillarIds = rosterPillarIds.get(thisRosterId) ?? new Set<string>();

  // ── Simplified tier per roster (from total positional WAR) ──
  const rosterTotalWAR = new Map<number, number>();
  for (const [rId, posMap] of allTeamWarByPosition) {
    rosterTotalWAR.set(rId, [...posMap.values()].reduce((s, v) => s + v, 0));
  }
  const allWARValues = [...rosterTotalWAR.values()];
  const p75WAR = percentile75(allWARValues);
  const medWAR = median(allWARValues);
  const rosterTierFn = (rosterId: number): FranchiseTier => {
    const w = rosterTotalWAR.get(rosterId) ?? 0;
    if (w >= p75WAR) return 'Contender';
    if (w >= medWAR) return 'Fringe';
    return 'Rebuilding';
  };
  const myTier = rosterTierFn(thisRosterId);
  const myRanks = positionRanksByRoster.get(thisRosterId) ?? new Map<string, number>();

  for (const roster of allRosters) {
    if (roster.roster_id === thisRosterId) continue;
    const ownerUserId = roster.owner_id;
    if (!ownerUserId) continue;

    const theirWAR = allTeamWarByPosition.get(roster.roster_id);
    if (!theirWAR) continue;
    const theirRanks = positionRanksByRoster.get(roster.roster_id) ?? new Map<string, number>();
    const theirPlayerIds = roster.players ?? [];
    const theirTier = rosterTierFn(roster.roster_id);
    const theirPillarIds = rosterPillarIds.get(roster.roster_id) ?? new Set<string>();

    const theyCanOffer: { position: string; rank: number; delta: number; topPlayer?: string; topPlayerValue?: number; motivatedSeller?: boolean; htcTradeType?: string | null }[] = [];
    const youCanOffer: { position: string; rank: number; delta: number; topPlayer?: string; topPlayerValue?: number }[] = [];
    let score = 0;

    for (const pos of POSITIONS) {
      const myPos = thisWarByPosition.find((p) => p.position === pos);
      const myWAR = myPos?.war ?? 0;
      const myRank = myPos?.rank ?? 0;
      const avgWAR = leagueAvgWARByPosition.get(pos) ?? 0;
      const theirWARVal = theirWAR.get(pos) ?? 0;
      const theirRank = theirRanks.get(pos) ?? 0;

      const myDeficit = avgWAR - myWAR;
      const mySurplus = myWAR - avgWAR;
      const theirDeficit = avgWAR - theirWARVal;

      // They can offer at this position: they're stronger than me here AND they have a non-pillar player
      if (myDeficit > 0 && theirWARVal > myWAR) {
        const top = topPlayerAtPosition(theirPlayerIds, pos, allPlayers, playerWARMap, fcMap, theirPillarIds, myTier);
        if (top) {
          // Check HTC signal for their non-pillar players at this position
          const theirNonPillarAtPos = theirPlayerIds.filter(
            (pid) => !theirPillarIds.has(pid) && allPlayers[pid]?.position === pos,
          );
          const tradeFlaggedCount = theirNonPillarAtPos.filter(
            (pid) => htcByPlayerId.get(pid)?.verdict === 'TRADE',
          ).length;
          const bestHtcTradeType = theirNonPillarAtPos
            .map((pid) => htcByPlayerId.get(pid))
            .filter((h): h is LightweightHTCResult => h?.verdict === 'TRADE')
            .sort((a, b) => {
              const order = { 'sell-high': 4, 'sell-declining': 3, 'rebuild-asset': 2, 'surplus-depth': 1 };
              return (order[b.tradeType ?? 'surplus-depth'] ?? 0) - (order[a.tradeType ?? 'surplus-depth'] ?? 0);
            })[0]?.tradeType ?? null;

          const htcBoost =
            tradeFlaggedCount > 0
              ? bestHtcTradeType === 'sell-high' ? 1.3
                : bestHtcTradeType === 'sell-declining' ? 1.2
                : 1.1
              : theirNonPillarAtPos.length > 0 &&
                theirNonPillarAtPos.every((pid) => htcByPlayerId.get(pid)?.verdict === 'HOLD')
              ? 0.75 // all HOLD = unlikely to trade
              : 1.0;

          const motivatedSeller = tradeFlaggedCount > 0 &&
            (bestHtcTradeType === 'sell-high' || bestHtcTradeType === 'sell-declining');

          theyCanOffer.push({
            position: pos,
            rank: theirRank,
            delta: Math.round((theirWARVal - myWAR) * 10) / 10,
            topPlayer: top.name,
            topPlayerValue: top.value,
            motivatedSeller,
            htcTradeType: bestHtcTradeType,
          });
          score += myDeficit * (theirWARVal - myWAR) * htcBoost;
        }
      }

      // I can offer at this position: I have surplus and they need it AND I have a non-pillar player
      if (mySurplus > 0 && theirDeficit > 0) {
        const top = topPlayerAtPosition(thisRosterPlayerIds, pos, allPlayers, playerWARMap, fcMap, myPillarIds, theirTier);
        if (top) {
          // Check if my HTC says I should be trading at this position
          const myNonPillarAtPos = thisRosterPlayerIds.filter(
            (pid) => !myPillarIds.has(pid) && allPlayers[pid]?.position === pos,
          );
          const myTradeFlagged = myNonPillarAtPos.filter(
            (pid) => htcByPlayerId.get(pid)?.verdict === 'TRADE',
          ).length;
          const htcOfferBoost = myTradeFlagged > 0 ? 1.2 : 1.0;

          youCanOffer.push({
            position: pos,
            rank: myRank,
            delta: Math.round(mySurplus * 10) / 10,
            topPlayer: top.name,
            topPlayerValue: top.value,
          });
          score += mySurplus * theirDeficit * htcOfferBoost;
        }
      }
    }

    // Pick-rich detection: if I'm a Contender and they're Rebuilding with future 1st-round picks,
    // surface those picks as trade assets they can offer
    if (myTier === 'Contender' && theirTier === 'Rebuilding') {
      const theirFutureFirsts = (allPicksByRosterId.get(roster.roster_id) ?? [])
        .filter((p) => p.round === 1)
        .slice(0, 2);
      for (const pick of theirFutureFirsts) {
        theyCanOffer.push({
          position: 'PICK',
          rank: 0,
          delta: 0,
          topPlayer: `${pick.season} 1st`,
          topPlayerValue: 2500,
        });
        score += 1250;
      }
    }

    // Both sides must have something
    if (theyCanOffer.length === 0 || youCanOffer.length === 0) continue;

    // Fairness: compare total implied dynasty value. Tighter threshold = more realistic trades.
    const FAIRNESS_THRESHOLD = 0.72;
    const theyTotalValue = theyCanOffer.reduce((s, o) => s + (o.topPlayerValue ?? 0), 0);
    const youTotalValue = youCanOffer.reduce((s, o) => s + (o.topPlayerValue ?? 0), 0);
    if (theyTotalValue > 0 && youTotalValue > 0) {
      const ratio = Math.min(theyTotalValue, youTotalValue) / Math.max(theyTotalValue, youTotalValue);
      if (ratio < FAIRNESS_THRESHOLD) continue;
    }

    // Window alignment multiplier: contention window compatibility drives trade motivation
    const windowMult =
      (myTier === 'Rebuilding' && theirTier === 'Contender') ||
      (myTier === 'Contender' && theirTier === 'Rebuilding')
        ? 1.4   // ideal: natural buy/sell dynamic
        : myTier !== theirTier
        ? 1.0   // complementary: different tiers, some motivation
        : myTier === 'Fringe'
        ? 0.7   // both fringe: some overlap possible
        : myTier === 'Contender'
        ? 0.5   // both contending: competing for same goal, rarely trade
        : 0.2;  // both rebuilding: almost no reason to trade
    score *= windowMult;

    // Cap to 2 positions per side (strongest match first)
    const theyFinal = [...theyCanOffer].sort((a, b) => b.delta - a.delta).slice(0, 2);
    const youFinal = [...youCanOffer].sort((a, b) => b.delta - a.delta).slice(0, 2);

    // Labels
    const windowAlignment: TradePartner['windowAlignment'] =
      (myTier === 'Rebuilding' && theirTier === 'Contender') ||
      (myTier === 'Contender' && theirTier === 'Rebuilding')
        ? 'ideal'
        : myTier !== theirTier
        ? 'complementary'
        : myTier === 'Fringe'
        ? 'neutral'
        : 'poor';

    const rawRatio =
      theyTotalValue > 0 && youTotalValue > 0
        ? Math.min(theyTotalValue, youTotalValue) / Math.max(theyTotalValue, youTotalValue)
        : 1;
    const valueBalance: TradePartner['valueBalance'] = rawRatio >= 0.85 ? 'fair' : 'slight-gap';

    // Benefit text
    const primaryTheyOffer = theyFinal[0];
    const primaryYouOffer = youFinal[0];

    let myBenefit = '';
    if (windowAlignment === 'ideal' && myTier === 'Rebuilding') {
      myBenefit = `Contender offers proven assets that fit your rebuild`;
    } else if (windowAlignment === 'ideal' && myTier === 'Contender') {
      myBenefit = `Rebuilder offers future capital that extends your window`;
    } else if (primaryTheyOffer) {
      const myRankAtPos = myRanks.get(primaryTheyOffer.position);
      myBenefit = myRankAtPos
        ? `Upgrades your ${primaryTheyOffer.position} (currently #${myRankAtPos} in league)`
        : `Addresses your ${primaryTheyOffer.position} weakness`;
    }

    let theirBenefit = '';
    if (primaryYouOffer) {
      const theirRankAtPos = theirRanks.get(primaryYouOffer.position) ?? 0;
      theirBenefit = theirRankAtPos > 0
        ? `Your ${primaryYouOffer.position} depth fills their #${theirRankAtPos} weakness`
        : `Your ${primaryYouOffer.position} surplus addresses their need`;
    }

    const buildSideStr = (offers: typeof theyFinal): string => {
      const sorted = [...offers].sort((a, b) => b.delta - a.delta);
      if (sorted.length === 0) return '';
      const top = sorted[0];
      const topStr = top.topPlayer ? `${top.topPlayer} (${top.position})` : `${top.position} depth`;
      if (sorted.length === 1) return topStr;
      return `${topStr} + ${sorted.length - 1} more`;
    };

    const theyStr = buildSideStr(theyFinal);
    const youStr = buildSideStr(youFinal);
    const summary = `They offer ${theyStr}; you offer ${youStr}.`;

    candidates.push({
      userId: ownerUserId,
      displayName: userDisplayNames.get(ownerUserId) ?? 'Unknown',
      avatar: userAvatars.get(ownerUserId) ?? null,
      compatibilityScore: 0,
      theyCanOffer: theyFinal,
      youCanOffer: youFinal,
      summary,
      windowAlignment,
      valueBalance,
      myBenefit,
      theirBenefit,
      score,
    });
  }

  const maxScore = Math.max(...candidates.map((c) => c.score), 1);
  for (const c of candidates) {
    c.compatibilityScore = Math.round((c.score / maxScore) * 100);
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, maxResults).map((c) => ({
    userId: c.userId, displayName: c.displayName, avatar: c.avatar,
    compatibilityScore: c.compatibilityScore, theyCanOffer: c.theyCanOffer,
    youCanOffer: c.youCanOffer, summary: c.summary,
    windowAlignment: c.windowAlignment, valueBalance: c.valueBalance,
    myBenefit: c.myBenefit, theirBenefit: c.theirBenefit,
  }));
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeFranchiseOutlook(
  roster: SleeperRoster,
  allPlayers: Record<string, SleeperPlayer>,
  playerWARMap: Map<string, number>,
  allTeamWARs: number[],
  allTeamWeightedAges: number[],
  futurePicks: FutureDraftPick[],
  isSeasonComplete: boolean,
  leagueAvgWARByPosition: Map<string, number>,
  positionRankForRoster: Map<string, number>,
  warRank: number,
  winsRank: number,
  fcMap: Map<string, number>,
  rookiePool: FCPlayerEntry[],
  allRosters: SleeperRoster[],
  userDisplayNames: Map<string, string>,
  userAvatars: Map<string, string | null>,
  allTeamWarByPosition: Map<number, Map<string, number>>,
  positionRanksByRoster: Map<number, Map<string, number>>,
  allPicksByRosterId: Map<number, FutureDraftPick[]>,
  htcByPlayerId: Map<string, LightweightHTCResult> = new Map(),
): FranchiseOutlookResult {
  const playerIds = roster.players ?? [];

  // age-filtered players (used for WAR projections, weighted age, risk calculations)
  type PlayerRecord = { playerId: string; position: string; age: number; currentWAR: number };
  // all skill-position players regardless of age (used for display: Franchise Pillars, Young Pipeline, position WAR)
  type DisplayPlayerRecord = { playerId: string; position: string; age: number | null; currentWAR: number };

  const players: PlayerRecord[] = [];
  const allDisplayPlayers: DisplayPlayerRecord[] = [];

  for (const pid of playerIds) {
    const p = allPlayers[pid];
    if (!p) continue;
    const pos = p.position ?? '';
    if (!CURVE_POSITIONS.has(pos)) continue;
    const age = p.age ?? null;
    allDisplayPlayers.push({ playerId: pid, position: pos, age, currentWAR: playerWARMap.get(pid) ?? 0 });
    // age-filtered subset for projection math
    if (!age || age < 18 || age > 50) continue;
    players.push({ playerId: pid, position: pos, age, currentWAR: playerWARMap.get(pid) ?? 0 });
  }

  // ── 1. Weighted Age ──────────────────────────────────────────────────────
  const totalWAR = players.reduce((sum, p) => sum + Math.max(p.currentWAR, 0), 0);
  let weightedAge: number;
  if (totalWAR === 0 || players.length === 0) {
    weightedAge = players.length > 0
      ? players.reduce((sum, p) => sum + p.age, 0) / players.length
      : 26;
  } else {
    weightedAge = players.reduce((sum, p) => {
      const warShare = Math.max(p.currentWAR, 0) / totalWAR;
      return sum + p.age * warShare;
    }, 0);
  }

  // currentWAR counts all skill-position players regardless of age (no age curve needed for current year)
  const currentWAR = allDisplayPlayers.reduce((sum, p) => sum + p.currentWAR, 0);

  // ── 2. WAR Projection ────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const projectedWAR = [1, 2, 3].map((yearOffset) => {
    const totalProjected = players.reduce((sum, p) => {
      const curMult = getMultiplier(p.position, p.age);
      const futureMult = getMultiplier(p.position, p.age + yearOffset);
      const ratio = curMult > 0 ? futureMult / curMult : 0;
      return sum + p.currentWAR * ratio;
    }, 0);
    const targetYear = currentYear + yearOffset;
    const picksThisYear = futurePicks.filter((p) => Number(p.season) === targetYear);
    const pickBonus = picksThisYear.reduce(
      (sum, p) => sum + pickWARValue(p.round) * (0.85 ** yearOffset), 0,
    );
    return { yearOffset, totalWAR: totalProjected + pickBonus };
  });

  // ── 3. Risk Score ────────────────────────────────────────────────────────
  const projectedYear2WAR = projectedWAR.find((p) => p.yearOffset === 2)?.totalWAR ?? currentWAR;
  const riskDelta = currentWAR - projectedYear2WAR;
  const riskScore = currentWAR > 0
    ? Math.min(100, Math.max(0, (riskDelta / currentWAR) * 100))
    : 0;

  // ── 4. Contender Window ──────────────────────────────────────────────────
  const contenderThreshold = percentile75(allTeamWARs);
  const leagueMedianWAR = median(allTeamWARs);
  const allWARs = [{ yearOffset: 0, totalWAR: currentWAR }, ...projectedWAR];
  const windowLength = allWARs.filter((y) => y.totalWAR >= contenderThreshold).length;
  const currentlyContender = currentWAR >= contenderThreshold;

  // ── 5. Peak Year ─────────────────────────────────────────────────────────
  const peakEntry = allWARs.reduce((best, cur) => cur.totalWAR > best.totalWAR ? cur : best);
  const peakYearOffset = peakEntry.yearOffset;
  const peakWAR = peakEntry.totalWAR;

  // ── 6. Tier ──────────────────────────────────────────────────────────────
  let tier: FranchiseTier;
  if (currentlyContender && windowLength >= 2) {
    tier = 'Contender';
  } else if (currentWAR >= leagueMedianWAR) {
    tier = 'Fringe';
  } else {
    tier = 'Rebuilding';
  }

  const leagueAgePercentile = percentileRank(weightedAge, allTeamWeightedAges);
  const wins = roster.settings.wins;
  const losses = roster.settings.losses;
  const luckScore = winsRank - warRank;
  const numTeams = allTeamWARs.length;

  // ── Key Players ──────────────────────────────────────────────────────────
  // Use allDisplayPlayers so players with null age (e.g. Jackson, Purdy) are still shown
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
  const sortedByValue = [...allDisplayPlayers].sort((a, b) => {
    const spA = allPlayers[a.playerId];
    const spB = allPlayers[b.playerId];
    const nameA = `${spA?.first_name ?? ''} ${spA?.last_name ?? ''}`.trim();
    const nameB = `${spB?.first_name ?? ''} ${spB?.last_name ?? ''}`.trim();
    const aVal = fcMap.get(a.playerId) ?? fcMap.get(`${normalize(nameA)}:${a.position}`) ?? 0;
    const bVal = fcMap.get(b.playerId) ?? fcMap.get(`${normalize(nameB)}:${b.position}`) ?? 0;
    // If both have dynasty values, prefer dynasty value
    if (aVal > 0 && bVal > 0) return bVal - aVal;
    // If one has dynasty value, that one wins
    if (aVal > 0) return -1;
    if (bVal > 0) return 1;
    // Fallback to WAR
    return b.currentWAR - a.currentWAR;
  });
  const keyPlayers = sortedByValue.slice(0, 5).map((p) => {
    const sp = allPlayers[p.playerId];
    const name = `${sp?.first_name ?? ''} ${sp?.last_name ?? ''}`.trim();
    const dynastyValue = fcMap.get(p.playerId) ?? fcMap.get(`${normalize(name)}:${p.position}`) ?? null;
    return {
      name,
      position: p.position,
      age: p.age,
      war: Math.round(p.currentWAR * 10) / 10,
      dynastyValue,
    };
  });

  // ── Young Assets (age ≤ 24) ──────────────────────────────────────────────
  // Use allDisplayPlayers so players with null age can still appear if FC says they're young
  const youngAssets = allDisplayPlayers
    .filter((p) => p.age !== null && p.age <= 24)
    .map((p) => {
      const age = p.age as number; // guaranteed non-null by filter above
      const sp = allPlayers[p.playerId];
      const curMult = getMultiplier(p.position, age);
      const peakMult = peakMultiplierFor(p.position);
      const upsideRatio = curMult > 0 ? peakMult / curMult : 1.0;
      const name = `${sp?.first_name ?? ''} ${sp?.last_name ?? ''}`.trim();
      const fcKey = `${normalize(name)}:${p.position}`;
      const dynastyValue = fcMap.get(p.playerId) ?? fcMap.get(fcKey) ?? null;
      return {
        playerId: p.playerId,
        name,
        position: p.position,
        age,
        war: Math.round(p.currentWAR * 10) / 10,
        upsideRatio: Math.round(upsideRatio * 100) / 100,
        dynastyValue,
      };
    })
    .sort((a, b) => (b.dynastyValue ?? b.upsideRatio * 1000) - (a.dynastyValue ?? a.upsideRatio * 1000));

  // ── WAR by Position ──────────────────────────────────────────────────────
  // WAR sums use allDisplayPlayers (includes null-age stars like Jackson/Purdy)
  // avgAge only uses age-valid players to avoid corrupting the average
  const warByPosition = POSITIONS.map((pos) => {
    const posDisplayPlayers = allDisplayPlayers.filter((p) => p.position === pos);
    const posAgePlayers = players.filter((p) => p.position === pos);
    const posWAR = posDisplayPlayers.reduce((s, p) => s + p.currentWAR, 0);
    const posPositiveWAR = posAgePlayers.reduce((s, p) => s + Math.max(p.currentWAR, 0), 0);
    const avgAge = posPositiveWAR > 0
      ? posAgePlayers.reduce((s, p) => s + p.age * Math.max(p.currentWAR, 0) / posPositiveWAR, 0)
      : posAgePlayers.length > 0
      ? posAgePlayers.reduce((s, p) => s + p.age, 0) / posAgePlayers.length
      : 0;
    return {
      position: pos,
      war: Math.round(posWAR * 10) / 10,
      leagueAvgWAR: Math.round((leagueAvgWARByPosition.get(pos) ?? 0) * 10) / 10,
      rank: positionRankForRoster.get(pos) ?? 0,
      avgAge: Math.round(avgAge * 10) / 10,
    };
  });

  // ── Focus Areas ──────────────────────────────────────────────────────────
  type FocusArea = { signal: string; detail: string; severity: 'positive' | 'warning' | 'info' };
  const rawFocusAreas: FocusArea[] = [];

  for (const pos of warByPosition) {
    if (pos.war < pos.leagueAvgWAR && pos.avgAge > 28 && pos.avgAge > 0) {
      rawFocusAreas.push({
        signal: `${pos.position} needs investment`,
        detail: `Below-average production (#${pos.rank} in league) with an aging corps (avg ${pos.avgAge.toFixed(0)}). Target younger ${pos.position}s.`,
        severity: 'warning',
      });
    } else if (pos.war > pos.leagueAvgWAR && pos.avgAge > 0 && pos.avgAge <= 25) {
      rawFocusAreas.push({
        signal: `${pos.position} is a long-term strength`,
        detail: `#${pos.rank} in league with a young corps (avg ${pos.avgAge.toFixed(0)}). Set for several years.`,
        severity: 'positive',
      });
    }
  }

  const projYear2WAR = projectedWAR.find((p) => p.yearOffset === 2)?.totalWAR ?? currentWAR;
  if (currentlyContender && currentWAR > 0 && projYear2WAR < currentWAR * 0.85) {
    rawFocusAreas.push({
      signal: 'Short window — prioritize now',
      detail: `Roster projected to drop ~${Math.round((1 - projYear2WAR / currentWAR) * 100)}% by ${new Date().getFullYear() + 2}. Favor proven contributors over developmental players.`,
      severity: 'warning',
    });
  }

  const futureFirsts = futurePicks.filter((p) => p.round === 1).length;
  if (!currentlyContender && (futureFirsts >= 2 || youngAssets.length >= 3)) {
    rawFocusAreas.push({
      signal: 'Rebuild capital is strong',
      detail: `${futureFirsts} future first${futureFirsts !== 1 ? 's' : ''} and ${youngAssets.length} player${youngAssets.length !== 1 ? 's' : ''} under 25. Stay patient and accumulate assets.`,
      severity: 'info',
    });
  }

  const focusAreas: FocusArea[] = [
    ...rawFocusAreas.filter((f) => f.severity === 'warning'),
    ...rawFocusAreas.filter((f) => f.severity === 'positive'),
    ...rawFocusAreas.filter((f) => f.severity === 'info'),
  ].slice(0, 3);

  // ── Strategy Recommendation ──────────────────────────────────────────────
  const strategyRecommendation = computeStrategyRecommendation(
    tier, windowLength, luckScore, Math.round(riskScore),
    peakYearOffset, projectedWAR, currentWAR,
    focusAreas, futurePicks, youngAssets.length,
    warRank, numTeams,
    keyPlayers, youngAssets, warByPosition, contenderThreshold,
  );

  // ── Rookie Draft Targets ─────────────────────────────────────────────────
  const rookieDraftTargets = computeRookieDraftTargets(warByPosition, rookiePool);

  // ── Trade Targets ────────────────────────────────────────────────────────
  const tradeTargets = computeTradeTargets(
    roster.roster_id, playerIds,
    warByPosition, allRosters, allPlayers,
    playerWARMap, fcMap, userDisplayNames,
    allPicksByRosterId,
    allTeamWarByPosition,
    leagueAvgWARByPosition,
    tier,
    peakYearOffset,
    htcByPlayerId,
  );

  // ── Trade Partners ───────────────────────────────────────────────────────
  const tradePartners = computeTradePartners(
    roster.roster_id, playerIds,
    warByPosition,
    allRosters, allTeamWarByPosition,
    positionRanksByRoster, leagueAvgWARByPosition,
    userDisplayNames, userAvatars,
    allPlayers, playerWARMap, fcMap,
    allPicksByRosterId,
    htcByPlayerId,
  );

  return {
    weightedAge: Math.round(weightedAge * 10) / 10,
    ageCategory: ageCategory(weightedAge),
    leagueAgePercentile,
    riskScore: Math.round(riskScore),
    riskCategory: riskCategory(riskScore),
    currentWAR: Math.round(currentWAR * 10) / 10,
    projectedWAR: projectedWAR.map((p) => ({ ...p, totalWAR: Math.round(p.totalWAR * 10) / 10 })),
    contenderThreshold: Math.round(contenderThreshold * 10) / 10,
    leagueMedianWAR: Math.round(leagueMedianWAR * 10) / 10,
    windowLength,
    currentlyContender,
    peakYearOffset,
    peakWAR: Math.round(peakWAR * 10) / 10,
    tier,
    futurePicks,
    isSeasonComplete,
    keyPlayers,
    youngAssets,
    warByPosition,
    wins,
    losses,
    warRank,
    winsRank,
    luckScore,
    focusAreas,
    strategyRecommendation,
    rookieDraftTargets,
    tradeTargets,
    tradePartners,
  };
}

export function computeAllTeamWeightedAges(
  rosters: SleeperRoster[],
  allPlayers: Record<string, SleeperPlayer>,
  playerWARMap: Map<string, number>,
): number[] {
  return rosters.map((roster) => {
    const playerIds = roster.players ?? [];
    const players = playerIds
      .map((pid) => ({ p: allPlayers[pid], war: playerWARMap.get(pid) ?? 0 }))
      .filter(({ p }) => p && CURVE_POSITIONS.has(p.position ?? '') && (p.age ?? 0) > 0);

    const totalPositiveWAR = players.reduce((s, { war }) => s + Math.max(war, 0), 0);
    if (totalPositiveWAR === 0 || players.length === 0) {
      return players.length > 0
        ? players.reduce((s, { p }) => s + (p!.age ?? 26), 0) / players.length
        : 26;
    }
    return players.reduce((s, { p, war }) => {
      const share = Math.max(war, 0) / totalPositiveWAR;
      return s + (p!.age ?? 26) * share;
    }, 0);
  });
}
