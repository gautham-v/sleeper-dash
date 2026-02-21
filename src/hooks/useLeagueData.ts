import { useQuery } from '@tanstack/react-query';
import { sleeperApi } from '../api/sleeper';
import {
  buildAllMatchups,
  buildStandings,
  calcLuckIndex,
  calcPowerRankings,
  getBlowoutsAndClose,
} from '../utils/calculations';
import type { SleeperLeagueUser, SleeperRoster } from '../types/sleeper';

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
 * Always fetch all REGULAR_SEASON_WEEKS weeks of matchups — don't rely on
 * NFL state's current week, which can be wrong during offseason/new year.
 * Filter out weeks where no team scored (bye weeks / future weeks).
 */
export function useAllMatchups(leagueId: string | null) {
  return useQuery({
    queryKey: ['all-matchups', leagueId],
    queryFn: async () => {
      const weeks = Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => i + 1);
      const results = await Promise.all(
        weeks.map((w) => sleeperApi.getMatchups(leagueId!, w))
      );
      const map = new Map(weeks.map((w, i) => [w, results[i]]));
      const all = buildAllMatchups(map, REGULAR_SEASON_WEEKS);
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

  // Build a player name map from draft picks for use in trade history
  const playerMap = new Map(
    (picksQuery.data ?? []).map((p) => [
      p.player_id,
      {
        name: `${p.metadata.first_name} ${p.metadata.last_name}`,
        position: p.metadata.position,
      },
    ])
  );

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

    if (!allMatchups.data || allMatchups.data.length === 0) {
      return { standings, powerRankings: [], luckIndex: [], blowouts: [], closest: [], rosterMap };
    }

    const powerRankings = calcPowerRankings(allMatchups.data, standings, currentWeek);
    const luckIndex = calcLuckIndex(allMatchups.data, standings);
    const { blowouts, closest } = getBlowoutsAndClose(allMatchups.data, rosterMap);

    return { standings, powerRankings, luckIndex, blowouts, closest, rosterMap };
  })();

  return {
    league: league.data ?? null,
    currentWeek,
    isLoading,
    computed,
    transactions: transactions.data ?? [],
    draftData,
    users: users.data ?? [],
    rosters: rosters.data ?? [],
  };
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
