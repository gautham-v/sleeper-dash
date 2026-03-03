import type { SleeperMatchup, AllTimeWARAnalysis, ManagerAllTimeWAR, AllTimeWARPoint } from '../types/sleeper';

const ROLLING_WINDOW = 17;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export interface SeasonWARInput {
  season: string;
  regularSeasonWeeks: number;        // = playoff_week_start - 1
  userIdByRosterId: Map<number, string>;
  weeklyMatchups: SleeperMatchup[][]; // index 0 = week 1
}

/**
 * Concatenate seasons chronologically and compute:
 *   1. All-time cumulative WAR (continuous, no reset at season boundary)
 *   2. Rolling 17-week WAR (sum of week-over-week deltas over trailing 17 weeks)
 *
 * WAR = team cumulative starter points through week W − league median cumulative starter points
 * Replacement level = league median of team cumulative starter points at each week.
 */
export function computeAllTimeWAR(
  seasons: SeasonWARInput[],
  managerInfo: Map<string, { displayName: string; avatar: string | null }>,
): AllTimeWARAnalysis {
  // Per-manager global accumulation
  const allTimeCumulative = new Map<string, number[]>(); // userId → [cumWAR per global index]
  const seasonBoundaries: { season: string; startIndex: number }[] = [];

  // Global week index across all seasons
  let globalIndex = 0;
  // Per-manager WAR offset carried forward from previous seasons
  const warOffset = new Map<string, number>();

  for (const { season, regularSeasonWeeks, userIdByRosterId, weeklyMatchups } of seasons) {
    const actualWeeks = Math.min(regularSeasonWeeks, weeklyMatchups.length);
    if (actualWeeks === 0) continue;

    seasonBoundaries.push({ season, startIndex: globalIndex });

    // Build cumulative starter points per roster per week
    // cumByRoster[rosterId] = running total of starter points
    const cumByRoster = new Map<number, number>();
    for (const [rosterId] of userIdByRosterId) {
      cumByRoster.set(rosterId, 0);
    }

    // cumHistory[week][rosterId] = cumulative total through that week
    const cumHistory: Map<number, number>[] = [];

    for (let wi = 0; wi < actualWeeks; wi++) {
      const weekMatchups = weeklyMatchups[wi] ?? [];

      for (const matchup of weekMatchups) {
        const rosterId = matchup.roster_id;
        if (!cumByRoster.has(rosterId)) continue; // orphan/unknown roster

        const starters = matchup.starters ?? [];
        const playerPts = matchup.players_points ?? {};
        let starterPoints = 0;
        for (const playerId of starters) {
          starterPoints += playerPts[playerId] ?? 0;
        }
        cumByRoster.set(rosterId, (cumByRoster.get(rosterId) ?? 0) + starterPoints);
      }

      // Snapshot of cumulative totals for this week
      const snapshot = new Map<number, number>(cumByRoster);
      cumHistory.push(snapshot);
    }

    // Compute replacement level per week (median of team cumulative starter points)
    const replacementLevel: number[] = cumHistory.map((snapshot) => {
      const values = [...snapshot.values()];
      return median(values);
    });

    // For each manager, compute WAR = cumulative - replacement, then append to global arrays
    for (const [rosterId, userId] of userIdByRosterId) {
      if (!allTimeCumulative.has(userId)) {
        allTimeCumulative.set(userId, []);
      }
      const userArr = allTimeCumulative.get(userId)!;
      const offset = warOffset.get(userId) ?? 0;

      for (let wi = 0; wi < actualWeeks; wi++) {
        const cum = cumHistory[wi]?.get(rosterId) ?? 0;
        const war = cum - replacementLevel[wi];
        userArr.push(offset + war);
      }

      // Update offset for next season: offset += final WAR of this season
      const lastWAR = (cumHistory[actualWeeks - 1]?.get(rosterId) ?? 0) - replacementLevel[actualWeeks - 1];
      warOffset.set(userId, (warOffset.get(userId) ?? 0) + lastWAR);
    }

    globalIndex += actualWeeks;
  }

  // Compute rolling WAR from cumulative arrays
  // delta[i] = cumWAR[i] - cumWAR[i-1] (delta[0] = cumWAR[0])
  // rolling[i] = sum(delta[max(0,i-ROLLING_WINDOW+1)..i])
  const managerData = new Map<string, ManagerAllTimeWAR>();

  for (const [userId, cumArr] of allTimeCumulative) {
    if (cumArr.length === 0) continue;

    // Compute deltas
    const deltas: number[] = cumArr.map((v, i) => (i === 0 ? v : v - cumArr[i - 1]));

    // Compute rolling using a running sum
    const rollingArr: number[] = [];
    let windowSum = 0;
    for (let i = 0; i < deltas.length; i++) {
      windowSum += deltas[i];
      if (i >= ROLLING_WINDOW) {
        windowSum -= deltas[i - ROLLING_WINDOW];
      }
      rollingArr.push(windowSum);
    }

    // Build AllTimeWARPoint array with season/week metadata
    const points: AllTimeWARPoint[] = [];
    for (const { season, startIndex } of seasonBoundaries) {
      // Find how many weeks this manager has for this season
      const nextBoundary = seasonBoundaries.find((b) => b.startIndex > startIndex)?.startIndex ?? globalIndex;
      const seasonWeeks = nextBoundary - startIndex;

      for (let w = 0; w < seasonWeeks; w++) {
        const globalIdx = startIndex + w;
        if (globalIdx >= cumArr.length) break;

        points.push({
          season,
          week: w + 1,
          allTimeIndex: globalIdx,
          cumulativeWAR: cumArr[globalIdx],
          rollingWAR: rollingArr[globalIdx] ?? 0,
        });
      }
    }

    const info = managerInfo.get(userId);
    managerData.set(userId, {
      userId,
      displayName: info?.displayName ?? userId,
      avatar: info?.avatar ?? null,
      points,
    });
  }

  return {
    managerData,
    seasonBoundaries,
    hasData: managerData.size > 0 && globalIndex > 0,
  };
}
