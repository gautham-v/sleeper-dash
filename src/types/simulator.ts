import type { FranchiseTier, StrategyMode, FranchiseOutlookResult } from './sleeper';

export interface SimulatorPlayerAsset {
  playerId: string;
  name: string;
  position: string;
  age: number | null;
  war: number;
  dynastyValue: number | null;
  ownerUserId: string;
  ownerRosterId: number;
}

export interface SimulatorPickAsset {
  /** Original slot owner — uniquely identifies this pick within a season+round */
  rosterId: number;
  /** Current owner's roster ID */
  ownerRosterId: number;
  ownerUserId: string;
  season: string;
  round: number;
  /** Human-readable label, e.g. "2026 Rd 1" */
  displayLabel: string;
}

export interface TradeDelta {
  warChange: number;
  peakYearChange: number;
  windowChange: number;
  weightedAgeChange: number;
  tierChange: { from: FranchiseTier; to: FranchiseTier } | null;
  strategyModeChange: { from: StrategyMode; to: StrategyMode } | null;
}

export interface TradeSimulatorSelection {
  givePlayers: string[];
  givePicks: SimulatorPickAsset[];
  receivePlayers: string[];
  receivePicks: SimulatorPickAsset[];
}

export interface ManagerOption {
  userId: string;
  rosterId: number;
  displayName: string;
  avatar: string | null;
}

export interface TradeSimulatorResult {
  // Before/after for the simulator's primary user
  myBefore: FranchiseOutlookResult | null;
  myAfter: FranchiseOutlookResult | null;
  myDelta: TradeDelta | null;

  // Phase 2: counterparty before/after
  theirBefore: FranchiseOutlookResult | null;
  theirAfter: FranchiseOutlookResult | null;
  theirDelta: TradeDelta | null;

  isRecalculating: boolean;
  /** True when at least one asset has been selected on either side */
  hasSelection: boolean;

  // Available assets for selection
  myAvailablePlayers: SimulatorPlayerAsset[];
  myAvailablePicks: SimulatorPickAsset[];
  counterpartyAvailablePlayers: SimulatorPlayerAsset[];
  counterpartyAvailablePicks: SimulatorPickAsset[];

  // League managers list (for counterparty picker)
  managers: ManagerOption[];

  // State
  counterpartyUserId: string | null;
  selection: TradeSimulatorSelection;

  // Actions
  setCounterparty: (userId: string | null) => void;
  toggleGivePlayer: (playerId: string) => void;
  toggleGivePick: (pick: SimulatorPickAsset) => void;
  toggleReceivePlayer: (playerId: string) => void;
  toggleReceivePick: (pick: SimulatorPickAsset) => void;
  clearAll: () => void;
}
