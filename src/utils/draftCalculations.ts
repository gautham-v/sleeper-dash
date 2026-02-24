import type {
  SleeperMatchup,
  SleeperDraftPick,
  AnalyzedPick,
  DraftClassSeason,
  ManagerDraftSummary,
  LeagueDraftAnalysis,
} from '../types/sleeper';

// ---------- Helpers ----------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function assignGrade(percentile: number): { grade: ManagerDraftSummary['grade']; gradeColor: string } {
  if (percentile >= 90) return { grade: 'A+', gradeColor: 'text-emerald-400' };
  if (percentile >= 75) return { grade: 'A',  gradeColor: 'text-green-400' };
  if (percentile >= 50) return { grade: 'B',  gradeColor: 'text-lime-400' };
  if (percentile >= 25) return { grade: 'C',  gradeColor: 'text-yellow-400' };
  if (percentile >= 10) return { grade: 'D',  gradeColor: 'text-orange-400' };
  return { grade: 'F', gradeColor: 'text-red-400' };
}

// ---------- Core computations ----------

/**
 * Aggregate players_points across all regular-season weeks for a single season.
 * Returns Map<playerId, totalSeasonPoints>.
 */
export function computePlayerSeasonPoints(
  weeklyMatchups: SleeperMatchup[][],
): Map<string, number> {
  const points = new Map<string, number>();
  for (const week of weeklyMatchups) {
    for (const matchup of week) {
      for (const [playerId, pts] of Object.entries(matchup.players_points ?? {})) {
        points.set(playerId, (points.get(playerId) ?? 0) + pts);
      }
    }
  }
  return points;
}

/**
 * For each position, compute the median season points among all drafted players at
 * that position. Players with missing/zero points are included (they contribute 0).
 * Returns Map<position, replacementLevel>.
 */
export function computeReplacementLevel(
  picks: SleeperDraftPick[],
  playerSeasonPoints: Map<string, number>,
): Map<string, number> {
  const byPosition = new Map<string, number[]>();
  for (const pick of picks) {
    const pos = pick.metadata.position;
    if (!pos) continue;
    const pts = playerSeasonPoints.get(pick.player_id) ?? 0;
    const arr = byPosition.get(pos) ?? [];
    arr.push(pts);
    byPosition.set(pos, arr);
  }
  const result = new Map<string, number>();
  for (const [pos, values] of byPosition) {
    result.set(pos, median(values));
  }
  return result;
}

/**
 * Compute the mean WAR for all picks in each round number, across all seasons.
 * Returns Map<round, expectedWAR>.
 */
export function computeExpectedWARByRound(
  allPicks: Array<{ round: number; war: number }>,
): Map<number, number> {
  const byRound = new Map<number, number[]>();
  for (const { round, war } of allPicks) {
    const arr = byRound.get(round) ?? [];
    arr.push(war);
    byRound.set(round, arr);
  }
  const result = new Map<number, number>();
  for (const [round, wars] of byRound) {
    result.set(round, wars.reduce((s, w) => s + w, 0) / wars.length);
  }
  return result;
}

/**
 * Classify picks in a single round as hit/bust/neutral.
 * Top 30% WAR → hit, bottom 30% → bust, middle → neutral.
 * Mutates the hitBust field of each pick in place.
 */
export function assignHitBust(picksInRound: AnalyzedPick[]): void {
  if (picksInRound.length === 0) return;
  const sorted = [...picksInRound].sort((a, b) => b.war - a.war);
  const hitCount = Math.max(1, Math.floor(sorted.length * 0.3));
  const bustCount = Math.max(1, Math.floor(sorted.length * 0.3));
  // Only assign hit/bust if there are enough picks to differentiate
  if (sorted.length < 3) {
    // With 1-2 picks, never penalize the sole player as a bust
    return;
  }
  const hitIds = new Set(sorted.slice(0, hitCount).map((p) => p.playerId + p.season));
  const bustIds = new Set(sorted.slice(sorted.length - bustCount).map((p) => p.playerId + p.season));
  for (const pick of picksInRound) {
    const key = pick.playerId + pick.season;
    if (hitIds.has(key)) pick.hitBust = 'hit';
    else if (bustIds.has(key)) pick.hitBust = 'bust';
    else pick.hitBust = 'neutral';
  }
}

