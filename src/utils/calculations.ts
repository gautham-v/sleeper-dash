import type {
  SleeperMatchup,
  SleeperRoster,
  TeamStanding,
  WeeklyMatchup,
  PowerRanking,
  LuckEntry,
  BlowoutGame,
  HistoricalSeason,
  TeamAllTimeStats,
  TeamTier,
  H2HRecord,
} from '../types/sleeper';

/** Build paired matchups from a week's flat matchup list */
export function pairMatchups(matchups: SleeperMatchup[], week: number): WeeklyMatchup[] {
  const byMatchupId = new Map<number, SleeperMatchup[]>();
  for (const m of matchups) {
    const arr = byMatchupId.get(m.matchup_id) ?? [];
    arr.push(m);
    byMatchupId.set(m.matchup_id, arr);
  }

  const result: WeeklyMatchup[] = [];
  for (const [matchupId, pair] of byMatchupId) {
    if (pair.length !== 2) continue;
    const [a, b] = pair;
    result.push({
      week,
      matchupId,
      team1: { rosterId: a.roster_id, points: a.points ?? 0 },
      team2: { rosterId: b.roster_id, points: b.points ?? 0 },
      margin: Math.abs((a.points ?? 0) - (b.points ?? 0)),
    });
  }
  return result;
}

/** Build all-season matchup list from per-week results */
export function buildAllMatchups(
  weeklyMatchups: Map<number, SleeperMatchup[]>,
  regularSeasonWeeks: number,
): WeeklyMatchup[] {
  const all: WeeklyMatchup[] = [];
  for (const [week, matchups] of weeklyMatchups) {
    if (week <= regularSeasonWeeks) {
      all.push(...pairMatchups(matchups, week));
    }
  }
  return all;
}

