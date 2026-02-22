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
  AllTimeRecordEntry,
} from '../types/sleeper';

/** Build paired matchups from a week's flat matchup list */
export function pairMatchups(matchups: SleeperMatchup[], week: number, isPlayoff = false): WeeklyMatchup[] {
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
      isPlayoff,
    });
  }
  return result;
}

/** Build all-season matchup list from per-week results, tagging playoff weeks */
export function buildAllMatchups(
  weeklyMatchups: Map<number, SleeperMatchup[]>,
  regularSeasonWeeks: number,
): WeeklyMatchup[] {
  const all: WeeklyMatchup[] = [];
  for (const [week, matchups] of weeklyMatchups) {
    all.push(...pairMatchups(matchups, week, week > regularSeasonWeeks));
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
      isPlayoff: m.isPlayoff,
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
  const record: H2HRecord = { teamAWins: 0, teamBWins: 0, teamAPoints: 0, teamBPoints: 0, playoffAWins: 0, playoffBWins: 0, games: [] };

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
      if (aPoints > bPoints) {
        record.teamAWins++;
        if (matchup.isPlayoff) record.playoffAWins++;
      } else if (bPoints > aPoints) {
        record.teamBWins++;
        if (matchup.isPlayoff) record.playoffBWins++;
      }

      record.games.push({
        season: season.season,
        week: matchup.week,
        teamAPoints: Math.round(aPoints * 100) / 100,
        teamBPoints: Math.round(bPoints * 100) / 100,
        winner: aPoints > bPoints ? 'A' : bPoints > aPoints ? 'B' : 'tie',
        isPlayoff: matchup.isPlayoff,
      });
    }
  }

  record.teamAPoints = Math.round(record.teamAPoints * 100) / 100;
  record.teamBPoints = Math.round(record.teamBPoints * 100) / 100;
  return record;
}

