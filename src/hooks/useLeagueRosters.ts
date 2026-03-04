'use client';
import { useQuery } from '@tanstack/react-query';
import { sleeperApi } from '../api/sleeper';
import type { LeagueRostersData, LeagueRosterPlayer, FCPlayerEntry } from '../types/sleeper';
import { THIRTY_MIN_MS, ONE_HOUR_MS } from '@/lib/constants';

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

      // Fetch rosters + users + players + dynasty values for the target season
      const fetchLeagueId = targetLeagueId ?? leagueId;
      const [rosters, users, allPlayers, fcMap] = await Promise.all([
        sleeperApi.getRosters(fetchLeagueId),
        sleeperApi.getLeagueUsers(fetchLeagueId),
        sleeperApi.getAllPlayers(),
        (async (): Promise<Map<string, number>> => {
          const map = new Map<string, number>();
          try {
            const res = await fetch('/api/fantasycalc?numQbs=1');
            if (res.ok) {
              const data: FCPlayerEntry[] = await res.json();
              const normalize = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
              for (const entry of data) {
                if (entry.player.sleeperId) {
                  map.set(entry.player.sleeperId, entry.value);
                } else {
                  map.set(`${normalize(entry.player.name)}:${entry.player.position}`, entry.value);
                }
              }
            }
          } catch { /* silently degrade */ }
          return map;
        })(),
      ]);

      const userMap = new Map(users.map(u => [u.user_id, u]));
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();

      const managers = rosters
        .filter(r => r.owner_id !== null)
        .map(r => {
          const user = userMap.get(r.owner_id!);
          const displayName = user?.display_name ?? r.owner_id ?? 'Unknown';
          const avatar = user?.avatar ?? null;
          const playerIds = r.players ?? [];

          const players: LeagueRosterPlayer[] = playerIds.map(pid => {
            const p = allPlayers[pid];
            const name = p ? `${p.first_name} ${p.last_name}`.trim() : pid;
            const position = p?.position ?? 'UNK';
            const dynastyValue = fcMap.get(pid) ?? fcMap.get(`${normalize(name)}:${position}`) ?? null;
            return {
              playerId: pid,
              playerName: name,
              position,
              nflTeam: p?.team ?? undefined,
              dynastyValue,
            };
          }).sort((a, b) => {
            const posOrder = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DST'];
            const ai = posOrder.indexOf(a.position);
            const bi = posOrder.indexOf(b.position);
            if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            // Within same position: dynasty value desc, then alphabetical
            const av = a.dynastyValue ?? -1;
            const bv = b.dynastyValue ?? -1;
            if (av !== bv) return bv - av;
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
