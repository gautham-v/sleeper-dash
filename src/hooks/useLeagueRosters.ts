'use client';
import { useQuery } from '@tanstack/react-query';
import { sleeperApi } from '../api/sleeper';
import type { LeagueRostersData, LeagueRosterPlayer } from '../types/sleeper';

export function useLeagueRosters(leagueId: string, targetLeagueId?: string) {
  return useQuery({
    queryKey: ['league-rosters', leagueId, targetLeagueId ?? leagueId],
    queryFn: async (): Promise<LeagueRostersData> => {
      // Walk the league chain to build season list
      const leagueChain: { leagueId: string; season: string }[] = [];
      let currentId = leagueId;
      for (let i = 0; i < 10; i++) {
        const league = await sleeperApi.getLeague(currentId);
        leagueChain.push({ leagueId: league.league_id, season: league.season });
        if (!league.previous_league_id || league.previous_league_id === '0') break;
        currentId = league.previous_league_id;
      }
      leagueChain.reverse();

      const seasons = leagueChain.map(l => ({ leagueId: l.leagueId, season: l.season }));
      const currentSeason = leagueChain[leagueChain.length - 1]?.season ?? '';

      // Fetch rosters + users + players for the target season
      const fetchLeagueId = targetLeagueId ?? leagueId;
      const [rosters, users, allPlayers] = await Promise.all([
        sleeperApi.getRosters(fetchLeagueId),
        sleeperApi.getLeagueUsers(fetchLeagueId),
        sleeperApi.getAllPlayers(),
      ]);

      const userMap = new Map(users.map(u => [u.user_id, u]));

      const managers = rosters
        .filter(r => r.owner_id !== null)
        .map(r => {
          const user = userMap.get(r.owner_id!);
          const displayName = user?.display_name ?? r.owner_id ?? 'Unknown';
          const avatar = user?.avatar ?? null;
          const playerIds = r.players ?? [];

          const players: LeagueRosterPlayer[] = playerIds.map(pid => {
            const p = allPlayers[pid];
            return {
              playerId: pid,
              playerName: p ? `${p.first_name} ${p.last_name}`.trim() : pid,
              position: p?.position ?? 'UNK',
              nflTeam: p?.team ?? undefined,
            };
          }).sort((a, b) => {
            const posOrder = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DST'];
            const ai = posOrder.indexOf(a.position);
            const bi = posOrder.indexOf(b.position);
            if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            return a.playerName.localeCompare(b.playerName);
          });

          return { userId: r.owner_id!, displayName, avatar, players };
        });

      return { seasons, managers, currentSeason };
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });
}
