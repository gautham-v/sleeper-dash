/**
 * Pre-Draft 2026 Prospect Seeding Script
 *
 * Seeds known 2026 NFL Draft prospects with consensus dynasty values
 * BEFORE the NFL Draft (April 24, 2026). Values are estimates based on
 * current mock draft consensus and KeepTradeCut dynasty rankings.
 *
 * After the NFL Draft, run `npm run seed:prospects` to update with
 * real FantasyCalc values and confirmed draft positions.
 *
 * Run: npx tsx scripts/seed-2026-predraft-prospects.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const DRAFT_YEAR = 2026;

// Dynasty values are estimated based on current KTC consensus (March 2026).
// Scale matches FantasyCalc: ~0-9500 with elite prospects at 7000+
const PRE_DRAFT_PROSPECTS = [
  { name: 'Ashton Jeanty',      position: 'RB', draft_round: 1, fantasycalc_value: 9000, overall_rank: 1,  position_rank: 1, college: 'Boise State'  },
  { name: 'Cam Ward',           position: 'QB', draft_round: 1, fantasycalc_value: 7500, overall_rank: 2,  position_rank: 1, college: 'Miami'         },
  { name: 'Tyler Warren',       position: 'TE', draft_round: 1, fantasycalc_value: 6500, overall_rank: 3,  position_rank: 1, college: 'Penn State'    },
  { name: 'Shedeur Sanders',    position: 'QB', draft_round: 1, fantasycalc_value: 6500, overall_rank: 4,  position_rank: 2, college: 'Colorado'      },
  { name: 'Tetairoa McMillan',  position: 'WR', draft_round: 1, fantasycalc_value: 5200, overall_rank: 5,  position_rank: 1, college: 'Arizona'       },
  { name: 'Matthew Golden',     position: 'WR', draft_round: 1, fantasycalc_value: 4800, overall_rank: 6,  position_rank: 2, college: 'Texas'         },
  { name: 'Omarion Hampton',    position: 'RB', draft_round: 1, fantasycalc_value: 4500, overall_rank: 7,  position_rank: 2, college: 'UNC'           },
  { name: 'Emeka Egbuka',       position: 'WR', draft_round: 1, fantasycalc_value: 4200, overall_rank: 8,  position_rank: 3, college: 'Ohio State'    },
  { name: 'Luther Burden III',  position: 'WR', draft_round: 1, fantasycalc_value: 3800, overall_rank: 9,  position_rank: 4, college: 'Missouri'      },
  { name: 'TreVeyon Henderson', position: 'RB', draft_round: 1, fantasycalc_value: 3500, overall_rank: 10, position_rank: 3, college: 'Ohio State'    },
  { name: 'Harold Fannin',      position: 'TE', draft_round: 2, fantasycalc_value: 3200, overall_rank: 11, position_rank: 2, college: 'Bowling Green' },
  { name: 'Isaiah Bond',        position: 'WR', draft_round: 2, fantasycalc_value: 3000, overall_rank: 12, position_rank: 5, college: 'Texas'         },
  { name: 'RJ Harvey',          position: 'RB', draft_round: 2, fantasycalc_value: 2800, overall_rank: 13, position_rank: 4, college: 'UCF'           },
  { name: 'Quinshon Judkins',   position: 'RB', draft_round: 2, fantasycalc_value: 2800, overall_rank: 14, position_rank: 5, college: 'Ohio State'    },
  { name: 'Jayden Higgins',     position: 'WR', draft_round: 2, fantasycalc_value: 2600, overall_rank: 15, position_rank: 6, college: 'Iowa State'    },
  { name: 'Mason Taylor',       position: 'TE', draft_round: 2, fantasycalc_value: 2000, overall_rank: 16, position_rank: 3, college: 'LSU'           },
  { name: 'Dillon Gabriel',     position: 'QB', draft_round: 2, fantasycalc_value: 1800, overall_rank: 17, position_rank: 3, college: 'Oregon'        },
  { name: 'Elijah Arroyo',      position: 'TE', draft_round: 3, fantasycalc_value: 1700, overall_rank: 18, position_rank: 4, college: 'Miami'         },
  { name: 'Quinn Ewers',        position: 'QB', draft_round: 2, fantasycalc_value: 1500, overall_rank: 19, position_rank: 4, college: 'Texas'         },
];

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const rows = PRE_DRAFT_PROSPECTS.map((p) => ({
    name: p.name,
    position: p.position,
    draft_year: DRAFT_YEAR,
    draft_round: p.draft_round,
    draft_pick: null,          // not drafted yet
    nfl_team: null,
    college: p.college,
    fantasycalc_value: p.fantasycalc_value,
    overall_rank: p.overall_rank,
    position_rank: p.position_rank,
    confidence_level: 'medium' as const,
    comp_results_json: null,
  }));

  console.log(`Seeding ${rows.length} pre-draft 2026 prospects...`);
  console.log('NOTE: These are consensus estimates. Run npm run seed:prospects after April 24 to update with real values.\n');

  const { error, count } = await supabase
    .from('prospect_profiles')
    .upsert(rows, { onConflict: 'draft_year,name', count: 'exact' });

  if (error) {
    console.error('Supabase upsert error:', error);
    process.exit(1);
  }

  // Summary by position
  const byPos: Record<string, number> = {};
  for (const p of rows) byPos[p.position] = (byPos[p.position] ?? 0) + 1;
  console.log(`Seeded ${count ?? rows.length} prospects for ${DRAFT_YEAR} draft class:`);
  for (const [pos, n] of Object.entries(byPos).sort()) console.log(`  ${pos}: ${n}`);
  console.log('\nDone.');
}

main().catch((err) => { console.error(err); process.exit(1); });
