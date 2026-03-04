'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { computeFranchiseOutlook, computeAllTeamWeightedAges } from '../utils/franchiseOutlook';
import type {
  FranchiseOutlookRawContext,
  FranchiseOutlookResult,
  SleeperRoster,
  FutureDraftPick,
  SleeperPlayer,
} from '../types/sleeper';
import type {
  TradeSimulatorResult,
  TradeSimulatorSelection,
  SimulatorPlayerAsset,
  SimulatorPickAsset,
  TradeDelta,
  ManagerOption,
} from '../types/simulator';

const CURVE_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

// ── Helpers ───────────────────────────────────────────────────────────────────

function computePositionWAR(
  playerIds: string[],
  allPlayers: Record<string, SleeperPlayer>,
  playerWARMap: Map<string, number>,
): Map<string, number> {
  const posWAR = new Map<string, number>([['QB', 0], ['RB', 0], ['WR', 0], ['TE', 0]]);
  for (const pid of playerIds) {
    const pos = allPlayers[pid]?.position ?? '';
    if (!CURVE_POSITIONS.has(pos)) continue;
    posWAR.set(pos, (posWAR.get(pos) ?? 0) + (playerWARMap.get(pid) ?? 0));
  }
  return posWAR;
}

function recomputePositionRanks(
  rosters: SleeperRoster[],
  teamPositionWAR: Map<number, Map<string, number>>,
): Map<number, Map<string, number>> {
  const result = new Map<number, Map<string, number>>();
  for (const pos of ['QB', 'RB', 'WR', 'TE']) {
    const sorted = [...rosters].sort(
      (a, b) => (teamPositionWAR.get(b.roster_id)?.get(pos) ?? 0) - (teamPositionWAR.get(a.roster_id)?.get(pos) ?? 0),
    );
    sorted.forEach((r, i) => {
      const m = result.get(r.roster_id) ?? new Map<string, number>();
      m.set(pos, i + 1);
      result.set(r.roster_id, m);
    });
  }
  return result;
}

function recomputeWarRanks(
  rosters: SleeperRoster[],
  allTeamWARs: number[],
): Map<number, number> {
  const withWAR = rosters.map((r, i) => ({ rosterId: r.roster_id, war: allTeamWARs[i] }));
  withWAR.sort((a, b) => b.war - a.war);
  return new Map(withWAR.map((r, i) => [r.rosterId, i + 1]));
}

function computeDelta(before: FranchiseOutlookResult, after: FranchiseOutlookResult): TradeDelta {
  return {
    warChange: Math.round((after.currentWAR - before.currentWAR) * 10) / 10,
    peakYearChange: after.peakYearOffset - before.peakYearOffset,
    windowChange: after.windowLength - before.windowLength,
    weightedAgeChange: Math.round((after.weightedAge - before.weightedAge) * 10) / 10,
    tierChange: after.tier !== before.tier ? { from: before.tier, to: after.tier } : null,
    strategyModeChange:
      after.strategyRecommendation.mode !== before.strategyRecommendation.mode
        ? { from: before.strategyRecommendation.mode, to: after.strategyRecommendation.mode }
        : null,
  };
}

function pickKey(pick: SimulatorPickAsset): string {
  return `${pick.season}:${pick.round}:${pick.rosterId}`;
}

function futureDraftPickKey(pick: FutureDraftPick): string {
  return `${pick.season}:${pick.round}:${pick.roster_id}`;
}

// ── Simulation core ───────────────────────────────────────────────────────────

