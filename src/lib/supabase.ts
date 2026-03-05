import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types matching the DB schema
export interface HistoricalRookie {
  id?: number;
  player_id?: string;
  name: string;
  position: string;
  draft_year: number;
  draft_round?: number;
  draft_pick?: number;
  nfl_team?: string;
  college?: string;
  year1_ppr?: number;
  year2_ppr?: number;
  year3_ppr?: number;
  year1_games?: number;
  year2_games?: number;
  year3_games?: number;
  breakout_age?: number;
  dominator_rating?: number;
  athletic_score?: number;
  data_sources?: string[];
  notes?: string;
  // Computed at runtime in API route — not stored in DB
  pos_rank_in_class?: number;
}

export interface ProspectProfile {
  id?: number;
  player_id?: string;
  name: string;
  position: string;
  draft_year: number;
  draft_round?: number;
  draft_pick?: number;
  nfl_team?: string;
  college?: string;
  college_stats_json?: Record<string, unknown>;
  athletic_profile_json?: Record<string, unknown>;
  landing_spot_json?: Record<string, unknown>;
  comp_results_json?: Record<string, unknown>;
  overall_rank?: number;
  position_rank?: number;
  confidence_level?: 'high' | 'medium' | 'low';
  fantasycalc_value?: number;
}

export interface LeagueSnapshot {
  id?: number;
  league_id: string;
  snapshot_date?: string;
  season: number;
  team_states_json: unknown;
}

export interface DraftBoard {
  id?: number;
  league_id: string;
  user_id: string;
  generated_at?: string;
  league_snapshot_id?: number;
  prospect_evaluator_output_json?: unknown;
  franchise_strategist_output_json?: unknown;
  metagame_output_json?: unknown;
  synthesizer_output_json?: unknown;
  is_stale?: boolean;
}
