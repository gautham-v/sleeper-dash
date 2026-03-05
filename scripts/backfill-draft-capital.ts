/**
 * Backfill Draft Capital Script
 *
 * Fetches NFL draft round/pick data from the nflverse public CSV and updates
 * the `historical_rookies` table in Supabase with draft_round and draft_pick.
 *
 * Source: https://raw.githubusercontent.com/nflverse/nfldata/master/data/draft_picks.csv
 * CSV columns include: season, round, pick, team, pfr_name, position, ...
 *   - `pick` is the OVERALL pick number (1-based, across all rounds)
 *
 * Run: npx tsx scripts/backfill-draft-capital.ts
 *
 * Env required (in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
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

const NFLVERSE_DRAFT_CSV_URL =
  'https://raw.githubusercontent.com/nflverse/nfldata/master/data/draft_picks.csv';

const SKILL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DraftPickRow {
  season: number;
  round: number;
  pick: number; // overall pick number
  pfr_name: string;
  position: string;
  team: string;
}

interface HistoricalRookie {
  id: number;
  player_id: string;
  name: string;
  position: string;
  draft_year: number;
  draft_round: number | null;
  draft_pick: number | null;
}

interface MatchResult {
  rookie: HistoricalRookie;
  draftPick: DraftPickRow;
  matchType: 'exact' | 'fallback-lastname';
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Minimal CSV parser that handles quoted fields.
 * Returns an array of objects keyed by the header row.
 */
function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = splitCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    if (values.length === 0) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }

  return rows;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ---------------------------------------------------------------------------