function runSimulation(
  myRosterId: number,
  counterpartyRosterId: number,
  selection: TradeSimulatorSelection,
  ctx: FranchiseOutlookRawContext,
): { myAfter: FranchiseOutlookResult; theirAfter: FranchiseOutlookResult } {
  const {
    allRosters, allPlayers, playerWARMap,
    isSeasonComplete, leagueAvgWARByPosition,
    userDisplayNames, userAvatars,
    teamPositionWAR, picksByRosterId,
    fcMap, rookiePool, winsRankByRoster,
  } = ctx;

  const myRoster = allRosters.find((r) => r.roster_id === myRosterId)!;
  const theirRoster = allRosters.find((r) => r.roster_id === counterpartyRosterId)!;

  const giveSet = new Set(selection.givePlayers);
  const receiveSet = new Set(selection.receivePlayers);
  const givePicks = new Set(selection.givePicks.map(pickKey));
  const receivePicks = new Set(selection.receivePicks.map(pickKey));

  // Modified player lists
  const myNewPlayers = [
    ...(myRoster.players ?? []).filter((pid) => !giveSet.has(pid)),
    ...selection.receivePlayers,
  ];
  const theirNewPlayers = [
    ...(theirRoster.players ?? []).filter((pid) => !receiveSet.has(pid)),
    ...selection.givePlayers,
  ];

  // Modified picks
  const myCurrentPicks = picksByRosterId.get(myRosterId) ?? [];
  const theirCurrentPicks = picksByRosterId.get(counterpartyRosterId) ?? [];

  const myNewPicks: FutureDraftPick[] = [
    ...myCurrentPicks.filter((p) => !givePicks.has(futureDraftPickKey(p))),
    ...selection.receivePicks.map((rp) => ({
      season: rp.season,
      round: rp.round,
      roster_id: rp.rosterId,
      previous_owner_id: rp.ownerRosterId,
      owner_id: myRosterId,
    })),
  ];
  const theirNewPicks: FutureDraftPick[] = [
    ...theirCurrentPicks.filter((p) => !receivePicks.has(futureDraftPickKey(p))),
    ...selection.givePicks.map((gp) => ({
      season: gp.season,
      round: gp.round,
      roster_id: gp.rosterId,
      previous_owner_id: gp.ownerRosterId,
      owner_id: counterpartyRosterId,
    })),
  ];

  // Modified SleeperRoster objects
  const myModifiedRoster: SleeperRoster = { ...myRoster, players: myNewPlayers };
  const theirModifiedRoster: SleeperRoster = { ...theirRoster, players: theirNewPlayers };

  // Modified team position WAR
  const modifiedTeamPositionWAR = new Map(
    [...teamPositionWAR].map(([k, v]) => [k, new Map(v)]),
  );
  modifiedTeamPositionWAR.set(myRosterId, computePositionWAR(myNewPlayers, allPlayers, playerWARMap));
  modifiedTeamPositionWAR.set(counterpartyRosterId, computePositionWAR(theirNewPlayers, allPlayers, playerWARMap));

  // Modified allTeamWARs
  const modifiedAllTeamWARs = allRosters.map((r) => {
    if (r.roster_id === myRosterId) {
      return myNewPlayers.reduce((sum, pid) => sum + (playerWARMap.get(pid) ?? 0), 0);
    }
    if (r.roster_id === counterpartyRosterId) {
      return theirNewPlayers.reduce((sum, pid) => sum + (playerWARMap.get(pid) ?? 0), 0);
    }
    return (r.players ?? []).reduce((sum, pid) => sum + (playerWARMap.get(pid) ?? 0), 0);
  });

  // Modified allTeamWeightedAges
  const modifiedRosters = allRosters.map((r) => {
    if (r.roster_id === myRosterId) return myModifiedRoster;
    if (r.roster_id === counterpartyRosterId) return theirModifiedRoster;
    return r;
  });
  const modifiedAllTeamWeightedAges = computeAllTeamWeightedAges(
    modifiedRosters,
    allPlayers,
    playerWARMap,
  );

  // Modified position ranks (leagueAvgWARByPosition is unchanged — same players, just redistributed)
  const modifiedPositionRanks = recomputePositionRanks(allRosters, modifiedTeamPositionWAR);
  const modifiedWarRanks = recomputeWarRanks(allRosters, modifiedAllTeamWARs);

  // Modified picksByRosterId
  const modifiedPicksByRosterId = new Map(picksByRosterId);
  modifiedPicksByRosterId.set(myRosterId, myNewPicks);
  modifiedPicksByRosterId.set(counterpartyRosterId, theirNewPicks);

  const myAfter = computeFranchiseOutlook(
    myModifiedRoster,
    allPlayers,
    playerWARMap,
    modifiedAllTeamWARs,
    modifiedAllTeamWeightedAges,
    myNewPicks,
    isSeasonComplete,
    leagueAvgWARByPosition,
    modifiedPositionRanks.get(myRosterId) ?? new Map(),
    modifiedWarRanks.get(myRosterId) ?? 1,
    winsRankByRoster.get(myRosterId) ?? 1,
    fcMap,
    rookiePool,
    modifiedRosters,
    userDisplayNames,
    userAvatars,
    modifiedTeamPositionWAR,
    modifiedPositionRanks,
    modifiedPicksByRosterId,
  );

  const theirAfter = computeFranchiseOutlook(
    theirModifiedRoster,
    allPlayers,
    playerWARMap,
    modifiedAllTeamWARs,
    modifiedAllTeamWeightedAges,
    theirNewPicks,
    isSeasonComplete,
    leagueAvgWARByPosition,
    modifiedPositionRanks.get(counterpartyRosterId) ?? new Map(),
    modifiedWarRanks.get(counterpartyRosterId) ?? 1,
    winsRankByRoster.get(counterpartyRosterId) ?? 1,
    fcMap,
    rookiePool,
    modifiedRosters,
    userDisplayNames,
    userAvatars,
    modifiedTeamPositionWAR,
    modifiedPositionRanks,
    modifiedPicksByRosterId,
  );

  return { myAfter, theirAfter };
}

