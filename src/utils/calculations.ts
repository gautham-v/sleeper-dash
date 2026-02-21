import type {
  SleeperMatchup,
  SleeperRoster,
  TeamStanding,
  WeeklyMatchup,
  PowerRanking,
  LuckEntry,
  BlowoutGame,
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
