/**
 * Backfill Athletic Scores from nflverse Combine CSV
 *
 * Downloads the free nflverse combine.csv, computes a 0–10 Relative Athletic Score
 * for each player, and updates `athletic_score` in historical_rookies.
 *
 * RAS is computed as follows:
 *   1. For each combine measurement, compute the player's percentile vs. ALL
 *      players at their position in the combine dataset (2000–present).
 *   2. Average the percentiles that are actually present (skip missing).
 *   3. Scale 0–1 average to 0–10. 5.0 = average athlete.
 *
 * Measurement directions:
 *   Better = lower:  forty, cone, shuttle
 *   Better = higher: bench, vertical, broad_jump, height, weight
 *
 * Run: npx tsx scripts/backfill-combine-athletic-scores.ts
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

const COMBINE_CSV_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/combine/combine.csv';

const SKILL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

// Draft years covered in historical_rookies
const DRAFT_YEAR_START = 2015;
const DRAFT_YEAR_END = 2025;

// ---------------------------------------------------------------------------
// CSV parser (no external deps)
// ---------------------------------------------------------------------------

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

  return lines.slice(1).map((line) => {
    // Handle quoted fields
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });
}

// ---------------------------------------------------------------------------
// Parse height from "6-2" or "74" (inches) formats
// ---------------------------------------------------------------------------

function parseHeight(raw: string): number | null {
  if (!raw || raw === 'NA') return null;
  if (raw.includes('-')) {
    const [ft, inches] = raw.split('-').map(Number);
    if (isNaN(ft) || isNaN(inches)) return null;
    return ft * 12 + inches;
  }
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

function parseNum(raw: string): number | null {
  if (!raw || raw === 'NA' || raw === '') return null;
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// Percentile of a value in a sorted array
// ---------------------------------------------------------------------------

function percentileOf(value: number, sorted: number[], lowerIsBetter: boolean): number {
  // Count how many values are strictly worse than this player
  const worseThan = lowerIsBetter
    ? sorted.filter((v) => v > value).length  // worse = higher time
    : sorted.filter((v) => v < value).length; // worse = lower value
  return worseThan / sorted.length;
}

// ---------------------------------------------------------------------------
// Combine measurement fields and whether lower is better
// ---------------------------------------------------------------------------

const COMBINE_MEASUREMENTS: Array<{ key: string; lowerIsBetter: boolean }> = [
  { key: 'forty',      lowerIsBetter: true  },
  { key: 'bench',      lowerIsBetter: false },
  { key: 'vertical',   lowerIsBetter: false },
  { key: 'broad_jump', lowerIsBetter: false },
  { key: 'cone',       lowerIsBetter: true  },
  { key: 'shuttle',    lowerIsBetter: true  },
  { key: 'ht',         lowerIsBetter: false },
  { key: 'wt',         lowerIsBetter: false },
];

// ---------------------------------------------------------------------------
// Name normalization for matching
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Compute athletic score for a single player row
// ---------------------------------------------------------------------------

interface CombineRow {
  ht: number | null;
  wt: number | null;
  forty: number | null;
  bench: number | null;
  vertical: number | null;
  broad_jump: number | null;
  cone: number | null;
  shuttle: number | null;
}

function computeAthleteScore(
  player: CombineRow,
  positionNorms: Map<string, number[]>,
): number | null {
  const percentiles: number[] = [];

  for (const { key, lowerIsBetter } of COMBINE_MEASUREMENTS) {
    const value = player[key as keyof CombineRow];
    if (value == null) continue;

    const sorted = positionNorms.get(key);
    if (!sorted || sorted.length < 5) continue;

    percentiles.push(percentileOf(value, sorted, lowerIsBetter));
  }

  if (percentiles.length < 3) return null; // need at least 3 measurements

  const avg = percentiles.reduce((a, b) => a + b, 0) / percentiles.length;
  return Math.round(avg * 100) / 10; // 0–10 scale, one decimal
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Step 1: Download nflverse combine CSV
  console.log('Downloading nflverse combine.csv...');
  const res = await fetch(COMBINE_CSV_URL, {
    redirect: 'follow',
    headers: { 'Accept': 'text/csv,*/*' },
  });
  if (!res.ok) {
    console.error(`Failed to download combine.csv: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const csvText = await res.text();
  console.log(`Downloaded ${(csvText.length / 1024).toFixed(0)} KB`);

  // Step 2: Parse CSV
  const rows = parseCsv(csvText);
  console.log(`Parsed ${rows.length} combine rows`);

  // Log first row headers for debugging
  if (rows.length > 0) {
    console.log('CSV columns:', Object.keys(rows[0]).join(', '));
  }

  // Step 3: Filter to skill positions and parse measurements
  interface ParsedCombineRow {
    player_name: string;
    normalizedName: string;
    pos: string;
    season: number;
    data: CombineRow;
  }

  const combineRows: ParsedCombineRow[] = [];
  for (const row of rows) {
    // nflverse column names: player_name, pos, season (= draft year)
    const pos = (row['pos'] ?? row['position'] ?? '').toUpperCase();
    if (!SKILL_POSITIONS.has(pos)) continue;

    const season = parseInt(row['season'] ?? row['draft_year'] ?? '0', 10);
    if (!season) continue;

    const player_name = row['player_name'] ?? row['player'] ?? row['name'] ?? '';
    if (!player_name) continue;

    combineRows.push({
      player_name,
      normalizedName: normalizeName(player_name),
      pos,
      season,
      data: {
        ht: parseHeight(row['ht'] ?? row['height'] ?? ''),
        wt: parseNum(row['wt'] ?? row['weight'] ?? ''),
        forty: parseNum(row['forty'] ?? row['forty_yd'] ?? ''),
        bench: parseNum(row['bench'] ?? row['bench_reps'] ?? ''),
        vertical: parseNum(row['vertical'] ?? row['vert'] ?? ''),
        broad_jump: parseNum(row['broad_jump'] ?? row['broad'] ?? ''),
        cone: parseNum(row['cone'] ?? row['three_cone'] ?? ''),
        shuttle: parseNum(row['shuttle'] ?? ''),
      },
    });
  }

  console.log(`\nSkill position combine rows: ${combineRows.length}`);

  // Step 4: Build position-level sorted arrays for percentile calculation
  // Use ALL historical data (not just 2015+) for stable percentile norms
  const positionNorms = new Map<string, Map<string, number[]>>();
  for (const pos of SKILL_POSITIONS) {
    const posRows = combineRows.filter((r) => r.pos === pos);
    const normMap = new Map<string, number[]>();
    for (const { key } of COMBINE_MEASUREMENTS) {
      const values = posRows
        .map((r) => r.data[key as keyof CombineRow])
        .filter((v): v is number => v != null)
        .sort((a, b) => a - b);
      if (values.length >= 5) normMap.set(key, values);
    }
    positionNorms.set(pos, normMap);
    console.log(`Position ${pos}: ${posRows.length} combine rows, norms for ${normMap.size} measurements`);
  }

  // Step 5: Load historical_rookies from Supabase
  console.log('\nLoading historical_rookies from Supabase...');
  const allRookies: Array<{ id: number; name: string; position: string; draft_year: number; athletic_score: number | null }> = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('historical_rookies')
      .select('id, name, position, draft_year, athletic_score')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Supabase fetch error: ${error.message}`);
    if (!data || data.length === 0) break;
    allRookies.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  console.log(`Loaded ${allRookies.length} historical rookies`);

  // Filter to our year range
  const targetRookies = allRookies.filter(
    (r) => r.draft_year >= DRAFT_YEAR_START && r.draft_year <= DRAFT_YEAR_END,
  );
  console.log(`Target range (${DRAFT_YEAR_START}–${DRAFT_YEAR_END}): ${targetRookies.length} rookies`);

  // Build a lookup: normalizedName + year + position → combine row
  const combineByKey = new Map<string, ParsedCombineRow>();
  for (const row of combineRows) {
    const key = `${row.normalizedName}|${row.season}|${row.pos}`;
    combineByKey.set(key, row);
  }

  // Also build name-only lookup for fuzzy matching when year is off
  const combineByNamePos = new Map<string, ParsedCombineRow[]>();
  for (const row of combineRows) {
    const key = `${row.normalizedName}|${row.pos}`;
    const arr = combineByNamePos.get(key) ?? [];
    arr.push(row);
    combineByNamePos.set(key, arr);
  }

  // Step 6: Match and compute
  let matched = 0;
  let updated = 0;
  let noMatch = 0;
  let skipped = 0;

  const updates: Array<{ id: number; athletic_score: number }> = [];

  for (const rookie of targetRookies) {
    const normName = normalizeName(rookie.name);
    const key = `${normName}|${rookie.draft_year}|${rookie.position}`;

    let combineRow = combineByKey.get(key);

    // Fuzzy: try ±1 year if exact year doesn't match (late-round UDFAs sometimes listed differently)
    if (!combineRow) {
      const arr = combineByNamePos.get(`${normName}|${rookie.position}`) ?? [];
      if (arr.length > 0) {
        // Pick the closest season match
        combineRow = arr.reduce((best, row) =>
          Math.abs(row.season - rookie.draft_year) < Math.abs(best.season - rookie.draft_year) ? row : best
        );
        if (Math.abs(combineRow.season - rookie.draft_year) > 1) {
          combineRow = undefined; // too far off
        }
      }
    }

    if (!combineRow) {
      noMatch++;
      continue;
    }

    matched++;

    const posNorms = positionNorms.get(rookie.position);
    if (!posNorms) {
      skipped++;
      continue;
    }

    const score = computeAthleteScore(combineRow.data, posNorms);
    if (score == null) {
      skipped++;
      continue;
    }

    updates.push({ id: rookie.id, athletic_score: score });
  }

  console.log(`\nMatched: ${matched}, No match: ${noMatch}, Skipped (missing data): ${skipped}`);
  console.log(`Will update ${updates.length} rows with athletic scores`);

  // Step 7: Batch update
  if (updates.length === 0) {
    console.log('Nothing to update.');
    return;
  }

  const BATCH_SIZE = 50;
  let batchErrors = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);

    // Update each row individually (Supabase doesn't support batch updates by different PKs easily)
    await Promise.all(
      batch.map(async ({ id, athletic_score }) => {
        const { error } = await supabase
          .from('historical_rookies')
          .update({ athletic_score })
          .eq('id', id);
        if (error) {
          console.error(`Update error for id=${id}:`, error.message);
          batchErrors++;
        } else {
          updated++;
        }
      }),
    );

    if ((i + BATCH_SIZE) % 200 === 0 || i + BATCH_SIZE >= updates.length) {
      console.log(`Progress: ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`);
    }
  }

  // Step 8: Sample output for verification
  const sample = updates.slice(0, 10);
  console.log('\nSample athletic scores:');
  for (const { id, athletic_score } of sample) {
    const rookie = targetRookies.find((r) => r.id === id);
    if (rookie) {
      console.log(`  ${rookie.name} (${rookie.position}, ${rookie.draft_year}): ${athletic_score}`);
    }
  }

  console.log(`\nDone. Updated: ${updated}/${updates.length}, Errors: ${batchErrors}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
