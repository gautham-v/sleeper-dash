export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  sport: string;
  status: string;
  total_rosters: number;
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  settings: {
    playoff_week_start: number;
    leg: number;
    num_teams: number;
  };
  avatar: string | null;
  previous_league_id: string | null;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  league_id: string;
  players: string[] | null;
  starters: string[] | null;
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal: number;
    fpts_against: number;
    fpts_against_decimal: number;
    total_moves: number;
    waiver_budget_used: number;
  };
  metadata?: {
    streak?: string;
    record?: string;
  };
}

export interface SleeperLeagueUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata: {
    team_name?: string;
  };
  league_id: string;
  is_owner?: boolean;
}

export interface SleeperMatchup {
  matchup_id: number;
  roster_id: number;
  players: string[] | null;
  starters: string[] | null;
  points: number;
  custom_points: number | null;
  players_points?: Record<string, number>;
}

export interface SleeperTransaction {
  transaction_id: string;
  type: 'trade' | 'free_agent' | 'waiver';
  status: string;
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: TradedDraftPick[];
  created: number;
  metadata: {
    notes?: string;
  } | null;
}

export interface TradedDraftPick {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  season: string;
  type: string;
  status: string;
  start_time: number;
  settings: {
    rounds: number;
    teams: number;
    pick_timer: number;
  };
  slot_to_roster_id: Record<string, number>;
  draft_order: Record<string, number> | null;
}

export interface SleeperDraftPick {
  pick_no: number;
  round: number;
  roster_id: number;
  player_id: string;
  picked_by: string;
  metadata: {
    first_name: string;
    last_name: string;
    position: string;
    team: string;
    years_exp: string;
    number: string;
    slot_name?: string;
    injury_status?: string;
  };
  draft_id: string;
  is_keeper: boolean | null;
}

export interface SleeperNFLState {
  week: number;
  season: string;
  season_type: string;
  display_week: number;
  previous_season: string;
}

export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  team: string | null;
  age?: number;
}

// Historical / comparison types
export type TeamTier = 'Elite' | 'Contender' | 'Average' | 'Rebuilding' | 'Cellar Dweller';

export interface HistoricalSeason {
  season: string;
  leagueId: string;
  teams: Map<string, {
    userId: string;
    rosterId: number;
    teamName: string;
    displayName: string;
    avatar: string | null;
    wins: number;
    losses: number;
    pointsFor: number;
    rank: number;
  }>;
  matchups: WeeklyMatchup[];
  rosterToUser: Map<number, string>; // rosterId -> userId
  championUserId: string | null;
  /** Maps userId -> playoff finish label, e.g. "Won Championship", "Runner-Up", "Lost Semi-Final" */
  playoffFinishByUserId: Map<string, string>;
}

export interface TeamAllTimeStats {
  userId: string;
  displayName: string;
  avatar: string | null;
  totalWins: number;
  totalLosses: number;
  totalSeasons: number;
  titles: number;
  avgPointsFor: number;
  winPct: number;
  playoffWins: number;
  playoffLosses: number;
  tier: TeamTier;
  seasons: {
    season: string;
    wins: number;
    losses: number;
    pointsFor: number;
    rank: number;
    playoffWins: number;
    playoffLosses: number;
  }[];
}

export interface H2HRecord {
  teamAWins: number;
  teamBWins: number;
  teamAPoints: number;
  teamBPoints: number;
  playoffAWins: number;
  playoffBWins: number;
  games: {
    season: string;
    week: number;
    teamAPoints: number;
    teamBPoints: number;
    winner: 'A' | 'B' | 'tie';
    isPlayoff: boolean;
  }[];
}

// Computed types for our dashboard
export interface TeamStanding {
  rosterId: number;
  userId: string;
  teamName: string;
  displayName: string;
  avatar: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsForDecimal: number;
  streak?: string;
  playoffWins?: number;
  playoffLosses?: number;
}

export interface WeeklyMatchup {
  week: number;
  matchupId: number;
  team1: {
    rosterId: number;
    points: number;
  };
  team2: {
    rosterId: number;
    points: number;
  };
  margin: number;
  isPlayoff: boolean;
}

export interface PowerRanking {
  rosterId: number;
  userId: string;
  teamName: string;
  displayName: string;
  avatar: string | null;
  rank: number;
  previousRank?: number;
  score: number;
  recentAvg: number;
  seasonAvg: number;
  winPct: number;
}

