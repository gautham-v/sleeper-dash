/**
 * 2026 Prospect Seeding Script
 *
 * Fetches FantasyCalc dynasty values to identify the incoming rookie class.
 * Works both pre-draft (yoe=0, no team) and post-draft (yoe=0, has team).
 *
 * Pre-draft: prospects appear with yoe=0 and no NFL team.
 * Post-draft: prospects appear with yoe=0 and an NFL team assigned.
 *
 * Run: npx tsx scripts/seed-2026-prospects.ts
 * Env required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
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

const FANTASYCALC_URL =
  'https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=1&numTeams=12&ppr=1';
const SKILL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);
const DRAFT_YEAR = 2026;
const MAX_AGE = 24;
const MIN_VALUE = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FantasyCalcPlayer {
  name: string;
  position: string;
  maybeTeam?: string | null;
  maybeAge?: number | null;
  maybeYoe?: number | null;
  sleeperId?: string | null;
}

interface FantasyCalcEntry {
  player: FantasyCalcPlayer;
  value: number;
  overallRank: number;
  positionRank: number;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Step 1: Fetch FantasyCalc dynasty values
  console.log('Fetching FantasyCalc dynasty values...');
  const fcRes = await fetch(FANTASYCALC_URL);
  if (!fcRes.ok) {
    console.error(`FantasyCalc fetch failed: ${fcRes.status} ${fcRes.statusText}`);
    process.exit(1);
  }
  const fcData: FantasyCalcEntry[] = await fcRes.json();
  console.log(`  -> Received ${fcData.length} entries from FantasyCalc`);

  // Step 2: Filter to 2026 prospects (yoe=0 = current-year rookies, post-draft)
  const prospects = fcData.filter((entry) => {
    const { player, value } = entry;

    // Must be a skill position
    if (!SKILL_POSITIONS.has(player.position)) return false;

    // Must meet minimum value threshold
    if (value < MIN_VALUE) return false;

    // Must be college-age
    if (player.maybeAge != null && player.maybeAge > MAX_AGE) return false;

    // Must have no NFL experience (yoe === 0, yoe === null, or yoe is undefined)
    const hasNflExp =
      player.maybeYoe != null && player.maybeYoe > 0;
    if (hasNflExp) return false;

    return true;
  });

  // Step 4: Print identified prospects for review
  console.log(`\nIdentified ${prospects.length} 2026 prospects:\n`);
  console.log(
    'Rank'.padEnd(6) +
    'Pos'.padEnd(5) +
    'PosRank'.padEnd(9) +
    'Value'.padEnd(8) +
    'Name'
  );
  console.log('-'.repeat(60));

  for (const entry of prospects) {
    const { player, value, overallRank, positionRank } = entry;
    console.log(
      String(overallRank).padEnd(6) +
      player.position.padEnd(5) +
      String(positionRank).padEnd(9) +
      String(value).padEnd(8) +
      player.name
    );
  }

  // Step 5: Clear old data and insert fresh from FantasyCalc
  console.log(`\nClearing existing ${DRAFT_YEAR} rows...`);
  const { error: deleteError } = await supabase
    .from('prospect_profiles')
    .delete()
    .eq('draft_year', DRAFT_YEAR);
  if (deleteError) {
    console.error('Delete error:', deleteError);
    process.exit(1);
  }

  console.log(`Inserting ${prospects.length} prospects to prospect_profiles...`);

  const rows = prospects.map((entry) => ({
    name: entry.player.name,
    position: entry.player.position,
    draft_year: DRAFT_YEAR,
    nfl_team: null,
    fantasycalc_value: entry.value,
    overall_rank: entry.overallRank,
    position_rank: entry.positionRank,
    confidence_level: null,
    comp_results_json: null,
    draft_round: null,
    draft_pick: null,
  }));

  const { error, count } = await supabase
    .from('prospect_profiles')
    .insert(rows, { count: 'exact' });

  if (error) {
    console.error('Supabase upsert error:', error);
    process.exit(1);
  }

  // Step 6: Print summary by position
  const byPosition: Record<string, number> = {};
  for (const entry of prospects) {
    const pos = entry.player.position;
    byPosition[pos] = (byPosition[pos] ?? 0) + 1;
  }

  console.log(`\nSeeded ${count ?? prospects.length} prospects for ${DRAFT_YEAR} draft class:`);
  for (const [pos, n] of Object.entries(byPosition).sort()) {
    console.log(`  ${pos}: ${n}`);
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
