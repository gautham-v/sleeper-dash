import type {
  SleeperRoster,
  SleeperPlayer,
  FutureDraftPick,
  FranchiseOutlookResult,
  FranchiseTier,
  AgeCategory,
  RiskCategory,
} from '../types/sleeper';

// ---- Static Age Curve Tables ----
// Relative production multipliers vs peak season (PPR era ~2010–2023)

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

// ---- Draft Pick WAR Values ----
// Expected WAR contribution of an incoming draft pick by round
const PICK_WAR_BY_ROUND: Record<number, number> = {
  1: 4.0,
  2: 2.0,
  3: 0.8,
  4: 0.3,
};

function pickWARValue(round: number): number {
  return PICK_WAR_BY_ROUND[round] ?? 0.1;
}

/** Get the age-curve multiplier for a position and age. */
function getMultiplier(position: string, age: number): number {
  const curve = AGE_CURVES[position];
  if (!curve) return 1.0; // non-skill positions treated as neutral

  const ages = Object.keys(curve).map(Number).sort((a, b) => a - b);
  const minAge = ages[0];
  const maxAge = ages[ages.length - 1];

  if (age <= minAge) return curve[minAge];
  if (age >= maxAge) return Math.max(curve[maxAge], MULTIPLIER_FLOOR);

  return curve[age] ?? Math.max(curve[maxAge], MULTIPLIER_FLOOR);
}

/** Get the peak multiplier for a position across all ages. */
function peakMultiplierFor(position: string): number {
  const curve = AGE_CURVES[position];
  if (!curve) return 1.0;
  return Math.max(...Object.values(curve));
}

/** Median of a numeric array. Returns 0 for empty arrays. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** 75th percentile of a numeric array. */
function percentile75(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.75) - 1;
  return sorted[Math.max(0, idx)];
}

/** Percentile rank of a value within an array (0–100, higher = older relative to league). */
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

const POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;