// ---------- Season draft data shape for computeLeagueDraftAnalysis ----------

export interface SeasonDraftInput {
  season: string;
  picks: SleeperDraftPick[];
  playerSeasonPoints: Map<string, number>;
  rosterToUser: Map<number, string>; // rosterId -> userId
  userInfo: Map<string, { displayName: string; avatar: string | null }>; // userId -> info
}

/**
 * Main orchestrator: takes all season data and produces the full LeagueDraftAnalysis.
 */
export function computeLeagueDraftAnalysis(
  seasonData: SeasonDraftInput[],
): LeagueDraftAnalysis {
  if (seasonData.length === 0) {
    return {
      managerSummaries: new Map(),
      surplusByUserId: new Map(),
      hasData: false,
    };
  }

  // Phase 1 & 2: Compute per-season replacement levels and WAR per pick
  // First pass: collect WAR per pick (without expected value yet)
  type PickWithWAR = AnalyzedPick;
  const allPicksFlat: PickWithWAR[] = [];

  for (const { season, picks, playerSeasonPoints, rosterToUser, userInfo } of seasonData) {
    const replacementLevel = computeReplacementLevel(picks, playerSeasonPoints);

    for (const pick of picks) {
      const userId = pick.picked_by || rosterToUser.get(pick.roster_id) || '';
      if (!userId) continue;

      const pos = pick.metadata.position || 'UNK';
      const seasonPts = playerSeasonPoints.get(pick.player_id) ?? 0;
      const replLevel = replacementLevel.get(pos) ?? 0;
      const war = seasonPts - replLevel;
      const playerName =
        `${pick.metadata.first_name ?? ''} ${pick.metadata.last_name ?? ''}`.trim() || pick.player_id;

      allPicksFlat.push({
        pickNo: pick.pick_no,
        round: pick.round,
        playerName,
        playerId: pick.player_id,
        position: pos,
        isKeeper: pick.is_keeper ?? false,
        season,
        seasonPoints: seasonPts,
        replacementLevel: replLevel,
        war,
        expectedWar: 0, // filled in next phase
        surplus: 0,     // filled in next phase
        hitBust: 'neutral',
      });
    }

    // Silence unused warning — userInfo is used below in Phase 5
    void userInfo;
  }

  // Phase 4: Compute expected WAR by round
  const expectedWARByRound = computeExpectedWARByRound(
    allPicksFlat.map((p) => ({ round: p.round, war: p.war })),
  );

  // Phase 5: Assign expected WAR and surplus to each pick
  for (const pick of allPicksFlat) {
    pick.expectedWar = expectedWARByRound.get(pick.round) ?? 0;
    pick.surplus = pick.war - pick.expectedWar;
  }

  // Phase 5b: Assign hit/bust within each (season × round) group
  const roundGroups = new Map<string, AnalyzedPick[]>();
  for (const pick of allPicksFlat) {
    const key = `${pick.season}:${pick.round}`;
    const arr = roundGroups.get(key) ?? [];
    arr.push(pick);
    roundGroups.set(key, arr);
  }
  for (const picksInRound of roundGroups.values()) {
    assignHitBust(picksInRound);
  }

  // Phase 6: Aggregate per manager
  // Collect all user info from all seasons
  const allUserInfo = new Map<string, { displayName: string; avatar: string | null }>();
  for (const { userInfo } of seasonData) {
    for (const [uid, info] of userInfo) {
      if (!allUserInfo.has(uid)) allUserInfo.set(uid, info);
    }
  }

  // Group picks by userId then by season
  const picksByUser = new Map<string, AnalyzedPick[]>();
  for (const pick of allPicksFlat) {
    // Determine userId from the season data
    const seasonEntry = seasonData.find((s) => s.season === pick.season);
    if (!seasonEntry) continue;
    const userId = seasonEntry.picks.find((p) => p.player_id === pick.playerId && p.round === pick.round && p.pick_no === pick.pickNo)?.picked_by
      || seasonEntry.rosterToUser.get(
        seasonEntry.picks.find((p) => p.player_id === pick.playerId && p.round === pick.round && p.pick_no === pick.pickNo)?.roster_id ?? -1
      ) || '';
    if (!userId) continue;
    const arr = picksByUser.get(userId) ?? [];
    arr.push(pick);
    picksByUser.set(userId, arr);
  }

  // Build summaries (without grade yet)
  const summariesRaw: Array<{ userId: string; summary: Omit<ManagerDraftSummary, 'grade' | 'gradeColor' | 'surplusPercentile' | 'leagueRank'> }> = [];

  for (const [userId, picks] of picksByUser) {
    if (picks.length === 0) continue;
    const info = allUserInfo.get(userId) ?? { displayName: userId, avatar: null };

    const totalWAR = picks.reduce((s, p) => s + p.war, 0);
    const totalSurplus = picks.reduce((s, p) => s + p.surplus, 0);
    const hitCount = picks.filter((p) => p.hitBust === 'hit').length;
    const bustCount = picks.filter((p) => p.hitBust === 'bust').length;

    const bestPick = picks.reduce<AnalyzedPick | null>((best, p) =>
      best === null || p.surplus > best.surplus ? p : best, null);
    const worstPick = picks.reduce<AnalyzedPick | null>((worst, p) =>
      worst === null || p.surplus < worst.surplus ? p : worst, null);

    // Group by season for draftClasses
    const bySeason = new Map<string, AnalyzedPick[]>();
    for (const pick of picks) {
      const arr = bySeason.get(pick.season) ?? [];
      arr.push(pick);
      bySeason.set(pick.season, arr);
    }

    const draftClasses: DraftClassSeason[] = [...bySeason.entries()]
      .map(([season, sPicks]) => {
        const hits = sPicks.filter((p) => p.hitBust === 'hit').length;
        const busts = sPicks.filter((p) => p.hitBust === 'bust').length;
        return {
          season,
          picks: sPicks,
          avgSurplus: sPicks.reduce((s, p) => s + p.surplus, 0) / sPicks.length,
          hitRate: hits / sPicks.length,
          bustRate: busts / sPicks.length,
          totalWAR: sPicks.reduce((s, p) => s + p.war, 0),
        };
      })
      .sort((a, b) => Number(b.season) - Number(a.season));

    summariesRaw.push({
      userId,
      summary: {
        userId,
        displayName: info.displayName,
        avatar: info.avatar,
        totalWAR,
        totalSurplus,
        avgSurplusPerPick: totalSurplus / picks.length,
        hitRate: hitCount / picks.length,
        bustRate: bustCount / picks.length,
        bestPick,
        worstPick,
        draftClasses,
      },
    });
  }

  // Phase 7: Assign grades by totalSurplus percentile
  const sorted = [...summariesRaw].sort((a, b) => b.summary.totalSurplus - a.summary.totalSurplus);
  const n = sorted.length;

  const managerSummaries = new Map<string, ManagerDraftSummary>();
  const surplusByUserId = new Map<string, number>();

  sorted.forEach((entry, idx) => {
    const leagueRank = idx + 1;
    // Percentile: rank 1 out of n → 100th percentile, rank n → 0th percentile
    const surplusPercentile = n === 1 ? 100 : ((n - idx - 1) / (n - 1)) * 100;
    const { grade, gradeColor } = assignGrade(surplusPercentile);

    const fullSummary: ManagerDraftSummary = {
      ...entry.summary,
      grade,
      gradeColor,
      surplusPercentile,
      leagueRank,
    };

    managerSummaries.set(entry.userId, fullSummary);
    surplusByUserId.set(entry.userId, entry.summary.totalSurplus);
  });

  return { managerSummaries, surplusByUserId, hasData: true };
}
