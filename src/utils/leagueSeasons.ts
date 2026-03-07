import { sleeperApi } from '@/api/sleeper';
import type { SleeperLeague } from '@/types/sleeper';

export type LeagueGroup = [string, SleeperLeague[]];

export async function fetchUserLeaguesGrouped(userId: string): Promise<LeagueGroup[]> {
  const state = await sleeperApi.getNFLState();
  const seasons = [state.season, state.previous_season];

  const results = await Promise.all(
    seasons.map((s) => sleeperApi.getUserLeagues(userId, s).catch(() => [] as SleeperLeague[])),
  );

  const allLeagues = results.flat();
  if (allLeagues.length === 0) throw new Error('No leagues found for this user');

  const grouped = allLeagues.reduce<Record<string, SleeperLeague[]>>((acc, l) => {
    (acc[l.name] ??= []).push(l);
    return acc;
  }, {});

  return Object.entries(grouped).sort(([, a], [, b]) => {
    const maxA = Math.max(...a.map((l) => Number(l.season)));
    const maxB = Math.max(...b.map((l) => Number(l.season)));
    return maxB - maxA;
  });
}