/**
 * Compute the Franchise Outlook for one team.
 */
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
): FranchiseOutlookResult {
  const playerIds = roster.players ?? [];

  // Build player records for skill positions with known age
  type PlayerRecord = { playerId: string; position: string; age: number; currentWAR: number };
  const players: PlayerRecord[] = [];

  for (const pid of playerIds) {
    const p = allPlayers[pid];
    if (!p) continue;
    const pos = p.position ?? '';
    if (!CURVE_POSITIONS.has(pos)) continue;
    const age = p.age;
    if (!age || age < 18 || age > 50) continue;
    const war = playerWARMap.get(pid) ?? 0;
    players.push({ playerId: pid, position: pos, age, currentWAR: war });
  }

  // ── 1. Weighted Average Roster Age ──────────────────────────────────────
  const totalWAR = players.reduce((sum, p) => sum + Math.max(p.currentWAR, 0), 0);
  let weightedAge: number;

  if (totalWAR === 0 || players.length === 0) {
    // Fallback: simple average
    weightedAge =
      players.length > 0
        ? players.reduce((sum, p) => sum + p.age, 0) / players.length
        : 26;
  } else {
    weightedAge = players.reduce((sum, p) => {
      const warShare = Math.max(p.currentWAR, 0) / totalWAR;
      return sum + p.age * warShare;
    }, 0);
  }

  const currentWAR = players.reduce((sum, p) => sum + p.currentWAR, 0);

  // ── 2. & 3. 3-Year WAR Projection ───────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const projectedWAR = [1, 2, 3].map((yearOffset) => {
    const totalProjected = players.reduce((sum, p) => {
      const curMult = getMultiplier(p.position, p.age);
      const futureMult = getMultiplier(p.position, p.age + yearOffset);
      // Avoid division by zero; if curMult is 0 treat projected as 0
      const ratio = curMult > 0 ? futureMult / curMult : 0;
      return sum + p.currentWAR * ratio;
    }, 0);

    // Add discounted expected WAR from future picks arriving this year
    const targetYear = currentYear + yearOffset;
    const picksThisYear = futurePicks.filter((p) => Number(p.season) === targetYear);
    const pickBonus = picksThisYear.reduce(
      (sum, p) => sum + pickWARValue(p.round) * (0.85 ** yearOffset),
      0,
    );

    return { yearOffset, totalWAR: totalProjected + pickBonus };
  });

  // ── 4. Age Curve Risk Score ───────────────────────────────────────────────
  const projectedYear2WAR = projectedWAR.find((p) => p.yearOffset === 2)?.totalWAR ?? currentWAR;
  const riskDelta = currentWAR - projectedYear2WAR;
  let riskScore = 0;
  if (currentWAR > 0) {
    riskScore = Math.min(100, Math.max(0, (riskDelta / currentWAR) * 100));
  }

  // ── 5. Contender Threshold & Window ─────────────────────────────────────
  const contenderThreshold = percentile75(allTeamWARs);
  const leagueMedianWAR = median(allTeamWARs);

  const allWARs = [
    { yearOffset: 0, totalWAR: currentWAR },
    ...projectedWAR,
  ];
  const windowLength = allWARs.filter((y) => y.totalWAR >= contenderThreshold).length;
  const currentlyContender = currentWAR >= contenderThreshold;

  // ── 6. Projected Peak Year ──────────────────────────────────────────────
  const peakEntry = allWARs.reduce((best, cur) =>
    cur.totalWAR > best.totalWAR ? cur : best
  );
  const peakYearOffset = peakEntry.yearOffset;
  const peakWAR = peakEntry.totalWAR;

  // ── 7. Tier Classification ──────────────────────────────────────────────
  let tier: FranchiseTier;
  if (currentlyContender && windowLength >= 2) {
    tier = 'Contender';
  } else if (currentWAR >= leagueMedianWAR) {
    tier = 'Fringe';
  } else {
    tier = 'Rebuilding';
  }

  // ── Age Percentile ───────────────────────────────────────────────────────
  const leagueAgePercentile = percentileRank(weightedAge, allTeamWeightedAges);

  // ── Key Players (Franchise Pillars — top 5 by WAR) ──────────────────────
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
  const sortedByWAR = [...players].sort((a, b) => b.currentWAR - a.currentWAR);
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
  const youngAssets = players
    .filter((p) => p.age <= 24)
    .map((p) => {
      const sp = allPlayers[p.playerId];
      const curMult = getMultiplier(p.position, p.age);
      const peakMult = peakMultiplierFor(p.position);
      const upsideRatio = curMult > 0 ? peakMult / curMult : 1.0;
      const name = `${sp?.first_name ?? ''} ${sp?.last_name ?? ''}`.trim();
      const fcKey = `${normalize(name)}:${p.position}`;
      const dynastyValue = fcMap.get(p.playerId) ?? fcMap.get(fcKey) ?? null;
      return {
        name,
        position: p.position,
        age: p.age,
        war: Math.round(p.currentWAR * 10) / 10,
        upsideRatio: Math.round(upsideRatio * 100) / 100,
        dynastyValue,
      };
    })
    .sort((a, b) => (b.dynastyValue ?? b.upsideRatio * 1000) - (a.dynastyValue ?? a.upsideRatio * 1000));

  // ── WAR by Position ──────────────────────────────────────────────────────
  const warByPosition = POSITIONS.map((pos) => {
    const posPlayers = players.filter((p) => p.position === pos);
    const posWAR = posPlayers.reduce((s, p) => s + p.currentWAR, 0);
    const posPosWAR = posPlayers.reduce((s, p) => s + Math.max(p.currentWAR, 0), 0);
    const avgAge =
      posPosWAR > 0
        ? posPlayers.reduce((s, p) => s + p.age * Math.max(p.currentWAR, 0) / posPosWAR, 0)
        : posPlayers.length > 0
        ? posPlayers.reduce((s, p) => s + p.age, 0) / posPlayers.length
        : 0;
    return {
      position: pos,
      war: Math.round(posWAR * 10) / 10,
      leagueAvgWAR: Math.round((leagueAvgWARByPosition.get(pos) ?? 0) * 10) / 10,
      rank: positionRankForRoster.get(pos) ?? 0,
      avgAge: Math.round(avgAge * 10) / 10,
    };
  });

  // ── Wins / Losses / Luck Score ───────────────────────────────────────────
  const wins = roster.settings.wins;
  const losses = roster.settings.losses;
  const luckScore = winsRank - warRank; // positive = record better than WAR deserves

  // ── Focus Areas (prescriptive signals) ──────────────────────────────────
  type FocusArea = { signal: string; detail: string; severity: 'positive' | 'warning' | 'info' };
  const focusAreas: FocusArea[] = [];

  // Position health: below avg AND aging / above avg AND young
  for (const pos of warByPosition) {
    if (pos.war < pos.leagueAvgWAR && pos.avgAge > 28 && pos.avgAge > 0) {
      focusAreas.push({
        signal: `${pos.position} needs investment`,
        detail: `Below-average production (#${pos.rank} in league) with an aging corps (avg ${pos.avgAge.toFixed(0)}). Target younger ${pos.position}s.`,
        severity: 'warning',
      });
    } else if (pos.war > pos.leagueAvgWAR && pos.avgAge > 0 && pos.avgAge <= 25) {
      focusAreas.push({
        signal: `${pos.position} is a long-term strength`,
        detail: `#${pos.rank} in league with a young corps (avg ${pos.avgAge.toFixed(0)}). Set for several years.`,
        severity: 'positive',
      });
    }
  }

  // Short window: currently contending but projecting sharp decline
  const projYear2WAR = projectedWAR.find((p) => p.yearOffset === 2)?.totalWAR ?? currentWAR;
  if (currentlyContender && currentWAR > 0 && projYear2WAR < currentWAR * 0.85) {
    focusAreas.push({
      signal: 'Short window — prioritize now',
      detail: `Roster projected to drop ~${Math.round((1 - projYear2WAR / currentWAR) * 100)}% by ${new Date().getFullYear() + 2}. Favor proven contributors over developmental players.`,
      severity: 'warning',
    });
  }

  // Rebuild capital: not contending but strong pipeline
  const futureFirsts = futurePicks.filter((p) => p.round === 1).length;
  if (!currentlyContender && (futureFirsts >= 2 || youngAssets.length >= 3)) {
    focusAreas.push({
      signal: 'Rebuild capital is strong',
      detail: `${futureFirsts} future first${futureFirsts !== 1 ? 's' : ''} and ${youngAssets.length} player${youngAssets.length !== 1 ? 's' : ''} under 25. Stay patient and accumulate assets.`,
      severity: 'info',
    });
  }

  // Sort: warnings first, then positive, then info; limit to 3
  const sortedFocusAreas: FocusArea[] = [
    ...focusAreas.filter((f) => f.severity === 'warning'),
    ...focusAreas.filter((f) => f.severity === 'positive'),
    ...focusAreas.filter((f) => f.severity === 'info'),
  ].slice(0, 3);

  return {
    weightedAge: Math.round(weightedAge * 10) / 10,
    ageCategory: ageCategory(weightedAge),
    leagueAgePercentile,
    riskScore: Math.round(riskScore),
    riskCategory: riskCategory(riskScore),
    currentWAR: Math.round(currentWAR * 10) / 10,
    projectedWAR: projectedWAR.map((p) => ({
      ...p,
      totalWAR: Math.round(p.totalWAR * 10) / 10,
    })),
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
    focusAreas: sortedFocusAreas,
  };
}

/**
 * Compute all teams' weighted ages (needed for age percentile ranking).
 * Called before computeFranchiseOutlook so we can pass the full league array.
 */
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
