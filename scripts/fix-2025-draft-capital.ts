/**
 * One-time fix: seed 2025 NFL draft capital from ESPN API
 * for historical_rookies rows where draft_year=2025 and draft_round IS NULL.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ESPN position IDs → fantasy positions
const ESPN_POS_TO_FANTASY: Record<string, string> = {
  '1': 'QB', '2': 'RB', '3': 'WR', '4': 'TE',
};

function normalizeName(n: string) {
  return n.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
}

interface ESPNPick {
  overall: number;
  round: number;
  pick: number;
  athlete: { displayName: string; position?: { id: string } };
}

async function fetchRound(season: number, round: number): Promise<ESPNPick[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/draft?season=${season}&round=${round}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as { picks?: ESPNPick[] };
  return data.picks ?? [];
}

async function main() {
  // Fetch all 7 rounds of 2025 draft
  console.log('Fetching 2025 NFL Draft from ESPN...');
  const allPicks: ESPNPick[] = [];
  for (let round = 1; round <= 7; round++) {
    const picks = await fetchRound(2025, round);
    allPicks.push(...picks);
  }
  console.log(`Total 2025 picks fetched: ${allPicks.length}`);

  // Load our 2025 rows needing draft capital
  const { data: rows, error } = await supabase
    .from('historical_rookies')
    .select('id, name, position')
    .eq('draft_year', 2025)
    .is('draft_round', null);
  if (error) throw new Error(error.message);
  console.log(`2025 DB rows needing capital: ${rows?.length ?? 0}`);

  // Build name → ESPN pick map (normalize both sides)
  const espnByName = new Map<string, ESPNPick>();
  for (const pick of allPicks) {
    espnByName.set(normalizeName(pick.athlete.displayName), pick);
  }

  let matched = 0, unmatched = 0;
  for (const row of rows ?? []) {
    const key = normalizeName(row.name);
    const pick = espnByName.get(key);
    if (!pick) {
      // Try last-name-only match as fallback
      const lastName = key.split(' ').pop()!;
      const candidates = [...espnByName.entries()].filter(([k]) => k.endsWith(` ${lastName}`));
      if (candidates.length === 1) {
        const [, fallbackPick] = candidates[0];
        const { error: e } = await supabase
          .from('historical_rookies')
          .update({ draft_round: fallbackPick.round, draft_pick: fallbackPick.overall })
          .eq('id', row.id);
        if (!e) { matched++; console.log(`  [FALLBACK] ${row.name} → pick ${fallbackPick.overall} (round ${fallbackPick.round})`); }
        continue;
      }
      console.log(`  [UNMATCHED] ${row.name} (${row.position})`);
      unmatched++;
      continue;
    }
    const { error: e } = await supabase
      .from('historical_rookies')
      .update({ draft_round: pick.round, draft_pick: pick.overall })
      .eq('id', row.id);
    if (!e) matched++;
  }

  console.log(`\nDone — matched: ${matched}, unmatched: ${unmatched}`);
}

main().catch(err => { console.error(err); process.exit(1); });
