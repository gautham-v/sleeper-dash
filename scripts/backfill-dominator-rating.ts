/**
 * Backfill Dominator Rating from CFBD (College Football Data API)
 *
 * For each historical rookie with a college and no dominator_rating:
 *   1. Fetch the player's final college season stats via CFBD
 *   2. Compute team totals by summing all players on that team
 *   3. Dominator rating = position-appropriate share metric (0–100 scale)
 *      WR/TE: (rec_yards_share + rec_td_share) / 2 × 100
 *      RB:    (rush_yards_share + rush_td_share) / 2 × 100
 *      QB:    (pass_yards_share + pass_td_share) / 2 × 100
 *
 * Elite WR: 30+ (e.g. Ja'Marr Chase 2020: ~36)
 * Average R1 WR: ~22-26
 * R2 WR: ~15-18
 *
 * Run: CFBD_API_KEY=your_key npx tsx scripts/backfill-dominator-rating.ts
 * Get a free API key at: https://collegefootballdata.com/key
 *
 * Env required:
 *   CFBD_API_KEY (or set in .env.local)
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
const CFBD_API_KEY = process.env.CFBD_API_KEY!;
const CFBD_BASE = 'https://api.collegefootballdata.com';

const SKILL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

// ---------------------------------------------------------------------------
// College name normalization: Sleeper format → CFBD format
// ---------------------------------------------------------------------------

const COLLEGE_NAME_MAP: Record<string, string> = {
  'Ohio St.': 'Ohio State',
  'Ohio State University': 'Ohio State',
  'Penn St.': 'Penn State',
  'Michigan St.': 'Michigan State',
  'Iowa St.': 'Iowa State',
  'Kansas St.': 'Kansas State',
  'Oklahoma St.': 'Oklahoma State',
  'Oregon St.': 'Oregon State',
  'Washington St.': 'Washington State',
  'Utah St.': 'Utah State',
  'Colorado St.': 'Colorado State',
  'Mississippi St.': 'Mississippi State',
  'Miss St.': 'Mississippi State',
  'Appalachian St.': 'Appalachian State',
  'App St.': 'Appalachian State',
  'Fresno St.': 'Fresno State',
  'San Diego St.': 'San Diego State',
  'Boise St.': 'Boise State',
  'Arizona St.': 'Arizona State',
  'Florida St.': 'Florida State',
  'Ole Miss': 'Mississippi',
  'Southern Miss': 'Southern Mississippi',
  'SIU': 'Southern Illinois',
  'UConn': 'Connecticut',
  'UNLV': 'Nevada-Las Vegas',
  'TCU': 'TCU',
  'UCF': 'UCF',
  'USF': 'South Florida',
  'UAB': 'UAB',
  'UNC': 'North Carolina',
  'NC State': 'NC State',
  'N.C. State': 'NC State',
  'Cal': 'California',
  'Pitt': 'Pittsburgh',
  'UMass': 'Massachusetts',
  'FIU': 'Florida International',
  'FAU': 'Florida Atlantic',
  'WKU': 'Western Kentucky',
  'NIU': 'Northern Illinois',
  'MTSU': 'Middle Tennessee',
  'SMU': 'SMU',
  'BYU': 'BYU',
  'LSU': 'LSU',
  'USC': 'USC',
  'UCLA': 'UCLA',
  'ECU': 'East Carolina',
  'E. Carolina': 'East Carolina',
  'E Carolina': 'East Carolina',
  'W. Virginia': 'West Virginia',
  'W Virginia': 'West Virginia',
  'N. Illinois': 'Northern Illinois',
  'S. Carolina': 'South Carolina',
  'S Carolina': 'South Carolina',
  'N. Texas': 'North Texas',
  'N Texas': 'North Texas',
  'S. Miss': 'Southern Mississippi',
  'S Miss': 'Southern Mississippi',
  'Fla': 'Florida',
  'Fla.': 'Florida',
  'Tenn': 'Tennessee',
  'Tenn.': 'Tennessee',
  'Ala': 'Alabama',
  'Ala.': 'Alabama',
  'Miss': 'Mississippi',
  'Miss.': 'Mississippi',
  'Ark': 'Arkansas',
  'Ark.': 'Arkansas',
  'Ga': 'Georgia',
  'Ga.': 'Georgia',
  'Tex': 'Texas',
  'Tex.': 'Texas',
  'Va': 'Virginia',
  'Va.': 'Virginia',
  'Va Tech': 'Virginia Tech',
  'Indiana State': 'Indiana State',
  'U-M': 'Michigan',
  'UM': 'Michigan',
  'Cent. Florida': 'UCF',
  'Central Florida': 'UCF',
  'Southern Cal': 'USC',
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCollege(college: string): string {
  const mapped = COLLEGE_NAME_MAP[college];
  if (mapped) return mapped;
  // Try case-insensitive
  const lower = college.toLowerCase();
  for (const [k, v] of Object.entries(COLLEGE_NAME_MAP)) {
    if (k.toLowerCase() === lower) return v;
  }
  return college;
}

// ---------------------------------------------------------------------------
// CFBD API types
// ---------------------------------------------------------------------------

interface CfbdStatRow {
  playerId: string;
  player: string;
  team: string;
  conference: string;
  category: string;
  statType: string;
  stat: string;
}

// ---------------------------------------------------------------------------
// Team stats cache: (college, year, category) → CfbdStatRow[]
// ---------------------------------------------------------------------------

const teamStatsCache = new Map<string, CfbdStatRow[]>();

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchCfbdTeamStats(
  college: string,
  year: number,
  category: 'receiving' | 'rushing' | 'passing',
): Promise<CfbdStatRow[]> {
  const cacheKey = `${college}|${year}|${category}`;
  if (teamStatsCache.has(cacheKey)) return teamStatsCache.get(cacheKey)!;

  const params = new URLSearchParams({
    year: String(year),
    team: college,
    category,
  });
  const url = `${CFBD_BASE}/stats/player/season?${params}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${CFBD_API_KEY}` },
    });
    if (res.status === 429) {
      console.warn('Rate limited — waiting 5s...');
      await sleep(5000);
      return fetchCfbdTeamStats(college, year, category);
    }
    if (!res.ok) {
      console.warn(`CFBD ${res.status} for ${college} ${year} ${category}`);
      teamStatsCache.set(cacheKey, []);
      return [];
    }
    const data: CfbdStatRow[] = await res.json();
    teamStatsCache.set(cacheKey, data ?? []);
    return data ?? [];
  } catch {
    teamStatsCache.set(cacheKey, []);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Build per-player stat map: name → {statType → value}
// ---------------------------------------------------------------------------

function buildPlayerStatMap(rows: CfbdStatRow[]): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const normalName = normalizeName(row.player);
    const statMap = map.get(normalName) ?? new Map<string, number>();
    statMap.set(row.statType.toUpperCase(), parseFloat(row.stat) || 0);
    map.set(normalName, statMap);
  }
  return map;
}

// Sum a stat across all players (team total)
function teamTotal(playerMap: Map<string, Map<string, number>>, statType: string): number {
  let total = 0;
  for (const stats of playerMap.values()) {
    total += stats.get(statType.toUpperCase()) ?? 0;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Compute dominator rating for a player
// ---------------------------------------------------------------------------

async function computeDomin(
  name: string,
  position: string,
  college: string,
  year: number,
): Promise<number | null> {
  const cfbdCollege = normalizeCollege(college);
  const normalPlayerName = normalizeName(name);

  if (position === 'WR' || position === 'TE') {
    const recRows = await fetchCfbdTeamStats(cfbdCollege, year, 'receiving');
    await sleep(100); // gentle rate limiting
    if (recRows.length === 0) return null;

    const playerMap = buildPlayerStatMap(recRows);
    const playerStats = playerMap.get(normalPlayerName);
    if (!playerStats) {
      // Try partial name match (handles Jr., suffixes, etc.)
      let bestMatch: Map<string, number> | undefined;
      let bestScore = 0;
      for (const [pName, stats] of playerMap) {
        const words = normalPlayerName.split(' ');
        const matchCount = words.filter(w => pName.includes(w) && w.length > 2).length;
        if (matchCount > bestScore) {
          bestScore = matchCount;
          bestMatch = stats;
        }
      }
      if (!bestMatch || bestScore < 2) return null;
      return computeShareFromStats(bestMatch, playerMap, position);
    }
    return computeShareFromStats(playerStats, playerMap, position);
  }

  if (position === 'RB') {
    const rushRows = await fetchCfbdTeamStats(cfbdCollege, year, 'rushing');
    await sleep(100);
    if (rushRows.length === 0) return null;

    const playerMap = buildPlayerStatMap(rushRows);
    const playerStats = playerMap.get(normalPlayerName);
    if (!playerStats) {
      let bestMatch: Map<string, number> | undefined;
      let bestScore = 0;
      for (const [pName, stats] of playerMap) {
        const words = normalPlayerName.split(' ');
        const matchCount = words.filter(w => pName.includes(w) && w.length > 2).length;
        if (matchCount > bestScore) {
          bestScore = matchCount;
          bestMatch = stats;
        }
      }
      if (!bestMatch || bestScore < 2) return null;
      return computeRBShare(bestMatch, playerMap);
    }
    return computeRBShare(playerStats, playerMap);
  }

  if (position === 'QB') {
    const passRows = await fetchCfbdTeamStats(cfbdCollege, year, 'passing');
    await sleep(100);
    if (passRows.length === 0) return null;

    const playerMap = buildPlayerStatMap(passRows);
    const playerStats = playerMap.get(normalPlayerName);
    if (!playerStats) return null;

    const playerPassYds = playerStats.get('YDS') ?? 0;
    const playerPassTDs = playerStats.get('TD') ?? 0;
    const teamPassYds = teamTotal(playerMap, 'YDS');
    const teamPassTDs = teamTotal(playerMap, 'TD');

    if (teamPassYds < 500) return null; // insufficient team data
    const ydsShare = teamPassYds > 0 ? playerPassYds / teamPassYds : 0;
    const tdShare = teamPassTDs > 0 ? playerPassTDs / Math.max(1, teamPassTDs) : 0;
    return Math.round(((ydsShare + tdShare) / 2) * 1000) / 10; // 0–100
  }

  return null;
}

function computeShareFromStats(
  playerStats: Map<string, number>,
  allPlayerMap: Map<string, Map<string, number>>,
  position: string,
): number | null {
  const playerRecYds = playerStats.get('YDS') ?? 0;
  const playerRecTDs = playerStats.get('TD') ?? 0;

  const teamRecYds = teamTotal(allPlayerMap, 'YDS');
  const teamRecTDs = teamTotal(allPlayerMap, 'TD');

  if (teamRecYds < 500) return null; // insufficient data

  const ydsShare = teamRecYds > 0 ? playerRecYds / teamRecYds : 0;
  const tdShare = teamRecTDs > 0 ? playerRecTDs / Math.max(1, teamRecTDs) : 0;

  // Weight toward yards share for TEs (TDs more volatile; RB often steals TDs)
  const ydsWeight = position === 'TE' ? 0.65 : 0.50;
  const tdWeight = 1 - ydsWeight;

  return Math.round((ydsShare * ydsWeight + tdShare * tdWeight) * 1000) / 10;
}

function computeRBShare(
  playerStats: Map<string, number>,
  allPlayerMap: Map<string, Map<string, number>>,
): number | null {
  const playerRushYds = playerStats.get('YDS') ?? 0;
  const playerRushTDs = playerStats.get('TD') ?? 0;

  const teamRushYds = teamTotal(allPlayerMap, 'YDS');
  const teamRushTDs = teamTotal(allPlayerMap, 'TD');

  if (teamRushYds < 200) return null;

  const ydsShare = teamRushYds > 0 ? playerRushYds / teamRushYds : 0;
  const tdShare = teamRushTDs > 0 ? playerRushTDs / Math.max(1, teamRushTDs) : 0;

  return Math.round(((ydsShare + tdShare) / 2) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase env vars');
    process.exit(1);
  }
  if (!CFBD_API_KEY) {
    console.error(
      'Missing CFBD_API_KEY.\nGet a free key at: https://collegefootballdata.com/key\n' +
      'Then run: CFBD_API_KEY=your_key npm run backfill:dominator'
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Load all rookies without dominator rating that have a college
  console.log('Loading historical_rookies without dominator_rating...');
  const allRookies: Array<{
    id: number;
    name: string;
    position: string;
    college: string | null;
    draft_year: number;
    dominator_rating: number | null;
  }> = [];

  const PAGE_SIZE = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('historical_rookies')
      .select('id, name, position, college, draft_year, dominator_rating')
      .is('dominator_rating', null)
      .not('college', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Supabase fetch: ${error.message}`);
    if (!data || data.length === 0) break;
    allRookies.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const targets = allRookies.filter((r) => SKILL_POSITIONS.has(r.position) && r.college);
  console.log(`Found ${targets.length} rookies to process`);

  let processed = 0;
  let found = 0;
  let notFound = 0;
  let apiErrors = 0;

  const updates: Array<{ id: number; dominator_rating: number }> = [];

  for (const rookie of targets) {
    const college = rookie.college!;
    const finalCollegeYear = rookie.draft_year - 1;

    // Try final college year first, then year before (for redshirts)
    let rating: number | null = null;
    for (const year of [finalCollegeYear, finalCollegeYear - 1]) {
      try {
        rating = await computeDomin(rookie.name, rookie.position, college, year);
        if (rating !== null && rating > 0) break;
      } catch (err) {
        console.error(`Error for ${rookie.name}: ${err}`);
        apiErrors++;
      }
    }

    if (rating !== null && rating > 0) {
      updates.push({ id: rookie.id, dominator_rating: rating });
      found++;
    } else {
      notFound++;
    }

    processed++;
    if (processed % 50 === 0) {
      console.log(`Progress: ${processed}/${targets.length} (found: ${found}, not found: ${notFound})`);
    }
  }

  console.log(`\nComputed dominator ratings for ${updates.length}/${targets.length} players`);
  console.log(`Not found: ${notFound}, API errors: ${apiErrors}`);

  // Batch update Supabase
  if (updates.length === 0) {
    console.log('Nothing to update.');
    return;
  }

  console.log('Updating Supabase...');
  let dbErrors = 0;
  let dbUpdated = 0;
  const BATCH = 50;

  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async ({ id, dominator_rating }) => {
        const { error } = await supabase
          .from('historical_rookies')
          .update({ dominator_rating })
          .eq('id', id);
        if (error) {
          console.error(`DB error id=${id}: ${error.message}`);
          dbErrors++;
        } else {
          dbUpdated++;
        }
      }),
    );
    if (i + BATCH >= updates.length || (i + BATCH) % 200 === 0) {
      console.log(`  DB progress: ${Math.min(i + BATCH, updates.length)}/${updates.length}`);
    }
  }

  // Sample output
  const sample = updates.slice(0, 15);
  console.log('\nSample dominator ratings:');
  for (const { id, dominator_rating } of sample) {
    const r = targets.find((t) => t.id === id);
    if (r) console.log(`  ${r.name} (${r.position}, ${r.draft_year}, ${r.college}): ${dominator_rating}`);
  }

  console.log(`\nDone. Updated: ${dbUpdated}/${updates.length}, Errors: ${dbErrors}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