/** Calculate standings from rosters */
export function buildStandings(
  rosters: SleeperRoster[],
  userMap: Map<string, { displayName: string; teamName: string; avatar: string | null }>,
): TeamStanding[] {
  return rosters
    .map((r) => {
      const user = r.owner_id ? userMap.get(r.owner_id) : undefined;
      return {
        rosterId: r.roster_id,
        userId: r.owner_id ?? '',
        teamName: user?.teamName ?? `Team ${r.roster_id}`,
        displayName: user?.displayName ?? `Team ${r.roster_id}`,
        avatar: user?.avatar ?? null,
        wins: r.settings.wins,
        losses: r.settings.losses,
        ties: r.settings.ties,
        pointsFor: r.settings.fpts + (r.settings.fpts_decimal ?? 0) / 100,
        pointsAgainst: r.settings.fpts_against + (r.settings.fpts_against_decimal ?? 0) / 100,
        pointsForDecimal: r.settings.fpts_decimal ?? 0,
        streak: r.metadata?.streak,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor);
}

/** Luck Index: compare actual wins to expected wins (if you played everyone each week) */
export function calcLuckIndex(
  allMatchups: WeeklyMatchup[],
  standings: TeamStanding[],
): LuckEntry[] {
  // Group matchups by week
  const byWeek = new Map<number, WeeklyMatchup[]>();
  for (const m of allMatchups) {
    const arr = byWeek.get(m.week) ?? [];
    arr.push(m);
    byWeek.set(m.week, arr);
  }

  // Collect all scores per week per roster
  const weekScores = new Map<number, Map<number, number>>();
  for (const [week, matchups] of byWeek) {
    const scores = new Map<number, number>();
    for (const m of matchups) {
      scores.set(m.team1.rosterId, m.team1.points);
      scores.set(m.team2.rosterId, m.team2.points);
    }
    weekScores.set(week, scores);
  }

  const expectedWinsMap = new Map<number, number>();

  for (const [, scores] of weekScores) {
    const entries = Array.from(scores.entries());
    for (const [rosterId, pts] of entries) {
      const others = entries.filter(([id]) => id !== rosterId).map(([, p]) => p);
      const wins = others.filter((p) => pts > p).length;
      const ties = others.filter((p) => pts === p).length;
      const expected = wins + ties * 0.5;
      const prev = expectedWinsMap.get(rosterId) ?? 0;
      expectedWinsMap.set(rosterId, prev + expected / others.length);
    }
  }

  return standings.map((s) => {
    const expected = expectedWinsMap.get(s.rosterId) ?? 0;
    return {
      rosterId: s.rosterId,
      teamName: s.teamName,
      displayName: s.displayName,
      avatar: s.avatar,
      actualWins: s.wins,
      expectedWins: Math.round(expected * 10) / 10,
      luckScore: Math.round((s.wins - expected) * 10) / 10,
    };
  }).sort((a, b) => b.luckScore - a.luckScore);
}

/** Power Rankings: weighted score from recent games + overall performance */
export function calcPowerRankings(
  allMatchups: WeeklyMatchup[],
  standings: TeamStanding[],
  currentWeek: number,
): PowerRanking[] {
  const scoreByRoster = new Map<number, number[]>();

  // Sort by week
  const sorted = [...allMatchups].sort((a, b) => a.week - b.week);

  for (const m of sorted) {
    const add = (id: number, pts: number) => {
      const arr = scoreByRoster.get(id) ?? [];
      arr.push(pts);
      scoreByRoster.set(id, arr);
    };
    add(m.team1.rosterId, m.team1.points);
    add(m.team2.rosterId, m.team2.points);
  }

  const recentWeeks = 3;

  const ranked = standings.map((s) => {
    const scores = scoreByRoster.get(s.rosterId) ?? [];
    const recent = scores.slice(-recentWeeks);
    const recentAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
    const seasonAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const totalGames = s.wins + s.losses + s.ties;
    const winPct = totalGames > 0 ? s.wins / totalGames : 0;

    // Weighted score: 50% recent avg, 30% season avg, 20% win %
    const maxPts = 200; // normalize
    const score = (recentAvg / maxPts) * 0.5 + (seasonAvg / maxPts) * 0.3 + winPct * 0.2;

    return {
      rosterId: s.rosterId,
      teamName: s.teamName,
      displayName: s.displayName,
      avatar: s.avatar,
      rank: 0,
      score: Math.round(score * 1000) / 10,
      recentAvg: Math.round(recentAvg * 10) / 10,
      seasonAvg: Math.round(seasonAvg * 10) / 10,
      winPct: Math.round(winPct * 1000) / 10,
      currentWeek,
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  ranked.forEach((r, i) => { r.rank = i + 1; });
  return ranked;
}

/** Biggest blowouts and closest games from all matchups */
export function getBlowoutsAndClose(
  allMatchups: WeeklyMatchup[],
  rosterMap: Map<number, { teamName: string }>,
  count = 5,
): { blowouts: BlowoutGame[]; closest: BlowoutGame[] } {
  const games: BlowoutGame[] = allMatchups.map((m) => {
    const t1pts = m.team1.points;
    const t2pts = m.team2.points;
    const [winner, loser] = t1pts >= t2pts
      ? [m.team1, m.team2]
      : [m.team2, m.team1];
    return {
      week: m.week,
      winner: {
        rosterId: winner.rosterId,
        teamName: rosterMap.get(winner.rosterId)?.teamName ?? `Team ${winner.rosterId}`,
        points: winner.points,
      },
      loser: {
        rosterId: loser.rosterId,
        teamName: rosterMap.get(loser.rosterId)?.teamName ?? `Team ${loser.rosterId}`,
        points: loser.points,
      },
      margin: Math.round(m.margin * 100) / 100,
    };
  }).filter((g) => g.margin > 0);

  const sorted = [...games].sort((a, b) => b.margin - a.margin);
  return {
    blowouts: sorted.slice(0, count),
    closest: sorted.slice(-count).reverse(),
  };
}

export function avatarUrl(avatarId: string | null | undefined): string | null {
  if (!avatarId) return null;
  return `https://sleepercdn.com/avatars/thumbs/${avatarId}`;
}

/** Compute all-time stats for every user across all historical seasons, including tier. */
export function calcAllTimeStats(history: HistoricalSeason[]): Map<string, TeamAllTimeStats> {
  const statsMap = new Map<string, TeamAllTimeStats>();

  for (const season of history) {
    for (const [userId, team] of season.teams) {
      const existing = statsMap.get(userId);
      if (!existing) {
        statsMap.set(userId, {
          userId,
          displayName: team.displayName,
          avatar: team.avatar,
          totalWins: team.wins,
          totalLosses: team.losses,
          totalSeasons: 1,
          titles: userId === season.championUserId ? 1 : 0,
          avgPointsFor: team.pointsFor,
          winPct: 0,
          tier: 'Average',
          seasons: [{ season: season.season, wins: team.wins, losses: team.losses, pointsFor: team.pointsFor, rank: team.rank }],
        });
      } else {
        existing.totalWins += team.wins;
        existing.totalLosses += team.losses;
        existing.totalSeasons += 1;
        existing.titles += userId === season.championUserId ? 1 : 0;
        existing.avgPointsFor += team.pointsFor;
        existing.displayName = team.displayName; // keep most recent name
        existing.seasons.push({ season: season.season, wins: team.wins, losses: team.losses, pointsFor: team.pointsFor, rank: team.rank });
      }
    }
  }

  const allStats = Array.from(statsMap.values());
  for (const s of allStats) {
    const totalGames = s.totalWins + s.totalLosses;
    s.winPct = totalGames > 0 ? s.totalWins / totalGames : 0;
    s.avgPointsFor = s.avgPointsFor / s.totalSeasons;
  }

  // Assign tiers by composite score relative to all teams
  const maxAvgPts = Math.max(...allStats.map((s) => s.avgPointsFor), 1);
  const scored = allStats
    .map((s) => ({
      userId: s.userId,
      score: s.winPct * 0.5 + (s.avgPointsFor / maxAvgPts) * 0.3 + (s.titles / s.totalSeasons) * 0.2,
    }))
    .sort((a, b) => b.score - a.score);

  const n = scored.length;
  scored.forEach((entry, i) => {
    const pct = n > 1 ? i / (n - 1) : 0;
    let tier: TeamTier;
    if (pct < 0.2) tier = 'Elite';
    else if (pct < 0.4) tier = 'Contender';
    else if (pct < 0.6) tier = 'Average';
    else if (pct < 0.8) tier = 'Rebuilding';
    else tier = 'Cellar Dweller';
    statsMap.get(entry.userId)!.tier = tier;
  });

  return statsMap;
}

/** Calculate head-to-head record between two users across all historical seasons. */
export function calcH2H(
  history: HistoricalSeason[],
  userIdA: string,
  userIdB: string,
): H2HRecord {
  const record: H2HRecord = { teamAWins: 0, teamBWins: 0, teamAPoints: 0, teamBPoints: 0, games: [] };

  for (const season of history) {
    const teamA = season.teams.get(userIdA);
    const teamB = season.teams.get(userIdB);
    if (!teamA || !teamB) continue;

    const rosterIdA = teamA.rosterId;
    const rosterIdB = teamB.rosterId;

    for (const matchup of season.matchups) {
      const t1 = matchup.team1;
      const t2 = matchup.team2;

      let aPoints: number, bPoints: number;
      if (t1.rosterId === rosterIdA && t2.rosterId === rosterIdB) {
        aPoints = t1.points;
        bPoints = t2.points;
      } else if (t1.rosterId === rosterIdB && t2.rosterId === rosterIdA) {
        aPoints = t2.points;
        bPoints = t1.points;
      } else {
        continue;
      }

      record.teamAPoints += aPoints;
      record.teamBPoints += bPoints;
      if (aPoints > bPoints) record.teamAWins++;
      else if (bPoints > aPoints) record.teamBWins++;

      record.games.push({
        season: season.season,
        week: matchup.week,
        teamAPoints: Math.round(aPoints * 100) / 100,
        teamBPoints: Math.round(bPoints * 100) / 100,
        winner: aPoints > bPoints ? 'A' : bPoints > aPoints ? 'B' : 'tie',
      });
    }
  }

  record.teamAPoints = Math.round(record.teamAPoints * 100) / 100;
  record.teamBPoints = Math.round(record.teamBPoints * 100) / 100;
  return record;
}
