import type {
  SleeperUser,
  SleeperLeague,
  SleeperRoster,
  SleeperLeagueUser,
  SleeperMatchup,
  SleeperTransaction,
  SleeperDraft,
  SleeperDraftPick,
  SleeperNFLState,
  SleeperPlayer,
  FutureDraftPick,
} from '../types/sleeper';

const BASE_URL = 'https://api.sleeper.app/v1';

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sleeper API error: ${res.status} ${url}`);
  return res.json();
}

export const sleeperApi = {
  getUser: (username: string) =>
    fetchJSON<SleeperUser>(`${BASE_URL}/user/${username}`),

  getUserLeagues: (userId: string, season: string) =>
    fetchJSON<SleeperLeague[]>(`${BASE_URL}/user/${userId}/leagues/nfl/${season}`),

  getLeague: (leagueId: string) =>
    fetchJSON<SleeperLeague>(`${BASE_URL}/league/${leagueId}`),

  getRosters: (leagueId: string) =>
    fetchJSON<SleeperRoster[]>(`${BASE_URL}/league/${leagueId}/rosters`),

  getLeagueUsers: (leagueId: string) =>
    fetchJSON<SleeperLeagueUser[]>(`${BASE_URL}/league/${leagueId}/users`),

  getMatchups: (leagueId: string, week: number) =>
    fetchJSON<SleeperMatchup[]>(`${BASE_URL}/league/${leagueId}/matchups/${week}`),

  getTransactions: (leagueId: string, week: number) =>
    fetchJSON<SleeperTransaction[]>(`${BASE_URL}/league/${leagueId}/transactions/${week}`),

  getDrafts: (leagueId: string) =>
    fetchJSON<SleeperDraft[]>(`${BASE_URL}/league/${leagueId}/drafts`),

  getDraftPicks: (draftId: string) =>
    fetchJSON<SleeperDraftPick[]>(`${BASE_URL}/draft/${draftId}/picks`),

  getNFLState: () =>
    fetchJSON<SleeperNFLState>(`${BASE_URL}/state/nfl`),

  getWinnersBracket: (leagueId: string) =>
    fetchJSON<unknown[]>(`${BASE_URL}/league/${leagueId}/winners_bracket`),

  getAllPlayers: () =>
    fetchJSON<Record<string, SleeperPlayer>>(`${BASE_URL}/players/nfl`),

  getTradedPicks: (leagueId: string) =>
    fetchJSON<FutureDraftPick[]>(`${BASE_URL}/league/${leagueId}/traded_picks`),

  getPlayerWeeklyStats: (season: string, week: number) =>
    fetchJSON<Record<string, Record<string, number>>>(
      `${BASE_URL}/stats/nfl/regular/${season}/${week}`
    ),
};