export interface LuckEntry {
  rosterId: number;
  userId: string;
  teamName: string;
  displayName: string;
  avatar: string | null;
  actualWins: number;
  expectedWins: number;
  luckScore: number;
}

export interface YearOverYearEntry {
  userId: string;
  displayName: string;
  seasons: {
    season: string;
    wins: number;
    losses: number;
    pointsFor: number;
    rank: number;
  }[];
}

export interface BracketMatch {
  r: number;
  m: number;
  t1?: number | null;
  t2?: number | null;
  w?: number | null;
  l?: number | null;
  p?: number | null;
}

export interface SeasonTeamRecord {
  displayName: string;
  teamName: string;
  wins: number;
  losses: number;
  pointsFor: number;
}

export interface SeasonGameRecord {
  week: number;
  winnerName: string;
  loserName: string;
  winnerPts: number;
  loserPts: number;
  margin: number;
  isPlayoff?: boolean;
}

export interface SeasonScoreRecord {
  week: number;
  teamName: string;
  points: number;
  isPlayoff?: boolean;
}

export interface LeagueSeasonRecord {
  season: string;
  champion: SeasonTeamRecord | null;
  lastPlace: SeasonTeamRecord | null;
  highestScoringTeam: SeasonTeamRecord | null;
  lowestScoringTeam: SeasonTeamRecord | null;
  biggestBlowout: SeasonGameRecord | null;
  highestWeeklyScore: SeasonScoreRecord | null;
  lowestWeeklyScore: SeasonScoreRecord | null;
}

export interface AllTimeRecordEntry {
  id: string;
  category: string;
  holderId: string | null;
  holder: string;
  avatar: string | null;
  value: string;
  rawValue: number;
  context: string;
  season?: string;
  week?: number;
  coHolders?: Array<{ holderId: string | null; holder: string; avatar: string | null }>;
}

// ---- Draft Analysis Types ----

export interface AnalyzedPick {
  pickNo: number;
  round: number;
  playerName: string;
  playerId: string;
  position: string;
  isKeeper: boolean;
  season: string;
  seasonPoints: number;
  replacementLevel: number;
  war: number;
  expectedWar: number;
  surplus: number;
  hitBust: 'hit' | 'bust' | 'neutral';
}

export interface DraftClassSeason {
  season: string;
  picks: AnalyzedPick[];
  avgSurplus: number;
  hitRate: number;
  bustRate: number;
  totalWAR: number;
}

export interface ManagerDraftSummary {
  userId: string;
  displayName: string;
  avatar: string | null;
  totalWAR: number;
  totalSurplus: number;
  avgSurplusPerPick: number;
  hitRate: number;
  bustRate: number;
  bestPick: AnalyzedPick | null;
  worstPick: AnalyzedPick | null;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  gradeColor: string;
  surplusPercentile: number;
  leagueRank: number;
  draftClasses: DraftClassSeason[];
}

export interface LeagueDraftAnalysis {
  managerSummaries: Map<string, ManagerDraftSummary>;
  surplusByUserId: Map<string, number>;
  hasData: boolean;
}

export interface BlowoutGame {
  week: number;
  season?: string;
  winner: { rosterId: number; userId?: string; teamName: string; points: number };
  loser: { rosterId: number; userId?: string; teamName: string; points: number };
  margin: number;
  isPlayoff: boolean;
}

// ---- Franchise Outlook Types ----

export type FranchiseTier = 'Contender' | 'Fringe' | 'Rebuilding';
export type AgeCategory = 'Young' | 'Prime' | 'Aging';
export type RiskCategory = 'Low' | 'Moderate' | 'High' | 'Extreme';

export interface FranchiseOutlookResult {
  weightedAge: number;
  ageCategory: AgeCategory;
  leagueAgePercentile: number;
  riskScore: number;
  riskCategory: RiskCategory;
  currentWAR: number;
  projectedWAR: { yearOffset: number; totalWAR: number }[];
  contenderThreshold: number;
  leagueMedianWAR: number;
  windowLength: number;
  currentlyContender: boolean;
  peakYearOffset: number;
  peakWAR: number;
  tier: FranchiseTier;
  warByAgeBucket: { bucket: string; war: number }[];
}