// Name normalization
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/-/g, '')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLastName(name: string): string {
  const parts = name.trim().split(' ');
  return normalizeName(parts[parts.length - 1]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 1. Fetch the nflverse draft CSV
  console.log('Fetching nflverse draft picks CSV...');
  const res = await fetch(NFLVERSE_DRAFT_CSV_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch CSV: HTTP ${res.status}`);
  }
  const csvText = await res.text();
  console.log(`Downloaded CSV (${(csvText.length / 1024).toFixed(1)} KB)`);

  // 2. Parse CSV and filter to skill positions only
  const rawRows = parseCSV(csvText);
  console.log(`Total CSV rows: ${rawRows.length}`);

  const draftPicks: DraftPickRow[] = rawRows
    .filter((r) => {
      const pos = (r['position'] ?? '').trim().toUpperCase();
      const season = parseInt(r['season'] ?? '0', 10);
      const round = parseInt(r['round'] ?? '0', 10);
      const pick = parseInt(r['pick'] ?? '0', 10);
      const name = (r['pfr_name'] ?? '').trim();
      return (
        SKILL_POSITIONS.has(pos) &&
        season >= 2015 &&
        season <= 2025 &&
        round > 0 &&
        pick > 0 &&
        name.length > 0
      );
    })
    .map((r) => ({
      season: parseInt(r['season'], 10),
      round: parseInt(r['round'], 10),
      pick: parseInt(r['pick'], 10),
      pfr_name: r['pfr_name'].trim(),
      position: (r['position'] ?? '').trim().toUpperCase(),
      team: (r['team'] ?? '').trim(),
    }));

  console.log(`Skill-position draft picks (2015-2025): ${draftPicks.length}`);

  // Build lookup maps for fast matching
  // Key: `${season}|${normalizedName}|${position}` -> DraftPickRow
  const exactLookup = new Map<string, DraftPickRow>();
  // Key: `${season}|${lastName}|${position}` -> DraftPickRow[]
  const lastNameLookup = new Map<string, DraftPickRow[]>();

  for (const pick of draftPicks) {
    const normName = normalizeName(pick.pfr_name);
    const lastName = extractLastName(pick.pfr_name);
    const pos = pick.position;
    const yr = pick.season;

    const exactKey = `${yr}|${normName}|${pos}`;
    exactLookup.set(exactKey, pick);

    const lastNameKey = `${yr}|${lastName}|${pos}`;
    const existing = lastNameLookup.get(lastNameKey) ?? [];
    existing.push(pick);
    lastNameLookup.set(lastNameKey, existing);
  }

  // 3. Load ALL historical_rookies rows where draft_round IS NULL (paginated)
  console.log('\nLoading historical_rookies from Supabase...');
  const typedRookies: HistoricalRookie[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  while (true) {
    const { data, error: dbError } = await supabase
      .from('historical_rookies')
      .select('id, player_id, name, position, draft_year, draft_round, draft_pick')
      .is('draft_round', null)
      .range(offset, offset + PAGE_SIZE - 1);
    if (dbError) throw new Error(`Supabase query failed: ${dbError.message}`);
    if (!data || data.length === 0) break;
    typedRookies.push(...(data as HistoricalRookie[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  console.log(`Rows needing backfill: ${typedRookies.length}`);

  // 4. Match each rookie to a draft pick
  const matched: MatchResult[] = [];
  const unmatched: HistoricalRookie[] = [];

  for (const rookie of typedRookies) {
    const normName = normalizeName(rookie.name);
    const lastName = extractLastName(rookie.name);
    const pos = rookie.position.toUpperCase();
    const yr = rookie.draft_year;

    // Try exact match first
    const exactKey = `${yr}|${normName}|${pos}`;
    const exactPick = exactLookup.get(exactKey);

    if (exactPick) {
      matched.push({ rookie, draftPick: exactPick, matchType: 'exact' });
      continue;
    }

    // Fallback: last name + position + year
    const lastNameKey = `${yr}|${lastName}|${pos}`;
    const candidates = lastNameLookup.get(lastNameKey) ?? [];

    if (candidates.length === 1) {
      // Unique last-name match — accept it with a warning
      matched.push({ rookie, draftPick: candidates[0], matchType: 'fallback-lastname' });
      console.log(
        `  [FALLBACK] "${rookie.name}" matched to "${candidates[0].pfr_name}" ` +
          `(${yr}, ${pos}, pick ${candidates[0].pick})`
      );
    } else if (candidates.length > 1) {
      // Ambiguous — log and skip
      console.warn(
        `  [AMBIGUOUS] "${rookie.name}" (${yr} ${pos}) has ${candidates.length} last-name candidates: ` +
          candidates.map((c) => c.pfr_name).join(', ')
      );
      unmatched.push(rookie);
    } else {
      unmatched.push(rookie);
    }
  }

  console.log(`\nMatched: ${matched.length}, Unmatched: ${unmatched.length}`);

  // 5. Update Supabase for matched rows
  let updateOk = 0;
  let updateFail = 0;

  for (const { rookie, draftPick } of matched) {
    const { error: updateError } = await supabase
      .from('historical_rookies')
      .update({
        draft_round: draftPick.round,
        draft_pick: draftPick.pick,
      })
      .eq('id', rookie.id);

    if (updateError) {
      console.error(
        `  [ERROR] Failed to update "${rookie.name}" (id=${rookie.id}): ${updateError.message}`
      );
      updateFail++;
    } else {
      updateOk++;
    }
  }

  // 6. Summary
  console.log('\n--- Summary ---');
  console.log(`Total rows needing backfill: ${typedRookies.length}`);
  console.log(`Successfully matched:        ${matched.length}`);
  console.log(`  - Exact name match:        ${matched.filter((m) => m.matchType === 'exact').length}`);
  console.log(`  - Fallback last-name:      ${matched.filter((m) => m.matchType === 'fallback-lastname').length}`);
  console.log(`Unmatched:                   ${unmatched.length}`);
  console.log(`DB updates succeeded:        ${updateOk}`);
  console.log(`DB updates failed:           ${updateFail}`);

  if (unmatched.length > 0) {
    console.log('\n--- Unmatched players (manual review needed) ---');
    const byYear = unmatched.reduce<Record<number, HistoricalRookie[]>>((acc, r) => {
      (acc[r.draft_year] ??= []).push(r);
      return acc;
    }, {});

    for (const year of Object.keys(byYear).sort()) {
      const group = byYear[Number(year)];
      console.log(`\n  ${year}:`);
      for (const r of group) {
        console.log(`    - ${r.name} (${r.position}, player_id=${r.player_id})`);
      }
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
