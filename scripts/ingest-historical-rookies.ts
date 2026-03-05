/**
 * Historical Rookie Ingestion Script
 *
 * Fetches NFL draft capital + Sleeper fantasy stats for all skill-position
 * rookies from 2015-2025 and writes them to the `historical_rookies` table.
 *
 * Run: npx tsx scripts/ingest-historical-rookies.ts
 *
 * Env required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 * Or: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (preferred for scripts)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SLEEPER_BASE = 'https://api.sleeper.app/v1';

const DRAFT_YEAR_START = 2015;
const DRAFT_YEAR_END = 2025;
const SKILL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

// NOTE: Sleeper's all-players endpoint does NOT include draft_round or draft_pick.
// Those fields will need to be backfilled from a separate NFL draft dataset (e.g. PFR).
// Phase 1 populates fantasy production; draft capital will be joined in a follow-up script.
// Weeks per regular season by year
const REGULAR_SEASON_WEEKS: Record<number, number> = {
  2015: 16, 2016: 16, 2017: 16, 2018: 16, 2019: 16,
  2020: 16, 2021: 17, 2022: 17, 2023: 17, 2024: 17, 2025: 17,
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Sleeper player shape (more fields than our app type)
// ---------------------------------------------------------------------------
interface SleeperPlayerFull {
  player_id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  team: string | null;
  age?: number;
  years_exp?: number;
  college?: string;
  birth_date?: string;    // "YYYY-MM-DD"
  metadata?: {
    rookie_year?: string; // e.g. "2020" — the NFL draft year
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJSON<T>(url: string, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      console.warn(`Rate limited, waiting 2s (attempt ${attempt})...`);
      await sleep(2000 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return res.json();
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}

/** Compute PPR fantasy points from a Sleeper weekly stat object */
function computePPR(stats: Record<string, number>): number {
  return (
    (stats.pts_ppr ?? 0) ||               // use pre-computed if available
    (
      (stats.rec ?? 0) * 1 +
      (stats.rec_yd ?? 0) * 0.1 +
      (stats.rec_td ?? 0) * 6 +
      (stats.rush_yd ?? 0) * 0.1 +
      (stats.rush_td ?? 0) * 6 +
      (stats.pass_yd ?? 0) * 0.04 +
      (stats.pass_td ?? 0) * 4 +
      (stats.pass_int ?? 0) * -2 +
      (stats['2pt_rush'] ?? 0) * 2 +
      (stats['2pt_rec'] ?? 0) * 2 +
      (stats['2pt_pass'] ?? 0) * 2 +
      (stats.fum_lost ?? 0) * -2
    )
  );
}

interface SeasonStats {
  ppr: number;
  games: number;
}

/** Fetch and sum all weekly stats for a player in a given season */
async function fetchSeasonStats(
  playerId: string,
  season: number,
  weeklyStatCache: Map<string, Record<string, Record<string, number>>>
): Promise<SeasonStats> {
  const weeks = REGULAR_SEASON_WEEKS[season] ?? 17;
  let totalPPR = 0;
  let gamesPlayed = 0;

  for (let week = 1; week <= weeks; week++) {
    const cacheKey = `${season}-${week}`;
    let weekData = weeklyStatCache.get(cacheKey);

    if (!weekData) {
      try {
        weekData = await fetchJSON<Record<string, Record<string, number>>>(
          `${SLEEPER_BASE}/stats/nfl/regular/${season}/${week}`
        );
        weeklyStatCache.set(cacheKey, weekData);
        // Small delay to avoid hammering the API
        await sleep(150);
      } catch {
        // Week may not exist for partial seasons
        weeklyStatCache.set(cacheKey, {});
        continue;
      }
    }

    const playerStats = weekData[playerId];
    if (playerStats && Object.keys(playerStats).length > 0) {
      const pts = computePPR(playerStats);
      if (pts > 0 || playerStats.gp) {
        totalPPR += pts;
        gamesPlayed += playerStats.gp ?? (pts > 0 ? 1 : 0);
      }
    }
  }

  return { ppr: Math.round(totalPPR * 10) / 10, games: gamesPlayed };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Fetching all Sleeper players...');
  const allPlayers = await fetchJSON<Record<string, SleeperPlayerFull>>(
    `${SLEEPER_BASE}/players/nfl`
  );
  console.log(`Total Sleeper players: ${Object.keys(allPlayers).length}`);

  // Filter to drafted skill players in our range.
  // ONLY use metadata.rookie_year — the years_exp fallback incorrectly includes veterans
  // whose years_exp maps to a year in range (e.g. a 2002 draftee with years_exp=10 → 2015).
  const rookies = Object.values(allPlayers).filter((p) => {
    if (!p.position || !SKILL_POSITIONS.has(p.position)) return false;
    const rookieYear = p.metadata?.rookie_year ? Number(p.metadata.rookie_year) : null;
    if (!rookieYear) return false;
    return rookieYear >= DRAFT_YEAR_START && rookieYear <= DRAFT_YEAR_END;
  });

  console.log(`Eligible rookies (${DRAFT_YEAR_START}-${DRAFT_YEAR_END}): ${rookies.length}`);

  // Shared cache for weekly stats — many players share the same week endpoint
  const weeklyStatCache = new Map<string, Record<string, Record<string, number>>>();

  let processed = 0;
  let errors = 0;

  for (const player of rookies) {
    const draftYear = Number(player.metadata!.rookie_year!);
    const name = `${player.first_name} ${player.last_name}`.trim();

    try {
      // Fetch year1, year2, year3 stats in sequence (cache shared across players)
      const [y1, y2, y3] = await Promise.all([
        fetchSeasonStats(player.player_id, draftYear, weeklyStatCache),
        fetchSeasonStats(player.player_id, draftYear + 1, weeklyStatCache),
        fetchSeasonStats(player.player_id, draftYear + 2, weeklyStatCache),
      ]);

      // Calculate breakout age if we have birth_date
      let breakout_age: number | undefined;
      if (player.birth_date && y1.ppr > 0) {
        const born = new Date(player.birth_date);
        const draftDate = new Date(`${draftYear}-05-01`); // approximate
        breakout_age = Math.round((draftDate.getTime() - born.getTime()) / (365.25 * 24 * 3600 * 1000) * 10) / 10;
      }

      const record = {
        player_id: player.player_id,
        name,
        position: player.position!,
        draft_year: draftYear,
        draft_round: null,   // backfill from NFL draft dataset (not in Sleeper all-players)
        draft_pick: null,    // backfill from NFL draft dataset
        nfl_team: player.team ?? null,
        college: player.college ?? null,
        year1_ppr: y1.ppr || null,
        year2_ppr: y2.ppr || null,
        year3_ppr: y3.ppr || null,
        year1_games: y1.games || null,
        year2_games: y2.games || null,
        year3_games: y3.games || null,
        breakout_age: breakout_age ?? null,
        data_sources: ['sleeper'],
      };

      const { error } = await supabase
        .from('historical_rookies')
        .upsert(record, { onConflict: 'player_id' });

      if (error) {
        console.error(`DB error for ${name}:`, error.message);
        errors++;
      } else {
        processed++;
        if (processed % 50 === 0) {
          console.log(`Progress: ${processed}/${rookies.length} (${errors} errors)`);
        }
      }
    } catch (err) {
      console.error(`Error processing ${name} (${player.player_id}):`, err);
      errors++;
    }
  }

  console.log(`\nDone. Processed: ${processed}, Errors: ${errors}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
