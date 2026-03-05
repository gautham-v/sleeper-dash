/**
 * Netlify Scheduled Function — Auto-refresh 2026 prospect_profiles
 *
 * Runs daily during NFL Draft season (March–June).
 * Pulls fresh FantasyCalc values so the Draft Board reflects current rankings
 * without requiring a manual `npm run seed:prospects` command.
 *
 * Schedule: once per day at 6am UTC during April–May (NFL Draft window).
 * Netlify cron syntax: "0 6 * 4,5 *" (6am UTC every day in April and May)
 */

import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const FANTASYCALC_URL =
  'https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=1&numTeams=12&ppr=1';
const SKILL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);
const DRAFT_YEAR = 2026;
const MAX_AGE = 24;
const MIN_VALUE = 500;

interface FantasyCalcPlayer {
  name: string;
  position: string;
  maybeTeam?: string | null;
  maybeAge?: number | null;
  maybeYoe?: number | null;
  maybeBirthday?: string | null;
  maybeHeight?: number | null;
  maybeWeight?: number | null;
}

interface FantasyCalcEntry {
  player: FantasyCalcPlayer;
  value: number;
  overallRank: number;
  positionRank: number;
}

export default async function handler() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[refresh-prospects] Missing Supabase env vars');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch FantasyCalc
  const fcRes = await fetch(FANTASYCALC_URL);
  if (!fcRes.ok) {
    console.error(`[refresh-prospects] FantasyCalc fetch failed: ${fcRes.status}`);
    return;
  }
  const fcData: FantasyCalcEntry[] = await fcRes.json();

  // Filter to 2026 rookies
  const prospects = fcData.filter((entry) => {
    const { player, value } = entry;
    if (!SKILL_POSITIONS.has(player.position)) return false;
    if (value < MIN_VALUE) return false;
    if (player.maybeAge != null && player.maybeAge > MAX_AGE) return false;
    const hasNflExp = player.maybeYoe != null && player.maybeYoe > 0;
    return !hasNflExp;
  });

  if (prospects.length === 0) {
    console.log('[refresh-prospects] No 2026 prospects found — skipping update');
    return;
  }

  // Build rows
  const rows = prospects.map((entry) => {
    const { player, value, overallRank, positionRank } = entry;

    let age_at_draft: number | null = null;
    if (player.maybeBirthday) {
      const born = new Date(player.maybeBirthday);
      const draftDate = new Date(`${DRAFT_YEAR}-04-26`);
      age_at_draft = Math.round(
        ((draftDate.getTime() - born.getTime()) / (365.25 * 24 * 3600 * 1000)) * 10
      ) / 10;
    }

    const athletic_profile_json =
      player.maybeHeight != null || player.maybeWeight != null || age_at_draft != null
        ? {
            height_in: player.maybeHeight ?? null,
            weight_lbs: player.maybeWeight ?? null,
            age_at_draft,
            birthday: player.maybeBirthday ?? null,
          }
        : null;

    return {
      name: player.name,
      position: player.position,
      draft_year: DRAFT_YEAR,
      nfl_team: player.maybeTeam ?? null,
      fantasycalc_value: value,
      overall_rank: overallRank,
      position_rank: positionRank,
      confidence_level: null as null,
      comp_results_json: null as null,
      draft_round: null as null,
      draft_pick: null as null,
      athletic_profile_json,
    };
  });

  // Clear and re-insert
  const { error: deleteError } = await supabase
    .from('prospect_profiles')
    .delete()
    .eq('draft_year', DRAFT_YEAR);

  if (deleteError) {
    console.error('[refresh-prospects] Delete error:', deleteError.message);
    return;
  }

  const { error: insertError, count } = await supabase
    .from('prospect_profiles')
    .insert(rows, { count: 'exact' });

  if (insertError) {
    console.error('[refresh-prospects] Insert error:', insertError.message);
    return;
  }

  console.log(`[refresh-prospects] Refreshed ${count ?? rows.length} prospects for ${DRAFT_YEAR}`);
}

// Run daily at 6am UTC during April and May (NFL Draft window)
export const config: Config = {
  schedule: '0 6 * 4,5 *',
};
