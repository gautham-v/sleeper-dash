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
  TradePartner,
} from '../types/sleeper';

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
  focusAreas: FranchiseOutlookResult['focusAreas'],
  futurePicks: FutureDraftPick[],
  youngAssetsCount: number,
  warRank: number,
  numTeams: number,
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

  // Pull from existing focus areas (most data-driven signals)
  for (const fa of focusAreas.slice(0, 2)) {
    rationale.push(fa.detail);
  }

  // Add projection / peak insight
  if (peakYearOffset === 0) {
    rationale.push('Roster is at peak strength right now — timing is critical.');
  } else if (peakYearOffset >= 2) {
    rationale.push(
      `Roster is projected to peak in ${peakYearOffset} year${peakYearOffset > 1 ? 's' : ''} — runway exists to build before the window opens.`,
    );
  }

  // Add luck indicator if meaningful
  if (luckScore >= 3) {
    rationale.push(
      `Record is outpacing true talent (+${luckScore} luck) — may regress; prioritize roster improvement over record-chasing.`,
    );
  } else if (luckScore <= -3) {
    rationale.push(
      `Unlucky record (${luckScore} vs WAR rank) — talent is better than standings suggest; stay the course.`,
    );
  }

  return {
    mode,
    headline,
    rationale: rationale.slice(0, 3),
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
    .filter((p) => p.war < p.leagueAvgWAR || (p.avgAge > 27 && p.avgAge > 0))
    .sort((a, b) => {
      const aNeed = (a.leagueAvgWAR - a.war) + (a.avgAge > 27 ? (a.avgAge - 27) * 2 : 0);
      const bNeed = (b.leagueAvgWAR - b.war) + (b.avgAge > 27 ? (b.avgAge - 27) * 2 : 0);
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

    results.push({
      name: rookie.player.name,
      position: pos,
      dynastyValue: rookie.value,
      overallRank: rookie.overallRank,
      positionRank: rookie.positionRank,
      reason,
    });
    positionCounts.set(pos, posCount + 1);
  }

  return results;
}

// ── Features 3 & 4: Trade Target Players ─────────────────────────────────────

const PICK_DYNASTY_VALUE: Record<number, number> = { 1: 5000, 2: 2500, 3: 800, 4: 300 };

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
  maxResults = 6,
): TradeTargetPlayer[] {
  // Identify weak positions, sorted by deficit severity
  let weakPositions = warByPosition
    .filter((p) => p.war < p.leagueAvgWAR)
    .sort((a, b) => (a.war - a.leagueAvgWAR) - (b.war - b.leagueAvgWAR));

  // Fallback: show bottom 2 positions if no clear weakness
  if (weakPositions.length === 0) {
    weakPositions = [...warByPosition].sort((a, b) => a.war - b.war).slice(0, 2);
  }

  const weakPositionSet = new Set(weakPositions.map((p) => p.position));
  const ownedSet = new Set(thisRosterPlayerIds);

  type Candidate = TradeTargetPlayer & { score: number };
  const candidates: Candidate[] = [];

  for (const roster of allRosters) {
    if (roster.roster_id === thisRosterId) continue;
    const ownerUserId = roster.owner_id;
    if (!ownerUserId) continue;
    const ownerName = userDisplayNames.get(ownerUserId) ?? 'Unknown';

    for (const pid of roster.players ?? []) {
      if (ownedSet.has(pid)) continue;
      const player = allPlayers[pid];
      if (!player) continue;
      const pos = player.position ?? '';
      if (!weakPositionSet.has(pos)) continue;

      const war = playerWARMap.get(pid) ?? 0;
      const dynastyValue = fcMap.get(pid) ?? null;

      // Skip players with no signal
      if (dynastyValue === null && war <= 0 && (player.age ?? 99) > 30) continue;

      // Score: dynasty value is primary; fall back to WAR+age
      const score = dynastyValue ?? (Math.max(war, 0) * 500 + ((30 - (player.age ?? 30)) * 60));

      const posNeed = warByPosition.find((p) => p.position === pos);
      const reason = posNeed
        ? `Fills your ${pos} weakness (#${posNeed.rank} in league)`
        : `Addresses ${pos} depth`;

      candidates.push({
        name: `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim(),
        position: pos,
        age: player.age ?? 0,
        war: Math.round(war * 10) / 10,
        dynastyValue,
        ownerUserId,
        ownerDisplayName: ownerName,
        reason,
        score,
      });
    }

    // Add draft picks owned by other teams as potential acquisition targets
    const theirPicks = allPicksByRosterId.get(roster.roster_id) ?? [];
    const sortedPicks = [...theirPicks].sort((a, b) => {
      if (a.season !== b.season) return Number(a.season) - Number(b.season);
      return a.round - b.round;
    });
    // Include up to 2 picks per team (best by year+round)
    for (const pick of sortedPicks.slice(0, 2)) {
      const pickValue = PICK_DYNASTY_VALUE[pick.round] ?? 100;
      candidates.push({
        name: `${pick.season} Round ${pick.round} Pick`,
        position: 'PICK',
        age: 0,
        war: 0,
        dynastyValue: pickValue,
        ownerUserId,
        ownerDisplayName: ownerName,
        reason: `Future draft capital (${pick.season} Rd ${pick.round})`,
        score: pickValue * 0.6, // slightly lower weight than proven players
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // Limit to 2 assets per owner for diversity
  const ownerCounts = new Map<string, number>();
  const results: TradeTargetPlayer[] = [];

  for (const c of candidates) {
    if (results.length >= maxResults) break;
    const count = ownerCounts.get(c.ownerUserId) ?? 0;
    if (count >= 2) continue;
    results.push({
      name: c.name, position: c.position, age: c.age, war: c.war,
      dynastyValue: c.dynastyValue, ownerUserId: c.ownerUserId,
      ownerDisplayName: c.ownerDisplayName, reason: c.reason,
    });
    ownerCounts.set(c.ownerUserId, count + 1);
  }

  return results;
}

// ── Feature 5: Trade Partner Matching ────────────────────────────────────────

/** Find the top player at a given position on a roster, by dynasty value then WAR. */
function topPlayerAtPosition(
  rosterPlayerIds: string[],
  position: string,
  allPlayers: Record<string, SleeperPlayer>,
  playerWARMap: Map<string, number>,
  fcMap: Map<string, number>,
): string | undefined {
  let best: { name: string; score: number } | null = null;
  for (const pid of rosterPlayerIds) {
    const p = allPlayers[pid];
    if (!p || p.position !== position) continue;
    const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
    const war = playerWARMap.get(pid) ?? 0;
    const fc = fcMap.get(pid) ?? 0;
    const score = fc > 0 ? fc : Math.max(war, 0) * 500;
    if (!best || score > best.score) best = { name, score };
  }
  return best?.name;
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
  maxResults = 3,
): TradePartner[] {
  type Candidate = TradePartner & { score: number };
  const candidates: Candidate[] = [];

  for (const roster of allRosters) {
    if (roster.roster_id === thisRosterId) continue;
    const ownerUserId = roster.owner_id;
    if (!ownerUserId) continue;

    const theirWAR = allTeamWarByPosition.get(roster.roster_id);
    if (!theirWAR) continue;
    const theirRanks = positionRanksByRoster.get(roster.roster_id) ?? new Map<string, number>();
    const theirPlayerIds = roster.players ?? [];

    const theyCanOffer: { position: string; rank: number; delta: number; topPlayer?: string }[] = [];
    const youCanOffer: { position: string; rank: number; delta: number; topPlayer?: string }[] = [];
    let score = 0;

    for (const pos of POSITIONS) {
      const myPos = thisWarByPosition.find((p) => p.position === pos);
      const myWAR = myPos?.war ?? 0;
      const myRank = myPos?.rank ?? 0;
      const avgWAR = leagueAvgWARByPosition.get(pos) ?? 0;
      const theirWARVal = theirWAR.get(pos) ?? 0;
      const theirRank = theirRanks.get(pos) ?? 0;

      const myDeficit = avgWAR - myWAR;       // positive = I'm below avg
      const theirSurplus = theirWARVal - avgWAR; // positive = they're above avg
      const mySurplus = myWAR - avgWAR;
      const theirDeficit = avgWAR - theirWARVal;

      if (myDeficit > 0 && theirSurplus > 0) {
        const topPlayer = topPlayerAtPosition(theirPlayerIds, pos, allPlayers, playerWARMap, fcMap);
        theyCanOffer.push({
          position: pos,
          rank: theirRank,
          delta: Math.round(theirSurplus * 10) / 10,
          topPlayer,
        });
        score += myDeficit * theirSurplus;
      }

      if (mySurplus > 0 && theirDeficit > 0) {
        const topPlayer = topPlayerAtPosition(thisRosterPlayerIds, pos, allPlayers, playerWARMap, fcMap);
        youCanOffer.push({
          position: pos,
          rank: myRank,
          delta: Math.round(mySurplus * 10) / 10,
          topPlayer,
        });
        score += mySurplus * theirDeficit;
      }
    }

    if (theyCanOffer.length === 0 && youCanOffer.length === 0) continue;

    const topTheyOffer = [...theyCanOffer].sort((a, b) => b.delta - a.delta)[0];
    const topYouOffer = [...youCanOffer].sort((a, b) => b.delta - a.delta)[0];
    let summary = '';
    if (topTheyOffer && topYouOffer) {
      const theyStr = topTheyOffer.topPlayer
        ? `${topTheyOffer.topPlayer} (${topTheyOffer.position})`
        : `${topTheyOffer.position} #${topTheyOffer.rank}`;
      const youStr = topYouOffer.topPlayer
        ? `${topYouOffer.topPlayer} (${topYouOffer.position})`
        : `${topYouOffer.position} #${topYouOffer.rank}`;
      summary = `They offer ${theyStr}; you offer ${youStr}.`;
    } else if (topTheyOffer) {
      const theyStr = topTheyOffer.topPlayer
        ? `${topTheyOffer.topPlayer} (${topTheyOffer.position})`
        : `${topTheyOffer.position} #${topTheyOffer.rank}`;
      summary = `They have surplus ${theyStr} that addresses your needs.`;
    } else if (topYouOffer) {
      const youStr = topYouOffer.topPlayer
        ? `${topYouOffer.topPlayer} (${topYouOffer.position})`
        : `${topYouOffer.position} #${topYouOffer.rank}`;
      summary = `You have surplus ${youStr} that they need.`;
    }

    candidates.push({
      userId: ownerUserId,
      displayName: userDisplayNames.get(ownerUserId) ?? 'Unknown',
      avatar: userAvatars.get(ownerUserId) ?? null,
      compatibilityScore: 0,
      theyCanOffer,
      youCanOffer,
      summary,
      score,
    });
  }

  // Normalize to 0-100
  const maxScore = Math.max(...candidates.map((c) => c.score), 1);
  for (const c of candidates) {
    c.compatibilityScore = Math.round((c.score / maxScore) * 100);
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, maxResults).map((c) => ({
    userId: c.userId, displayName: c.displayName, avatar: c.avatar,
    compatibilityScore: c.compatibilityScore, theyCanOffer: c.theyCanOffer,
    youCanOffer: c.youCanOffer, summary: c.summary,
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
  const sortedByWAR = [...allDisplayPlayers].sort((a, b) => {
    const warDiff = b.currentWAR - a.currentWAR;
    if (Math.abs(warDiff) > 0.1) return warDiff;
    // Tiebreaker (offseason / zero-WAR): FantasyCalc dynasty value
    // Try sleeperId first, then name:position fallback
    const spA = allPlayers[a.playerId];
    const spB = allPlayers[b.playerId];
    const nameA = `${spA?.first_name ?? ''} ${spA?.last_name ?? ''}`.trim();
    const nameB = `${spB?.first_name ?? ''} ${spB?.last_name ?? ''}`.trim();
    const aVal = fcMap.get(a.playerId) ?? fcMap.get(`${normalize(nameA)}:${a.position}`) ?? 0;
    const bVal = fcMap.get(b.playerId) ?? fcMap.get(`${normalize(nameB)}:${b.position}`) ?? 0;
    return bVal - aVal;
  });
  const keyPlayers = sortedByWAR.slice(0, 5).map((p) => {
    const sp = allPlayers[p.playerId];
    return {
      name: `${sp?.first_name ?? ''} ${sp?.last_name ?? ''}`.trim(),
      position: p.position,
      age: p.age,
      war: Math.round(p.currentWAR * 10) / 10,
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
  );

  // ── Rookie Draft Targets ─────────────────────────────────────────────────
  const rookieDraftTargets = computeRookieDraftTargets(warByPosition, rookiePool);

  // ── Trade Targets ────────────────────────────────────────────────────────
  const tradeTargets = computeTradeTargets(
    roster.roster_id, playerIds,
    warByPosition, allRosters, allPlayers,
    playerWARMap, fcMap, userDisplayNames,
    allPicksByRosterId,
  );

  // ── Trade Partners ───────────────────────────────────────────────────────
  const tradePartners = computeTradePartners(
    roster.roster_id, playerIds,
    warByPosition,
    allRosters, allTeamWarByPosition,
    positionRanksByRoster, leagueAvgWARByPosition,
    userDisplayNames, userAvatars,
    allPlayers, playerWARMap, fcMap,
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
