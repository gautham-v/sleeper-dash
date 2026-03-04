'use client';
import { useQuery } from '@tanstack/react-query';
import { sleeperApi } from '../api/sleeper';
import type { PlayerCareerHistoryResult, PlayerCareerSeason } from '../types/sleeper';
import { THIRTY_MIN_MS, ONE_HOUR_MS } from '@/lib/constants';

export function usePlayerCareerHistory(leagueId: string, playerId: string | null) {
  return useQuery({
    queryKey: ['player-career-history', leagueId, playerId],
    queryFn: async (): Promise<PlayerCareerHistoryResult> => {
      // Walk league chain oldest-first
      const leagueChain: { league_id: string; season: string; playoff_week_start: number }[] = [];
      let currentId = leagueId;
      for (let i = 0; i < 10; i++) {
        const league = await sleeperApi.getLeague(currentId);
        leagueChain.push({
          league_id: league.league_id,
          season: league.season,
          playoff_week_start: league.settings.playoff_week_start ?? 15,
        });
        if (!league.previous_league_id || league.previous_league_id === '0') break;
        currentId = league.previous_league_id;
      }
      leagueChain.reverse();

      // Fetch player info
      const allPlayers = await sleeperApi.getAllPlayers();
      const dbPlayer = allPlayers[playerId!];
      const playerName = dbPlayer ? `${dbPlayer.first_name} ${dbPlayer.last_name}`.trim() : playerId!;
      const position = dbPlayer?.position ?? 'UNK';

      // For each season, find who owned this player and accumulate stats
      const seasons: PlayerCareerSeason[] = [];

      for (const { league_id, season, playoff_week_start } of leagueChain) {
        const regularSeasonWeeks = Math.max(1, playoff_week_start - 1);
        const weekNums = Array.from({ length: regularSeasonWeeks }, (_, i) => i + 1);

        const [rosters, users, ...weekResults] = await Promise.all([
          sleeperApi.getRosters(league_id),
          sleeperApi.getLeagueUsers(league_id),
          ...weekNums.map(w => sleeperApi.getMatchups(league_id, w)),
        ]);

        const userMap = new Map(users.map(u => [u.user_id, u.display_name ?? u.user_id]));

        // Find which roster(s) had this player (track by week)
        // We'll aggregate per-owner within the season
        const ownerStats = new Map<string, { points: number; starts: number; weeks: number; ownerName: string }>();

        for (const weekMatchups of weekResults) {
          for (const matchup of weekMatchups) {
            if (!matchup.players?.includes(playerId!)) continue;
            // Find owner of this roster
            const roster = rosters.find(r => r.roster_id === matchup.roster_id);
            const ownerId = roster?.owner_id ?? String(matchup.roster_id);
            const ownerName = roster?.owner_id ? (userMap.get(roster.owner_id) ?? ownerId) : ownerId;

            if (!ownerStats.has(ownerId)) {
              ownerStats.set(ownerId, { points: 0, starts: 0, weeks: 0, ownerName });
            }
            const stat = ownerStats.get(ownerId)!;
            stat.weeks += 1;

            const starters = new Set(matchup.starters ?? []);
            const pts = matchup.players_points ?? {};
            if (starters.has(playerId!)) {
              stat.starts += 1;
              stat.points += pts[playerId!] ?? 0;
            }
          }
        }

        // For each owner who had this player this season, create a CareerSeason record
        for (const [ownerId, stat] of ownerStats) {
          seasons.push({
            season,
            ownerId,
            ownerName: stat.ownerName,
            starterPoints: Math.round(stat.points * 10) / 10,
            starts: stat.starts,
            weeksOnRoster: stat.weeks,
          });
        }
      }

      // Sort by season ascending
      seasons.sort((a, b) => a.season.localeCompare(b.season));

      // Find startup draft info from the earliest league
      let draftedBy: PlayerCareerHistoryResult['draftedBy'] | undefined;
      try {
        const earliestLeagueId = leagueChain[0]?.league_id;
        if (earliestLeagueId) {
          const drafts = await sleeperApi.getDrafts(earliestLeagueId);
          const [rosters, users] = await Promise.all([
            sleeperApi.getRosters(earliestLeagueId),
            sleeperApi.getLeagueUsers(earliestLeagueId),
          ]);
          const userMap = new Map(users.map(u => [u.user_id, u.display_name ?? u.user_id]));

          // Find the startup draft (type 'snake' with most picks, or largest)
          const startupDraft = drafts.find(d => d.type === 'snake' || d.type === 'linear') ?? drafts[0];
          if (startupDraft) {
            const picks = await sleeperApi.getDraftPicks(startupDraft.draft_id);
            const pick = picks.find(p => p.player_id === playerId);
            if (pick) {
              const roster = rosters.find(r => r.roster_id === pick.roster_id);
              const ownerId = roster?.owner_id ?? '';
              const ownerName = ownerId ? (userMap.get(ownerId) ?? ownerId) : 'Unknown';
              draftedBy = {
                ownerName,
                season: leagueChain[0].season,
                round: pick.round,
                pick: pick.pick_no,
              };
            }
          }
        }
      } catch {
        // Draft info is optional; ignore errors
      }

      return { playerName, position, seasons, draftedBy };
    },
    enabled: !!leagueId && !!playerId,
    staleTime: THIRTY_MIN_MS,
    gcTime: ONE_HOUR_MS,
  });
}
