import type { SleeperTransaction } from './sleeper';

/** A transaction tagged with context from the fetch loop */
export interface TaggedTransaction extends SleeperTransaction {
  sourceWeek: number;
  season: string;
  leagueId: string;
}

/** A player asset in a trade with computed post-trade value */
export interface TradeAsset {
  playerId: string;
  playerName: string;
  position: string;
  postTradePoints: number;
}

/** A draft pick asset in a trade */
export interface TradeDraftPickAsset {
  season: string;
  round: number;
  draftedPlayerId: string | null;
  draftedPlayerName: string | null;
  postTradePoints: number;
  status: 'resolved' | 'unresolved';
}

/** One side of a trade from a specific manager's perspective */
export interface TradeSide {
  rosterId: number;
  userId: string;
  displayName: string;
  assetsReceived: TradeAsset[];
  picksReceived: TradeDraftPickAsset[];
  assetsSent: TradeAsset[];
  picksSent: TradeDraftPickAsset[];
  totalValueReceived: number;
  totalValueSent: number;
  netValue: number;
}

/** A fully analyzed trade */
export interface AnalyzedTrade {
  transactionId: string;
  season: string;
  leagueId: string;
  week: number;
  timestamp: number;
  sides: TradeSide[];
  hasUnresolved: boolean;
}

/** Per-manager aggregate trade stats */
export interface ManagerTradeSummary {
  userId: string;
  displayName: string;
  avatar: string | null;
  totalNetValue: number;
  tradeWinRate: number;
  totalTrades: number;
  avgValuePerTrade: number;
  biggestWin: { trade: AnalyzedTrade; netValue: number } | null;
  biggestLoss: { trade: AnalyzedTrade; netValue: number } | null;
  mostFrequentPartner: { userId: string; displayName: string; count: number } | null;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  gradeColor: string;
  netValuePercentile: number;
  leagueRank: number;
  trades: AnalyzedTrade[];
}

/** League-wide trade analysis result */
export interface LeagueTradeAnalysis {
  managerSummaries: Map<string, ManagerTradeSummary>;
  allTrades: AnalyzedTrade[];
  biggestWinAllTime: { userId: string; displayName: string; trade: AnalyzedTrade; netValue: number } | null;
  biggestLossAllTime: { userId: string; displayName: string; trade: AnalyzedTrade; netValue: number } | null;
  mostActiveTrader: { userId: string; displayName: string; count: number } | null;
  hasData: boolean;
}

/** Input shape for a single season's trade data */
export interface SeasonTradeInput {
  season: string;
  leagueId: string;
  trades: TaggedTransaction[];
  weeklyMatchups: import('./sleeper').SleeperMatchup[][];
  rosterToUser: Map<number, string>;
  userInfo: Map<string, { displayName: string; avatar: string | null }>;
  playerMap: Map<string, { name: string; position: string }>;
  draftPickResolution: Map<string, { playerId: string; playerName: string; seasonPoints: number }>;
}