// ── Available asset builders ──────────────────────────────────────────────────

function buildPlayerAssets(
  roster: SleeperRoster,
  allPlayers: Record<string, SleeperPlayer>,
  playerWARMap: Map<string, number>,
  fcMap: Map<string, number>,
): SimulatorPlayerAsset[] {
  const userId = roster.owner_id ?? '';
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
  return (roster.players ?? [])
    .map((pid) => {
      const p = allPlayers[pid];
      if (!p) return null;
      const pos = p.position ?? '';
      if (!CURVE_POSITIONS.has(pos)) return null;
      const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
      const fcKey = `${normalize(name)}:${pos}`;
      const dynastyValue = fcMap.get(pid) ?? fcMap.get(fcKey) ?? null;
      return {
        playerId: pid,
        name,
        position: pos,
        age: p.age ?? null,
        war: Math.round((playerWARMap.get(pid) ?? 0) * 10) / 10,
        dynastyValue,
        ownerUserId: userId,
        ownerRosterId: roster.roster_id,
      } satisfies SimulatorPlayerAsset;
    })
    .filter((x): x is SimulatorPlayerAsset => x !== null)
    .sort((a, b) => {
      const valA = a.dynastyValue ?? Math.max(a.war * 500, 0);
      const valB = b.dynastyValue ?? Math.max(b.war * 500, 0);
      return valB - valA;
    });
}

