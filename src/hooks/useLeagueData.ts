import { useQuery } from '@tanstack/react-query';
import { sleeperApi } from '../api/sleeper';
import {
  buildAllMatchups,
  buildStandings,
  calcLuckIndex,
  calcPowerRankings,
  getBlowoutsAndClose,
  pairMatchups,
} from '../utils/calculations';
import type {
  BracketMatch,
  HistoricalSeason,
  LeagueSeasonRecord,
  SeasonTeamRecord,
  SleeperLeagueUser,
  SleeperMatchup,
  SleeperRoster,
} from '../types/sleeper';

const REGULAR_SEASON_WEEKS = 14; // Regular season weeks for matchup calculations
const TOTAL_SEASON_WEEKS = 18;   // Full season (incl. playoffs) for transactions

export function useUser(username: string) {
  return useQuery({
    queryKey: ['user', username],
    queryFn: () => sleeperApi.getUser(username),
    enabled: !!username,
    retry: false,
  });
}

export function useUserLeagues(userId: string | undefined, season: string) {
  return useQuery({
    queryKey: ['leagues', userId, season],
    queryFn: () => sleeperApi.getUserLeagues(userId!, season),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
}

/** Fetch leagues across both 2024 and 2025 seasons combined */
export function useUserLeaguesAllSeasons(userId: string | undefined) {
  const q2024 = useUserLeagues(userId, '2024');
  const q2025 = useUserLeagues(userId, '2025');

  return {
    isLoading: q2024.isLoading || q2025.isLoading,
    data: [...(q2024.data ?? []), ...(q2025.data ?? [])],
  };
}

export function useNFLState() {
  return useQuery({
    queryKey: ['nfl-state'],
    queryFn: sleeperApi.getNFLState,
    staleTime: 1000 * 60 * 10,
  });
}

export function useLeague(leagueId: string | null) {
  return useQuery({
    queryKey: ['league', leagueId],
    queryFn: () => sleeperApi.getLeague(leagueId!),
    enabled: !!leagueId,
  });
}

export function useRosters(leagueId: string | null) {
  return useQuery({
    queryKey: ['rosters', leagueId],
    queryFn: () => sleeperApi.getRosters(leagueId!),
    enabled: !!leagueId,
  });
}

export function useLeagueUsers(leagueId: string | null) {
  return useQuery({
    queryKey: ['league-users', leagueId],
    queryFn: () => sleeperApi.getLeagueUsers(leagueId!),
    enabled: !!leagueId,
  });
}

/**
 * Fetch all matchups for the season including playoffs.
 * Determines playoff_week_start from the league settings to tag games correctly.
 * Filters out weeks where no team scored (bye weeks / future weeks).
 */
export function useAllMatchups(leagueId: string | null) {
  return useQuery({
    queryKey: ['all-matchups', leagueId],
    queryFn: async () => {
      const league = await sleeperApi.getLeague(leagueId!);
      const playoffStart = league.settings.playoff_week_start || 15;
      const weeks = Array.from({ length: TOTAL_SEASON_WEEKS }, (_, i) => i + 1);
      const results = await Promise.all(
        weeks.map((w) => sleeperApi.getMatchups(leagueId!, w))
      );
      const map = new Map(weeks.map((w, i) => [w, results[i]]));
      const all = buildAllMatchups(map, playoffStart - 1);
      // Filter out weeks where no scores exist yet (future weeks)
      return all.filter((m) => m.team1.points > 0 || m.team2.points > 0);
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch transactions for all weeks including playoffs.
 */
export function useAllTransactions(leagueId: string | null) {
  return useQuery({
    queryKey: ['transactions', leagueId],
    queryFn: async () => {
      const weeks = Array.from({ length: TOTAL_SEASON_WEEKS }, (_, i) => i + 1);
      const results = await Promise.all(
        weeks.map((w) => sleeperApi.getTransactions(leagueId!, w))
      );
      return results.flat();
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch all NFL players once (large payload, cached for 24 hours).
 * Used as a fallback to resolve player names for non-drafted players (waiver/FA pickups).
 */
export function useAllPlayers() {
  return useQuery({
    queryKey: ['all-players'],
    queryFn: sleeperApi.getAllPlayers,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });
}

export function useDraftData(leagueId: string | null) {
  const draftsQuery = useQuery({
    queryKey: ['drafts', leagueId],
    queryFn: () => sleeperApi.getDrafts(leagueId!),
    enabled: !!leagueId,
  });

  const draftId = draftsQuery.data?.[0]?.draft_id ?? null;

  const picksQuery = useQuery({
    queryKey: ['draft-picks', draftId],
    queryFn: () => sleeperApi.getDraftPicks(draftId!),
    enabled: !!draftId,
  });

  const allPlayersQuery = useAllPlayers();

  // Build a player name map: start with all NFL players as a base, then
  // override with draft pick metadata (which has current-season accuracy).
  const playerMap = new Map<string, { name: string; position: string }>();

  for (const [id, p] of Object.entries(allPlayersQuery.data ?? {})) {
    if (p.first_name && p.last_name && p.position) {
      playerMap.set(id, {
        name: `${p.first_name} ${p.last_name}`,
        position: p.position,
      });
    }
  }

  for (const p of picksQuery.data ?? []) {
    playerMap.set(p.player_id, {
      name: `${p.metadata.first_name} ${p.metadata.last_name}`,
      position: p.metadata.position,
    });
  }

  return {
    draft: draftsQuery.data?.[0] ?? null,
    picks: picksQuery.data ?? [],
    playerMap,
    isLoading: draftsQuery.isLoading || picksQuery.isLoading,
  };
}

/** Build a user/roster map for display */
export function buildUserMap(users: SleeperLeagueUser[], rosters: SleeperRoster[]) {
  const userMap = new Map(
    users.map((u) => [
      u.user_id,
      {
        displayName: u.display_name,
        teamName: u.metadata?.team_name ?? u.display_name,
        avatar: u.avatar,
      },
    ])
  );
  const rosterMap = new Map(
    rosters.map((r) => {
      const userId = r.owner_id ?? '';
      return [
        r.roster_id,
        {
          teamName: userMap.get(userId)?.teamName ?? `Team ${r.roster_id}`,
          displayName: userMap.get(userId)?.displayName ?? `Team ${r.roster_id}`,
          userId,
        },
      ];
    })
  );
  return { userMap, rosterMap };
}

/** Combined computed hook for dashboard data */
export function useDashboardData(leagueId: string | null) {
  const nflState = useNFLState();
  const league = useLeague(leagueId);
  const rosters = useRosters(leagueId);
  const users = useLeagueUsers(leagueId);
  const allMatchups = useAllMatchups(leagueId);
  const transactions = useAllTransactions(leagueId);
  const draftData = useDraftData(leagueId);
  const bracket = useQuery({
    queryKey: ['winners-bracket', leagueId],
    queryFn: () => sleeperApi.getWinnersBracket(leagueId!),
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 30,
  });

  const isLoading =
    league.isLoading ||
    rosters.isLoading ||
    users.isLoading ||
    allMatchups.isLoading;

  // Derive the display week: prefer league's current week, fall back to NFL state
  const currentWeek = (() => {
    const leagueStatus = league.data?.status;
    if (leagueStatus === 'complete' || leagueStatus === 'post_season') {
      return league.data?.settings.playoff_week_start
        ? league.data.settings.playoff_week_start - 1
        : REGULAR_SEASON_WEEKS;
    }
    return nflState.data?.week ?? 0;
  })();

  const computed = (() => {
    if (!rosters.data || !users.data) return null;

    const { userMap, rosterMap } = buildUserMap(users.data, rosters.data);
    const standings = buildStandings(rosters.data, userMap);

    // Determine champion from winners bracket
    const typedBracket = (bracket.data ?? []) as BracketMatch[];
    let champion: { teamName: string; displayName: string; avatar: string | null } | null = null;
    if (typedBracket.length > 0) {
      let finalMatch = typedBracket.find((b) => b.p === 1);
      if (!finalMatch) {
        const maxRound = Math.max(...typedBracket.map((b) => b.r));
        finalMatch = typedBracket.find((b) => b.r === maxRound);
      }
      if (finalMatch?.w != null) {
        const rosterInfo = rosterMap.get(finalMatch.w);
        if (rosterInfo) {
          champion = {
            teamName: rosterInfo.teamName,
            displayName: rosterInfo.displayName,
            avatar: userMap.get(rosterInfo.userId)?.avatar ?? null,
          };
        }
      }
    }

    if (!allMatchups.data || allMatchups.data.length === 0) {
      return { standings, powerRankings: [], luckIndex: [], blowouts: [], closest: [], rosterMap, champion };
    }

    // Compute playoff win/loss records per roster
    const playoffMatchups = allMatchups.data.filter((m) => m.isPlayoff);
    const playoffRecordsMap = new Map<number, { wins: number; losses: number }>();
    for (const m of playoffMatchups) {
      if (m.team1.points === 0 && m.team2.points === 0) continue;
      const [winner, loser] = m.team1.points >= m.team2.points ? [m.team1, m.team2] : [m.team2, m.team1];
      const wRec = playoffRecordsMap.get(winner.rosterId) ?? { wins: 0, losses: 0 };
      wRec.wins++;
      playoffRecordsMap.set(winner.rosterId, wRec);
      const lRec = playoffRecordsMap.get(loser.rosterId) ?? { wins: 0, losses: 0 };
      lRec.losses++;
      playoffRecordsMap.set(loser.rosterId, lRec);
    }

    const standingsWithPlayoff = standings.map((s) => ({
      ...s,
      playoffWins: playoffRecordsMap.get(s.rosterId)?.wins,
      playoffLosses: playoffRecordsMap.get(s.rosterId)?.losses,
    }));

    const regularMatchups = allMatchups.data.filter((m) => !m.isPlayoff);
    const powerRankings = calcPowerRankings(regularMatchups, standingsWithPlayoff, currentWeek);
    const luckIndex = calcLuckIndex(regularMatchups, standingsWithPlayoff);
    const { blowouts, closest } = getBlowoutsAndClose(allMatchups.data, rosterMap);

    return { standings: standingsWithPlayoff, powerRankings, luckIndex, blowouts, closest, rosterMap, champion };
  })();

  const isOffseason = league.data?.status === 'complete';

  return {
    league: league.data ?? null,
    currentWeek,
    isOffseason,
    isLoading,
    computed,
    transactions: transactions.data ?? [],
    draftData,
    users: users.data ?? [],
    rosters: rosters.data ?? [],
  };
}

/**
 * League Records Book: for each season in the chain, compute champion, last place,
 * highest/lowest scoring team, biggest blowout, and highest/lowest weekly score.
 */
export function useLeagueRecords(leagueId: string | null) {
  return useQuery({
    queryKey: ['league-records', leagueId],
    queryFn: async () => {
      // Walk the previous_league_id chain
      const leagueChain: { league_id: string; season: string; playoff_week_start: number }[] = [];
      let currentId = leagueId!;

      for (let i = 0; i < 10; i++) {
        const league = await sleeperApi.getLeague(currentId);
        leagueChain.push({
          league_id: league.league_id,
          season: league.season,
          playoff_week_start: league.settings.playoff_week_start || 15,
        });
        if (!league.previous_league_id) break;
        currentId = league.previous_league_id;
      }

      leagueChain.reverse(); // oldest first

      const records: LeagueSeasonRecord[] = [];

      for (const { league_id, season, playoff_week_start } of leagueChain) {
        const [rosters, users, bracket] = await Promise.all([
          sleeperApi.getRosters(league_id),
          sleeperApi.getLeagueUsers(league_id),
          sleeperApi.getWinnersBracket(league_id),
        ]);

        // Build lookup: rosterId → display info + record
        const userMap = new Map(users.map((u) => [u.user_id, u]));
        const rosterInfoMap = new Map<number, SeasonTeamRecord>(
          rosters.map((r) => {
            const u = r.owner_id ? userMap.get(r.owner_id) : undefined;
            return [
              r.roster_id,
              {
                displayName: u?.display_name ?? `Team ${r.roster_id}`,
                teamName: u?.metadata?.team_name ?? u?.display_name ?? `Team ${r.roster_id}`,
                wins: r.settings.wins,
                losses: r.settings.losses,
                pointsFor: r.settings.fpts + (r.settings.fpts_decimal ?? 0) / 100,
              },
            ];
          })
        );

        // Champion: winner of the championship match (p=1)
        const typedBracket = bracket as BracketMatch[];
        let champion: SeasonTeamRecord | null = null;
        if (typedBracket.length > 0) {
          // In Sleeper, the championship match typically has p: 1
          let finalMatch = typedBracket.find((b) => b.p === 1);
          
          if (!finalMatch) {
            // Fallback: find the match in the final round
            const maxRound = Math.max(...typedBracket.map((b) => b.r));
            // In absence of p: 1, the championship is usually the first match returned for the final round, or we can just find any in the max round.
            finalMatch = typedBracket.find((b) => b.r === maxRound);
          }
          
          if (finalMatch?.w != null) {
            champion = rosterInfoMap.get(finalMatch.w) ?? null;
          }
        }

        // Last place: fewest wins, then fewest points
        const sortedWorst = [...rosters]
          .filter((r) => r.owner_id)
          .sort((a, b) => {
            if (a.settings.wins !== b.settings.wins) return a.settings.wins - b.settings.wins;
            const ptA = a.settings.fpts + (a.settings.fpts_decimal ?? 0) / 100;
            const ptB = b.settings.fpts + (b.settings.fpts_decimal ?? 0) / 100;
            return ptA - ptB;
          });
        const lastPlace = sortedWorst.length > 0
          ? rosterInfoMap.get(sortedWorst[0].roster_id) ?? null
          : null;

        // Highest / lowest scoring team by total season points
        const sortedByPoints = [...rosters]
          .filter((r) => r.owner_id)
          .sort((a, b) => {
            const ptA = a.settings.fpts + (a.settings.fpts_decimal ?? 0) / 100;
            const ptB = b.settings.fpts + (b.settings.fpts_decimal ?? 0) / 100;
            return ptB - ptA;
          });
        const highestScoringTeam = sortedByPoints.length > 0
          ? rosterInfoMap.get(sortedByPoints[0].roster_id) ?? null
          : null;
        const lowestScoringTeam = sortedByPoints.length > 0
          ? rosterInfoMap.get(sortedByPoints[sortedByPoints.length - 1].roster_id) ?? null
          : null;

        // Fetch all matchups including postseason
        const weekNums = Array.from({ length: TOTAL_SEASON_WEEKS }, (_, i) => i + 1);
        const weeklyData = await Promise.all(
          weekNums.map((w) => sleeperApi.getMatchups(league_id, w))
        );

        // Compute blowout, high/low weekly scores (including postseason)
        let biggestBlowout: LeagueSeasonRecord['biggestBlowout'] = null;
        let highestWeeklyScore: LeagueSeasonRecord['highestWeeklyScore'] = null;
        let lowestWeeklyScore: LeagueSeasonRecord['lowestWeeklyScore'] = null;

        for (let wi = 0; wi < weekNums.length; wi++) {
          const week = weekNums[wi];
          const isPlayoff = week >= playoff_week_start;
          const matchups: SleeperMatchup[] = weeklyData[wi];

          const byMatchupId = new Map<number, SleeperMatchup[]>();
          for (const m of matchups) {
            const arr = byMatchupId.get(m.matchup_id) ?? [];
            arr.push(m);
            byMatchupId.set(m.matchup_id, arr);
          }

          for (const [, pair] of byMatchupId) {
            if (pair.length !== 2) continue;
            const [a, b] = pair;
            const aPts = a.points ?? 0;
            const bPts = b.points ?? 0;
            if (aPts === 0 && bPts === 0) continue;

            const margin = Math.abs(aPts - bPts);
            const [winner, loser, winnerPts, loserPts] =
              aPts >= bPts ? [a, b, aPts, bPts] : [b, a, bPts, aPts];

            if (!biggestBlowout || margin > biggestBlowout.margin) {
              biggestBlowout = {
                week,
                winnerName: rosterInfoMap.get(winner.roster_id)?.teamName ?? `Team ${winner.roster_id}`,
                loserName: rosterInfoMap.get(loser.roster_id)?.teamName ?? `Team ${loser.roster_id}`,
                winnerPts,
                loserPts,
                margin: Math.round(margin * 100) / 100,
                isPlayoff,
              };
            }

            for (const [rosterId, pts] of [[a.roster_id, aPts], [b.roster_id, bPts]] as [number, number][]) {
              if (pts === 0) continue;
              const teamName = rosterInfoMap.get(rosterId)?.teamName ?? `Team ${rosterId}`;
              if (!highestWeeklyScore || pts > highestWeeklyScore.points) {
                highestWeeklyScore = { week, teamName, points: pts, isPlayoff };
              }
              if (!lowestWeeklyScore || pts < lowestWeeklyScore.points) {
                lowestWeeklyScore = { week, teamName, points: pts, isPlayoff };
              }
            }
          }
        }

        records.push({
          season,
          champion,
          lastPlace,
          highestScoringTeam,
          lowestScoringTeam,
          biggestBlowout,
          highestWeeklyScore,
          lowestWeeklyScore,
        });
      }

      return records.reverse(); // newest season first
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 30,
  });
}

/**
 * Full historical data for team comparison: walks the previous_league_id chain
 * and fetches rosters, users, and matchups for every season.
 */
export function useLeagueHistory(leagueId: string | null) {
  return useQuery({
    queryKey: ['league-history', leagueId],
    queryFn: async () => {
      // Walk the chain (oldest → newest)
      const leagueChain: { league_id: string; season: string; playoff_week_start: number }[] = [];
      let currentId = leagueId!;
      for (let i = 0; i < 8; i++) {
        const league = await sleeperApi.getLeague(currentId);
        leagueChain.push({
          league_id: league.league_id,
          season: league.season,
          playoff_week_start: league.settings.playoff_week_start || 15,
        });
        if (!league.previous_league_id) break;
        currentId = league.previous_league_id;
      }
      leagueChain.reverse();

      const seasons: HistoricalSeason[] = [];

      for (const { league_id, season, playoff_week_start } of leagueChain) {
        const weekNums = Array.from({ length: TOTAL_SEASON_WEEKS }, (_, i) => i + 1);
        const [rosters, users, bracket, ...weekMatchupResults] = await Promise.all([
          sleeperApi.getRosters(league_id),
          sleeperApi.getLeagueUsers(league_id),
          sleeperApi.getWinnersBracket(league_id),
          ...weekNums.map((w) => sleeperApi.getMatchups(league_id, w)),
        ]);

        const userMap = new Map(users.map((u) => [u.user_id, u]));
        const sorted = [...rosters].sort(
          (a, b) => b.settings.wins - a.settings.wins || b.settings.fpts - a.settings.fpts,
        );

        const teamsMap = new Map<string, {
          userId: string; rosterId: number; displayName: string; avatar: string | null;
          wins: number; losses: number; pointsFor: number; rank: number;
        }>();
        const rosterToUser = new Map<number, string>();

        sorted.forEach((r, idx) => {
          if (!r.owner_id) return;
          const u = userMap.get(r.owner_id);
          rosterToUser.set(r.roster_id, r.owner_id);
          teamsMap.set(r.owner_id, {
            userId: r.owner_id,
            rosterId: r.roster_id,
            displayName: u?.display_name ?? `Team ${r.roster_id}`,
            avatar: u?.avatar ?? null,
            wins: r.settings.wins,
            losses: r.settings.losses,
            pointsFor: r.settings.fpts + (r.settings.fpts_decimal ?? 0) / 100,
            rank: idx + 1,
          });
        });

        const allMatchups = weekNums.flatMap((week, idx) =>
          pairMatchups(weekMatchupResults[idx], week, week >= playoff_week_start).filter(
            (m) => m.team1.points > 0 || m.team2.points > 0,
          ),
        );

        const typedBracket = bracket as BracketMatch[];
        let championUserId: string | null = null;
        if (typedBracket && typedBracket.length > 0) {
          let finalMatch = typedBracket.find((b) => b.p === 1);
          if (!finalMatch) {
            const maxRound = Math.max(...typedBracket.map((b) => b.r));
            finalMatch = typedBracket.find((b) => b.r === maxRound);
          }
          if (finalMatch?.w != null) {
            championUserId = rosterToUser.get(finalMatch.w) ?? null;
          }
        }

        seasons.push({
          season,
          leagueId: league_id,
          teams: teamsMap,
          matchups: allMatchups,
          rosterToUser,
          championUserId,
        });
      }

      return seasons;
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 30,
  });
}

/**
 * Year Over Year: follows the league's `previous_league_id` chain to get
 * the true history of THIS specific league across seasons.
 */
export function useYearOverYear(leagueId: string | null) {
  return useQuery({
    queryKey: ['year-over-year', leagueId],
    queryFn: async () => {
      // Step 1: Walk the previous_league_id chain to find all seasons
      const leagueChain: { league_id: string; season: string }[] = [];
      let currentId = leagueId!;

      for (let i = 0; i < 8; i++) {
        const league = await sleeperApi.getLeague(currentId);
        leagueChain.push({ league_id: league.league_id, season: league.season });
        if (!league.previous_league_id) break;
        currentId = league.previous_league_id;
      }

      leagueChain.reverse(); // oldest first

      if (leagueChain.length < 2) return [];

      // Step 2: Fetch rosters + users for each season
      const result = new Map<
        string,
        {
          displayName: string;
          seasons: { season: string; wins: number; losses: number; pointsFor: number; rank: number }[];
        }
      >();

      for (const { league_id, season } of leagueChain) {
        const [rosters, users] = await Promise.all([
          sleeperApi.getRosters(league_id),
          sleeperApi.getLeagueUsers(league_id),
        ]);

        const userMap = new Map(users.map((u) => [u.user_id, u]));
        const sorted = [...rosters].sort(
          (a, b) => b.settings.wins - a.settings.wins || b.settings.fpts - a.settings.fpts
        );

        sorted.forEach((r, idx) => {
          if (!r.owner_id) return;
          const u = userMap.get(r.owner_id);
          const name = u?.display_name ?? `Team ${r.roster_id}`;
          const entry = result.get(r.owner_id) ?? { displayName: name, seasons: [] };
          entry.seasons.push({
            season,
            wins: r.settings.wins,
            losses: r.settings.losses,
            pointsFor: r.settings.fpts + (r.settings.fpts_decimal ?? 0) / 100,
            rank: idx + 1,
          });
          result.set(r.owner_id, entry);
        });
      }

      return Array.from(result.values()).filter((e) => e.seasons.length >= 2);
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 30,
  });
}

export interface CrossLeagueUserStats {
  totalWins: number;
  totalLosses: number;
  playoffWins: number;
  playoffLosses: number;
  titles: number;
  totalSeasons: number;
  avgPointsFor: number;
}

/**
 * Aggregates a user's stats across all their leagues by walking each root
 * league's previous_league_id chain and summing wins, losses, championships,
 * playoff records, and points.
 */
export function useCrossLeagueStats(userId: string | undefined, rootLeagueIds: string[]) {
  const stableKey = [...rootLeagueIds].sort().join(',');
  return useQuery({
    queryKey: ['cross-league-stats', userId, stableKey],
    queryFn: async (): Promise<CrossLeagueUserStats | null> => {
      if (!userId || rootLeagueIds.length === 0) return null;

      // Walk each root league's chain to collect all seasons
      const allSeasons: { league_id: string; playoff_week_start: number }[] = [];
      const visitedIds = new Set<string>();

      for (const rootId of rootLeagueIds) {
        let currentId = rootId;
        for (let i = 0; i < 10; i++) {
          if (visitedIds.has(currentId)) break;
          visitedIds.add(currentId);
          const lg = await sleeperApi.getLeague(currentId);
          allSeasons.push({ league_id: lg.league_id, playoff_week_start: lg.settings.playoff_week_start || 15 });
          if (!lg.previous_league_id) break;
          currentId = lg.previous_league_id;
        }
      }

      // Fetch per-season data in parallel
      const seasonResults = await Promise.all(
        allSeasons.map(async ({ league_id, playoff_week_start }) => {
          const [rosters, , bracket] = await Promise.all([
            sleeperApi.getRosters(league_id),
            sleeperApi.getLeagueUsers(league_id),
            sleeperApi.getWinnersBracket(league_id),
          ]);

          const userRoster = rosters.find((r) => r.owner_id === userId);
          if (!userRoster) return null;

          // Determine champion from winners bracket
          const rosterToUser = new Map(rosters.filter((r) => r.owner_id).map((r) => [r.roster_id, r.owner_id!]));
          const typedBracket = bracket as BracketMatch[];
          let championUserId: string | null = null;
          if (typedBracket.length > 0) {
            let finalMatch = typedBracket.find((b) => b.p === 1);
            if (!finalMatch) {
              const maxRound = Math.max(...typedBracket.map((b) => b.r));
              finalMatch = typedBracket.find((b) => b.r === maxRound);
            }
            if (finalMatch?.w != null) championUserId = rosterToUser.get(finalMatch.w) ?? null;
          }

          // Fetch only playoff weeks for playoff record calculation
          const playoffWeeks = Array.from(
            { length: TOTAL_SEASON_WEEKS - playoff_week_start + 1 },
            (_, i) => playoff_week_start + i,
          );
          const playoffData = await Promise.all(playoffWeeks.map((w) => sleeperApi.getMatchups(league_id, w)));

          let pWins = 0;
          let pLosses = 0;
          const userRosterId = userRoster.roster_id;
          for (const weekMatchups of playoffData) {
            const byMatchupId = new Map<number, SleeperMatchup[]>();
            for (const m of weekMatchups) {
              const arr = byMatchupId.get(m.matchup_id) ?? [];
              arr.push(m);
              byMatchupId.set(m.matchup_id, arr);
            }
            for (const [, pair] of byMatchupId) {
              if (pair.length !== 2) continue;
              const [a, b] = pair;
              const isA = a.roster_id === userRosterId;
              const isB = b.roster_id === userRosterId;
              if (!isA && !isB) continue;
              const uPts = isA ? (a.points ?? 0) : (b.points ?? 0);
              const oPts = isA ? (b.points ?? 0) : (a.points ?? 0);
              if (uPts === 0 && oPts === 0) continue;
              if (uPts >= oPts) pWins++; else pLosses++;
            }
          }

          return {
            wins: userRoster.settings.wins,
            losses: userRoster.settings.losses,
            pointsFor: userRoster.settings.fpts + (userRoster.settings.fpts_decimal ?? 0) / 100,
            isChampion: championUserId === userId,
            playoffWins: pWins,
            playoffLosses: pLosses,
          };
        }),
      );

      let totalWins = 0, totalLosses = 0, playoffWins = 0, playoffLosses = 0;
      let titles = 0, totalSeasons = 0, totalPointsFor = 0;

      for (const r of seasonResults) {
        if (!r) continue;
        totalWins += r.wins;
        totalLosses += r.losses;
        totalPointsFor += r.pointsFor;
        if (r.isChampion) titles++;
        playoffWins += r.playoffWins;
        playoffLosses += r.playoffLosses;
        totalSeasons++;
      }

      if (totalSeasons === 0) return null;

      return { totalWins, totalLosses, playoffWins, playoffLosses, titles, totalSeasons, avgPointsFor: totalPointsFor / totalSeasons };
    },
    enabled: !!userId && rootLeagueIds.length > 0,
    staleTime: 1000 * 60 * 30,
  });
}