/** Compute all-time records across all historical seasons. */
export function calcAllTimeRecords(history: HistoricalSeason[]): AllTimeRecordEntry[] {
  if (!history || history.length === 0) return [];

  const sortedHistory = [...history].sort((a, b) => Number(a.season) - Number(b.season));

  // Accumulators
  const careerWins = new Map<string, { name: string; avatar: string | null; wins: number }>();
  let highestSeasonPts: { userId: string; name: string; avatar: string | null; pts: number; season: string } | null = null;
  const titlesMap = new Map<string, { name: string; avatar: string | null; count: number; years: string[] }>();
  const lastPlacesMap = new Map<string, { name: string; avatar: string | null; count: number; years: string[] }>();
  let highestWeek: { userId: string; name: string; avatar: string | null; pts: number; season: string; week: number } | null = null;
  let lowestWeek: { userId: string; name: string; avatar: string | null; pts: number; season: string; week: number } | null = null;
  let biggestBlowout: { winnerUserId: string; winnerName: string; winnerAvatar: string | null; loserName: string; margin: number; season: string; week: number } | null = null;
  const blowoutWinsMap = new Map<string, { name: string; avatar: string | null; count: number }>();
  const userInfoMap = new Map<string, { name: string; avatar: string | null }>();
  // Chronological W/L per user for streak computation
  const userResults = new Map<string, ('W' | 'L')[]>();
  // Title drought: which seasons did each user participate in, and which did they win?
  const userSeasonList = new Map<string, string[]>();
  const titleSeasons = new Map<string, string[]>();

  for (const season of sortedHistory) {
    // Update user info (keep most recent name/avatar)
    for (const [userId, team] of season.teams) {
      userInfoMap.set(userId, { name: team.displayName, avatar: team.avatar });
    }

    // Champion
    if (season.championUserId) {
      const champ = season.teams.get(season.championUserId);
      if (champ) {
        const e = titlesMap.get(season.championUserId) ?? { name: champ.displayName, avatar: champ.avatar, count: 0, years: [] };
        e.count++;
        e.years.push(season.season);
        e.name = champ.displayName;
        titlesMap.set(season.championUserId, e);
        const ts = titleSeasons.get(season.championUserId) ?? [];
        ts.push(season.season);
        titleSeasons.set(season.championUserId, ts);
      }
    }

    // Last place: team with highest rank number
    let lpUserId: string | null = null;
    let maxRank = 0;
    for (const [userId, team] of season.teams) {
      if (team.rank > maxRank) { maxRank = team.rank; lpUserId = userId; }
    }
    if (lpUserId) {
      const team = season.teams.get(lpUserId)!;
      const e = lastPlacesMap.get(lpUserId) ?? { name: team.displayName, avatar: team.avatar, count: 0, years: [] };
      e.count++;
      e.years.push(season.season);
      e.name = team.displayName;
      lastPlacesMap.set(lpUserId, e);
    }

    // Career stats + single-season pts
    for (const [userId, team] of season.teams) {
      const cw = careerWins.get(userId) ?? { name: team.displayName, avatar: team.avatar, wins: 0 };
      cw.wins += team.wins;
      cw.name = team.displayName;
      careerWins.set(userId, cw);

      if (!highestSeasonPts || team.pointsFor > highestSeasonPts.pts) {
        highestSeasonPts = { userId, name: team.displayName, avatar: team.avatar, pts: team.pointsFor, season: season.season };
      }

      const sl = userSeasonList.get(userId) ?? [];
      sl.push(season.season);
      userSeasonList.set(userId, sl);
    }

    // Matchup analysis
    const sortedMatchups = [...season.matchups].sort((a, b) => a.week - b.week);
    for (const matchup of sortedMatchups) {
      const { team1, team2 } = matchup;
      if (team1.points === 0 && team2.points === 0) continue;

      const userId1 = season.rosterToUser.get(team1.rosterId);
      const userId2 = season.rosterToUser.get(team2.rosterId);
      if (!userId1 || !userId2) continue;

      const t1 = season.teams.get(userId1);
      const t2 = season.teams.get(userId2);
      const name1 = t1?.displayName ?? `Team ${team1.rosterId}`;
      const name2 = t2?.displayName ?? `Team ${team2.rosterId}`;
      const avatar1 = t1?.avatar ?? null;
      const avatar2 = t2?.avatar ?? null;

      const winnerUserId = team1.points >= team2.points ? userId1 : userId2;
      const loserUserId = team1.points >= team2.points ? userId2 : userId1;
      const winnerName = team1.points >= team2.points ? name1 : name2;
      const loserName = team1.points >= team2.points ? name2 : name1;
      const winnerAvatar = team1.points >= team2.points ? avatar1 : avatar2;

      // Streak tracking
      if (!userResults.has(userId1)) userResults.set(userId1, []);
      if (!userResults.has(userId2)) userResults.set(userId2, []);
      userResults.get(winnerUserId)!.push('W');
      userResults.get(loserUserId)!.push('L');

      // Weekly high/low
      for (const [pts, uid, name, avatar] of [
        [team1.points, userId1, name1, avatar1],
        [team2.points, userId2, name2, avatar2],
      ] as [number, string, string, string | null][]) {
        if (pts > 0) {
          if (!highestWeek || pts > highestWeek.pts) {
            highestWeek = { userId: uid, name, avatar, pts, season: season.season, week: matchup.week };
          }
          if (!lowestWeek || pts < lowestWeek.pts) {
            lowestWeek = { userId: uid, name, avatar, pts, season: season.season, week: matchup.week };
          }
        }
      }

      const margin = Math.abs(team1.points - team2.points);
      if (!biggestBlowout || margin > biggestBlowout.margin) {
        biggestBlowout = { winnerUserId, winnerName, winnerAvatar, loserName, margin, season: season.season, week: matchup.week };
      }

      // Blowout wins (margin > 30)
      if (margin > 30) {
        const bw = blowoutWinsMap.get(winnerUserId) ?? { name: winnerName, avatar: winnerAvatar, count: 0 };
        bw.count++;
        bw.name = winnerName;
        blowoutWinsMap.set(winnerUserId, bw);
      }
    }
  }

  // Compute streaks
  let longestWin: { userId: string; name: string; avatar: string | null; value: number } | null = null;
  let longestLoss: { userId: string; name: string; avatar: string | null; value: number } | null = null;

  for (const [userId, results] of userResults) {
    const info = userInfoMap.get(userId) ?? { name: '', avatar: null };
    let maxW = 0, curW = 0, maxL = 0, curL = 0;
    for (const r of results) {
      if (r === 'W') { curW++; curL = 0; } else { curL++; curW = 0; }
      if (curW > maxW) maxW = curW;
      if (curL > maxL) maxL = curL;
    }
    if (!longestWin || maxW > longestWin.value) longestWin = { userId, name: info.name, avatar: info.avatar, value: maxW };
    if (!longestLoss || maxL > longestLoss.value) longestLoss = { userId, name: info.name, avatar: info.avatar, value: maxL };
  }

  // Title drought
  let longestDrought: { userId: string; name: string; avatar: string | null; value: number } | null = null;
  for (const [userId, seasons] of userSeasonList) {
    const wonSet = new Set(titleSeasons.get(userId) ?? []);
    const sorted = [...seasons].sort((a, b) => Number(a) - Number(b));
    let maxD = 0, curD = 0;
    for (const s of sorted) {
      if (wonSet.has(s)) { curD = 0; } else { curD++; if (curD > maxD) maxD = curD; }
    }
    // Also include trailing drought (current streak without a title)
    maxD = Math.max(maxD, curD);
    const info = userInfoMap.get(userId) ?? { name: '', avatar: null };
    if (!longestDrought || maxD > longestDrought.value) longestDrought = { userId, name: info.name, avatar: info.avatar, value: maxD };
  }

  const records: AllTimeRecordEntry[] = [];

  const topCW = [...careerWins.values()].sort((a, b) => b.wins - a.wins)[0];
  if (topCW) {
    const userId = [...careerWins.entries()].find(([, v]) => v === topCW)?.[0] ?? null;
    records.push({ id: 'career-wins', category: 'Most Career Wins', holderId: userId, holder: topCW.name, avatar: topCW.avatar, value: `${topCW.wins} wins`, rawValue: topCW.wins, context: 'All-time record' });
  }

  if (highestSeasonPts) {
    records.push({ id: 'highest-season-pts', category: 'Highest Single-Season Points', holderId: highestSeasonPts.userId, holder: highestSeasonPts.name, avatar: highestSeasonPts.avatar, value: `${highestSeasonPts.pts.toFixed(1)} pts`, rawValue: highestSeasonPts.pts, context: `${highestSeasonPts.season} Season`, season: highestSeasonPts.season });
  }

  const topTitles = [...titlesMap.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  if (topTitles) {
    const [uid, t] = topTitles;
    records.push({ id: 'most-titles', category: 'Most Championships', holderId: uid, holder: t.name, avatar: t.avatar, value: `${t.count} title${t.count !== 1 ? 's' : ''}`, rawValue: t.count, context: t.years.join(', ') });
  }

  const topLP = [...lastPlacesMap.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  if (topLP) {
    const [uid, lp] = topLP;
    records.push({ id: 'most-last-place', category: 'Most Last-Place Finishes', holderId: uid, holder: lp.name, avatar: lp.avatar, value: `${lp.count} time${lp.count !== 1 ? 's' : ''}`, rawValue: lp.count, context: lp.years.join(', ') });
  }

  if (longestWin) {
    records.push({ id: 'longest-win-streak', category: 'Longest Winning Streak', holderId: longestWin.userId, holder: longestWin.name, avatar: longestWin.avatar, value: `${longestWin.value} straight wins`, rawValue: longestWin.value, context: 'Consecutive wins across seasons' });
  }

  if (longestDrought) {
    records.push({ id: 'title-drought', category: 'Longest Championship Drought', holderId: longestDrought.userId, holder: longestDrought.name, avatar: longestDrought.avatar, value: `${longestDrought.value} season${longestDrought.value !== 1 ? 's' : ''}`, rawValue: longestDrought.value, context: 'Consecutive seasons without a title' });
  }

  if (longestLoss) {
    records.push({ id: 'longest-loss-streak', category: 'Longest Losing Streak', holderId: longestLoss.userId, holder: longestLoss.name, avatar: longestLoss.avatar, value: `${longestLoss.value} straight losses`, rawValue: longestLoss.value, context: 'Consecutive losses across seasons' });
  }

  if (highestWeek) {
    records.push({ id: 'highest-weekly', category: 'Highest Single-Week Score', holderId: highestWeek.userId, holder: highestWeek.name, avatar: highestWeek.avatar, value: `${highestWeek.pts.toFixed(2)} pts`, rawValue: highestWeek.pts, context: `${highestWeek.season} Season, Week ${highestWeek.week}`, season: highestWeek.season, week: highestWeek.week });
  }

  if (lowestWeek) {
    records.push({ id: 'lowest-weekly', category: 'Lowest Single-Week Score', holderId: lowestWeek.userId, holder: lowestWeek.name, avatar: lowestWeek.avatar, value: `${lowestWeek.pts.toFixed(2)} pts`, rawValue: lowestWeek.pts, context: `${lowestWeek.season} Season, Week ${lowestWeek.week}`, season: lowestWeek.season, week: lowestWeek.week });
  }

  if (biggestBlowout) {
    records.push({ id: 'biggest-blowout', category: 'Biggest Blowout in League History', holderId: biggestBlowout.winnerUserId, holder: biggestBlowout.winnerName, avatar: biggestBlowout.winnerAvatar, value: `+${biggestBlowout.margin.toFixed(2)} pts`, rawValue: biggestBlowout.margin, context: `${biggestBlowout.season} Wk ${biggestBlowout.week} · def. ${biggestBlowout.loserName}`, season: biggestBlowout.season, week: biggestBlowout.week });
  }

  const topBW = [...blowoutWinsMap.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  if (topBW) {
    const [uid, bw] = topBW;
    records.push({ id: 'blowout-wins', category: 'Most Career Blowout Wins', holderId: uid, holder: bw.name, avatar: bw.avatar, value: `${bw.count} blowout${bw.count !== 1 ? 's' : ''}`, rawValue: bw.count, context: 'Wins by 30+ points' });
  }

  return records;
}

/** Compute blowouts and closest games across all historical seasons. */
export function calcAllTimeBlowouts(
  history: HistoricalSeason[],
  count = 5,
): { blowouts: BlowoutGame[]; closest: BlowoutGame[] } {
  const games: BlowoutGame[] = [];

  for (const season of history) {
    for (const matchup of season.matchups) {
      const { team1, team2 } = matchup;
      if (team1.points === 0 && team2.points === 0) continue;
      const margin = Math.abs(team1.points - team2.points);
      if (margin === 0) continue;
      const [winner, loser] = team1.points >= team2.points ? [team1, team2] : [team2, team1];
      const winnerId = season.rosterToUser.get(winner.rosterId);
      const loserId = season.rosterToUser.get(loser.rosterId);
      games.push({
        season: season.season,
        week: matchup.week,
        winner: { rosterId: winner.rosterId, teamName: winnerId ? (season.teams.get(winnerId)?.displayName ?? `Team ${winner.rosterId}`) : `Team ${winner.rosterId}`, points: winner.points },
        loser: { rosterId: loser.rosterId, teamName: loserId ? (season.teams.get(loserId)?.displayName ?? `Team ${loser.rosterId}`) : `Team ${loser.rosterId}`, points: loser.points },
        margin: Math.round(margin * 100) / 100,
      });
    }
  }

  const sorted = [...games].sort((a, b) => b.margin - a.margin);
  return { blowouts: sorted.slice(0, count), closest: [...sorted].reverse().slice(0, count) };
}