function buildPickAssets(
  rosterId: number,
  picks: FutureDraftPick[],
  userId: string,
): SimulatorPickAsset[] {
  return [...picks]
    .sort((a, b) => {
      if (a.season !== b.season) return Number(a.season) - Number(b.season);
      return a.round - b.round;
    })
    .map((p) => ({
      rosterId: p.roster_id,
      ownerRosterId: rosterId,
      ownerUserId: userId,
      season: p.season,
      round: p.round,
      displayLabel: `${p.season} Rd ${p.round}`,
    }));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const EMPTY_SELECTION: TradeSimulatorSelection = {
  givePlayers: [],
  givePicks: [],
  receivePlayers: [],
  receivePicks: [],
};

export function useTradeSimulator(
  userId: string,
  rawContext: FranchiseOutlookRawContext | null | undefined,
  beforeOutlook: FranchiseOutlookResult | null | undefined,
): TradeSimulatorResult {
  const [counterpartyUserId, setCounterpartyUserId] = useState<string | null>(null);
  const [selection, setSelection] = useState<TradeSimulatorSelection>(EMPTY_SELECTION);
  const [myAfter, setMyAfter] = useState<FranchiseOutlookResult | null>(null);
  const [theirBefore, setTheirBefore] = useState<FranchiseOutlookResult | null>(null);
  const [theirAfter, setTheirAfter] = useState<FranchiseOutlookResult | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recompute whenever selection or counterparty changes
  useEffect(() => {
    if (!rawContext || !beforeOutlook) return;

    const myRosterId = rawContext.allRosters.find((r) => r.owner_id === userId)?.roster_id;
    if (!myRosterId) return;

    const hasAssets =
      selection.givePlayers.length > 0 || selection.givePicks.length > 0 ||
      selection.receivePlayers.length > 0 || selection.receivePicks.length > 0;

    if (!hasAssets || !counterpartyUserId) {
      setMyAfter(null);
      setTheirAfter(null);
      return;
    }

    const cpRosterId = rawContext.allRosters.find((r) => r.owner_id === counterpartyUserId)?.roster_id;
    if (!cpRosterId) return;

    setIsRecalculating(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      try {
        const { myAfter: newMyAfter, theirAfter: newTheirAfter } = runSimulation(
          myRosterId,
          cpRosterId,
          selection,
          rawContext,
        );
        setMyAfter(newMyAfter);
        setTheirAfter(newTheirAfter);
      } catch (e) {
        console.error('Trade simulation error:', e);
      } finally {
        setIsRecalculating(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [userId, rawContext, beforeOutlook, selection, counterpartyUserId]);

  // Update theirBefore whenever counterparty changes
  useEffect(() => {
    if (!rawContext || !counterpartyUserId) {
      setTheirBefore(null);
      return;
    }
    const cpRosterId = rawContext.allRosters.find((r) => r.owner_id === counterpartyUserId)?.roster_id;
    if (!cpRosterId) return;

    const theirBefore = computeFranchiseOutlook(
      rawContext.allRosters.find((r) => r.roster_id === cpRosterId)!,
      rawContext.allPlayers,
      rawContext.playerWARMap,
      rawContext.allTeamWARs,
      rawContext.allTeamWeightedAges,
      rawContext.picksByRosterId.get(cpRosterId) ?? [],
      rawContext.isSeasonComplete,
      rawContext.leagueAvgWARByPosition,
      rawContext.positionRanksByRoster.get(cpRosterId) ?? new Map(),
      rawContext.warRankByRoster.get(cpRosterId) ?? 1,
      rawContext.winsRankByRoster.get(cpRosterId) ?? 1,
      rawContext.fcMap,
      rawContext.rookiePool,
      rawContext.allRosters,
      rawContext.userDisplayNames,
      rawContext.userAvatars,
      rawContext.teamPositionWAR,
      rawContext.positionRanksByRoster,
      rawContext.picksByRosterId,
    );
    setTheirBefore(theirBefore);
  }, [rawContext, counterpartyUserId]);

  // Available assets
  const myRoster = rawContext?.allRosters.find((r) => r.owner_id === userId);
  const cpRoster = rawContext?.allRosters.find((r) => r.owner_id === counterpartyUserId);

  const myAvailablePlayers: SimulatorPlayerAsset[] = myRoster && rawContext
    ? buildPlayerAssets(myRoster, rawContext.allPlayers, rawContext.playerWARMap, rawContext.fcMap)
    : [];

  const myAvailablePicks: SimulatorPickAsset[] = myRoster && rawContext
    ? buildPickAssets(myRoster.roster_id, rawContext.picksByRosterId.get(myRoster.roster_id) ?? [], userId)
    : [];

  const counterpartyAvailablePlayers: SimulatorPlayerAsset[] = cpRoster && rawContext
    ? buildPlayerAssets(cpRoster, rawContext.allPlayers, rawContext.playerWARMap, rawContext.fcMap)
    : [];

  const counterpartyAvailablePicks: SimulatorPickAsset[] = cpRoster && rawContext
    ? buildPickAssets(cpRoster.roster_id, rawContext.picksByRosterId.get(cpRoster.roster_id) ?? [], counterpartyUserId!)
    : [];

  // Managers list (exclude current user)
  const managers: ManagerOption[] = rawContext
    ? rawContext.allRosters
        .filter((r) => r.owner_id && r.owner_id !== userId)
        .map((r) => ({
          userId: r.owner_id!,
          rosterId: r.roster_id,
          displayName: rawContext.userDisplayNames.get(r.owner_id!) ?? 'Unknown',
          avatar: rawContext.userAvatars.get(r.owner_id!) ?? null,
        }))
    : [];

  // Deltas
  const myDelta = beforeOutlook && myAfter ? computeDelta(beforeOutlook, myAfter) : null;
  const theirDelta = theirBefore && theirAfter ? computeDelta(theirBefore, theirAfter) : null;

  const hasSelection =
    selection.givePlayers.length > 0 || selection.givePicks.length > 0 ||
    selection.receivePlayers.length > 0 || selection.receivePicks.length > 0;

  // Actions
  const setCounterparty = useCallback((uid: string | null) => {
    setCounterpartyUserId(uid);
    setSelection(EMPTY_SELECTION);
    setMyAfter(null);
    setTheirAfter(null);
  }, []);

  const toggleGivePlayer = useCallback((playerId: string) => {
    setSelection((prev) => ({
      ...prev,
      givePlayers: prev.givePlayers.includes(playerId)
        ? prev.givePlayers.filter((id) => id !== playerId)
        : [...prev.givePlayers, playerId],
    }));
  }, []);

  const toggleGivePick = useCallback((pick: SimulatorPickAsset) => {
    const key = pickKey(pick);
    setSelection((prev) => ({
      ...prev,
      givePicks: prev.givePicks.some((p) => pickKey(p) === key)
        ? prev.givePicks.filter((p) => pickKey(p) !== key)
        : [...prev.givePicks, pick],
    }));
  }, []);

  const toggleReceivePlayer = useCallback((playerId: string) => {
    setSelection((prev) => ({
      ...prev,
      receivePlayers: prev.receivePlayers.includes(playerId)
        ? prev.receivePlayers.filter((id) => id !== playerId)
        : [...prev.receivePlayers, playerId],
    }));
  }, []);

  const toggleReceivePick = useCallback((pick: SimulatorPickAsset) => {
    const key = pickKey(pick);
    setSelection((prev) => ({
      ...prev,
      receivePicks: prev.receivePicks.some((p) => pickKey(p) === key)
        ? prev.receivePicks.filter((p) => pickKey(p) !== key)
        : [...prev.receivePicks, pick],
    }));
  }, []);

  const clearAll = useCallback(() => {
    setSelection(EMPTY_SELECTION);
    setMyAfter(null);
    setTheirAfter(null);
    setIsRecalculating(false);
  }, []);

  return {
    myBefore: beforeOutlook ?? null,
    myAfter,
    myDelta,
    theirBefore,
    theirAfter,
    theirDelta,
    isRecalculating,
    hasSelection,
    myAvailablePlayers,
    myAvailablePicks,
    counterpartyAvailablePlayers,
    counterpartyAvailablePicks,
    managers,
    counterpartyUserId,
    selection,
    setCounterparty,
    toggleGivePlayer,
    toggleGivePick,
    toggleReceivePlayer,
    toggleReceivePick,
    clearAll,
  };
}
