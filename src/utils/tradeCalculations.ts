import type { SleeperMatchup, SleeperDraftPick, SleeperDraft } from '../types/sleeper';
import type {
  TaggedTransaction,
  TradeAsset,
  TradeDraftPickAsset,
  TradeSide,
  AnalyzedTrade,
  ManagerTradeSummary,
  LeagueTradeAnalysis,
  SeasonTradeInput,
} from '../types/trade';
import { computePlayerSeasonPoints, assignGrade } from './draftCalculations';

// ---------- Cumulative points ----------

/**
 * Build cumulative points per player per week.
 * Returns Map<playerId, number[]> where arr[w] = total points through week w+1.
 * weeklyMatchups[0] = week 1 matchups, etc.
 */
export function buildCumulativePoints(
  weeklyMatchups: SleeperMatchup[][],
): Map<string, number[]> {
  const result = new Map<string, number[]>();
  const totalWeeks = weeklyMatchups.length;

  for (let w = 0; w < totalWeeks; w++) {
    for (const matchup of weeklyMatchups[w]) {
      for (const [playerId, pts] of Object.entries(matchup.players_points ?? {})) {
        let arr = result.get(playerId);
        if (!arr) {
          arr = new Array(totalWeeks).fill(0);
          result.set(playerId, arr);
        }
        // Add this week's points to this index and all subsequent
        arr[w] += pts;
      }
    }
  }

  // Convert per-week points to cumulative
  for (const arr of result.values()) {
    for (let w = 1; w < totalWeeks; w++) {
      arr[w] += arr[w - 1];
    }
  }

  return result;
}

/**
 * Get points scored by a player AFTER a given week.
 * If tradeWeek <= 0 (preseason), returns full season total.
 * If tradeWeek >= totalWeeks, returns 0.
 */
export function getPostTradePoints(
  playerId: string,
  tradeWeek: number,
  cumulativePoints: Map<string, number[]>,
  seasonTotalPoints: Map<string, number>,
): number {
  const total = seasonTotalPoints.get(playerId) ?? 0;
  if (tradeWeek <= 0) return total;

  const cum = cumulativePoints.get(playerId);
  if (!cum) return 0;
  if (tradeWeek > cum.length) return 0;

  // Points through end of tradeWeek (1-indexed: tradeWeek 1 → index 0)
  const pointsThrough = cum[tradeWeek - 1] ?? 0;
  return Math.max(0, total - pointsThrough);
}

// ---------- Draft pick resolution ----------

/**
 * Compute the original slot owner's roster_id for a draft pick.
 * Key insight: in dynasty leagues, roster IDs carry over between seasons, so
 * TradedDraftPick.roster_id (from the trading league) reliably matches the
 * original slot owner's roster_id in the drafting league — even when that
 * manager left the league and was replaced by a new user inheriting the same roster.
 *
 * Resolution order: slot_to_roster_id → invert draft_order → fallback to drafter's roster.
 */
function getOriginalRosterId(
  pick: SleeperDraftPick,
  draft: SleeperDraft,
  rosterToUser: Map<number, string>,
): number {
  const numTeams = draft.settings?.teams;
  if (!numTeams) return pick.roster_id;

  const posInRound = ((pick.pick_no - 1) % numTeams) + 1; // 1-indexed position within round
  const round = Math.ceil(pick.pick_no / numTeams);
  const slot = (draft.type === 'snake' && round % 2 === 0)
    ? numTeams - posInRound + 1
    : posInRound;

  // Try slot_to_roster_id (maps slot → roster_id directly)
  const slotMap = draft.slot_to_roster_id as Record<string, number> | null | undefined;
  if (slotMap) {
    const originalRosterId = slotMap[slot.toString()];
    if (originalRosterId) return originalRosterId;
  }

  // Try draft_order (user_id → slot_number) — invert to find roster at this slot
  const draftOrder = draft.draft_order as Record<string, number> | null | undefined;
  if (draftOrder) {
    const userToRoster = new Map<string, number>();
    for (const [rid, uid] of rosterToUser.entries()) userToRoster.set(uid, rid);
    for (const [userId, userSlot] of Object.entries(draftOrder)) {
      if (userSlot === slot) {
        const rosterId = userToRoster.get(userId);
        if (rosterId !== undefined) return rosterId;
      }
    }
  }

  // Fallback: drafter's roster (only correct when pick was not traded before the draft)
  return pick.roster_id;
}

export function buildDraftPickResolution(
  drafts: Array<{
    season: string;
    picks: SleeperDraftPick[];
    playerSeasonPoints: Map<string, number>;
    draft: SleeperDraft;
    rosterToUser: Map<number, string>;
  }>,
  playerMap: Map<string, { name: string; position: string }>,
): Map<string, { playerId: string; playerName: string; position: string; seasonPoints: number; pickInRound: number | null }> {
  const resolution = new Map<string, { playerId: string; playerName: string; position: string; seasonPoints: number; pickInRound: number | null }>();

  for (const { season, picks, playerSeasonPoints, draft, rosterToUser } of drafts) {
    const numTeams = draft.settings?.teams;
    for (const pick of picks) {
      const playerName = `${pick.metadata.first_name ?? ''} ${pick.metadata.last_name ?? ''}`.trim()
        || playerMap.get(pick.player_id)?.name
        || pick.player_id;
      const position = pick.metadata.position || playerMap.get(pick.player_id)?.position || '';
      const seasonPts = playerSeasonPoints.get(pick.player_id) ?? 0;
      const pickInRound = numTeams ? ((pick.pick_no - 1) % numTeams) + 1 : null;

      const originalRosterId = getOriginalRosterId(pick, draft, rosterToUser);
      const key = `${season}:${pick.round}:${originalRosterId}`;
      resolution.set(key, {
        playerId: pick.player_id,
        playerName,
        position,
        seasonPoints: seasonPts,
        pickInRound,
      });
    }
  }

  return resolution;
}

// ---------- Single trade analysis ----------

/**
 * Analyze a single trade transaction into an AnalyzedTrade.
 */
export function analyzeTrade(
  trade: TaggedTransaction,
  cumulativePoints: Map<string, number[]>,
  seasonTotalPoints: Map<string, number>,
  playerMap: Map<string, { name: string; position: string }>,
  rosterToUser: Map<number, string>,
  userInfo: Map<string, { displayName: string; avatar: string | null }>,
  draftPickResolution: Map<string, { playerId: string; playerName: string; position: string; seasonPoints: number; pickInRound: number | null }>,
): AnalyzedTrade {
  const rosterIds = trade.roster_ids;
  let hasUnresolved = false;

  // Build per-roster assets
  const sideMap = new Map<number, {
    received: TradeAsset[];
    sent: TradeAsset[];
    picksReceived: TradeDraftPickAsset[];
    picksSent: TradeDraftPickAsset[];
  }>();

  for (const rid of rosterIds) {
    sideMap.set(rid, { received: [], sent: [], picksReceived: [], picksSent: [] });
  }

  // Players: use adds to determine receiver, drops to determine sender
  if (trade.adds) {
    for (const [playerId, receivingRosterId] of Object.entries(trade.adds)) {
      const player = playerMap.get(playerId);
      const playerName = player?.name ?? `ID:${playerId.slice(-6)}`;
      const position = player?.position ?? 'UNK';
      const pts = getPostTradePoints(playerId, trade.sourceWeek, cumulativePoints, seasonTotalPoints);

      const asset: TradeAsset = { playerId, playerName, position, postTradePoints: pts };

      // Add as received for the receiving roster
      sideMap.get(receivingRosterId)?.received.push(asset);

      // Add as sent for the other roster(s)
      // Use drops to find sender if available, otherwise attribute to other roster(s)
      let senderId: number | null = null;
      if (trade.drops && trade.drops[playerId] != null) {
        senderId = trade.drops[playerId];
      } else {
        // For 2-team trades, the sender is the other roster
        const others = rosterIds.filter((r) => r !== receivingRosterId);
        if (others.length === 1) senderId = others[0];
      }

      if (senderId != null) {
        sideMap.get(senderId)?.sent.push(asset);
      }
    }
  }

  // Draft picks
  if (trade.draft_picks) {
    for (const pick of trade.draft_picks) {
      const receiverId = pick.owner_id;
      const senderId = pick.previous_owner_id;

      // Resolve the pick using roster_id as the key.
      // TradedDraftPick.roster_id = the original slot owner's roster in the trading league.
      // Dynasty leagues carry roster IDs between seasons, so this matches the
      // original slot owner's roster_id in the drafting league's resolution map.
      const resolutionKey = `${pick.season}:${pick.round}:${pick.roster_id}`;
      const resolved = draftPickResolution.get(resolutionKey);

      const pickAsset: TradeDraftPickAsset = resolved
        ? {
            season: pick.season,
            round: pick.round,
            pickInRound: resolved.pickInRound,
            draftedPlayerId: resolved.playerId,
            draftedPlayerName: resolved.playerName,
            draftedPlayerPosition: resolved.position || null,
            postTradePoints: resolved.seasonPoints,
            status: 'resolved',
          }
        : {
            season: pick.season,
            round: pick.round,
            pickInRound: null,
            draftedPlayerId: null,
            draftedPlayerName: null,
            draftedPlayerPosition: null,
            postTradePoints: 0,
            status: 'unresolved',
          };

      if (!resolved) hasUnresolved = true;

      sideMap.get(receiverId)?.picksReceived.push(pickAsset);
      sideMap.get(senderId)?.picksSent.push(pickAsset);
    }
  }

  // Build TradeSide for each roster
  const sides: TradeSide[] = rosterIds.map((rid) => {
    const data = sideMap.get(rid)!;
    const userId = rosterToUser.get(rid) ?? '';
    const info = userInfo.get(userId);
    const displayName = info?.displayName ?? `Team ${rid}`;

    const receivedPlayerPts = data.received.reduce((s, a) => s + a.postTradePoints, 0);
    const receivedPickPts = data.picksReceived.reduce((s, p) => s + p.postTradePoints, 0);
    const sentPlayerPts = data.sent.reduce((s, a) => s + a.postTradePoints, 0);
    const sentPickPts = data.picksSent.reduce((s, p) => s + p.postTradePoints, 0);

    const totalValueReceived = receivedPlayerPts + receivedPickPts;
    const totalValueSent = sentPlayerPts + sentPickPts;

    return {
      rosterId: rid,
      userId,
      displayName,
      assetsReceived: data.received,
      picksReceived: data.picksReceived,
      assetsSent: data.sent,
      picksSent: data.picksSent,
      totalValueReceived,
      totalValueSent,
      netValue: totalValueReceived - totalValueSent,
    };
  });

  return {
    transactionId: trade.transaction_id,
    season: trade.season,
    leagueId: trade.leagueId,
    week: trade.sourceWeek,
    timestamp: trade.created,
    sides,
    hasUnresolved,
  };
}

// ---------- Main orchestrator ----------

export function computeLeagueTradeAnalysis(
  seasonData: SeasonTradeInput[],
): LeagueTradeAnalysis {
  if (seasonData.length === 0 || seasonData.every((s) => s.trades.length === 0)) {
    return {
      managerSummaries: new Map(),
      allTrades: [],
      biggestWinAllTime: null,
      biggestLossAllTime: null,
      mostActiveTrader: null,
      hasData: false,
    };
  }

  const allAnalyzedTrades: AnalyzedTrade[] = [];

  for (const sd of seasonData) {
    const cumulativePoints = buildCumulativePoints(sd.weeklyMatchups);
    const seasonTotalPoints = computePlayerSeasonPoints(sd.weeklyMatchups);

    for (const trade of sd.trades) {
      const analyzed = analyzeTrade(
        trade,
        cumulativePoints,
        seasonTotalPoints,
        sd.playerMap,
        sd.rosterToUser,
        sd.userInfo,
        sd.draftPickResolution,
      );
      allAnalyzedTrades.push(analyzed);
    }
  }

  // Sort newest first
  allAnalyzedTrades.sort((a, b) => b.timestamp - a.timestamp);

  // Collect all user info
  const allUserInfo = new Map<string, { displayName: string; avatar: string | null }>();
  for (const sd of seasonData) {
    for (const [uid, info] of sd.userInfo) {
      if (!allUserInfo.has(uid)) allUserInfo.set(uid, info);
    }
  }

  // Aggregate per manager
  const tradesByUser = new Map<string, { trades: AnalyzedTrade[]; sides: TradeSide[] }>();

  for (const trade of allAnalyzedTrades) {
    for (const side of trade.sides) {
      if (!side.userId) continue;
      let entry = tradesByUser.get(side.userId);
      if (!entry) {
        entry = { trades: [], sides: [] };
        tradesByUser.set(side.userId, entry);
      }
      entry.trades.push(trade);
      entry.sides.push(side);
    }
  }

  // Build raw summaries (without grades)
  const rawSummaries: Array<{
    userId: string;
    totalNetValue: number;
    summary: Omit<ManagerTradeSummary, 'grade' | 'gradeColor' | 'netValuePercentile' | 'leagueRank'>;
  }> = [];

  for (const [userId, { trades, sides }] of tradesByUser) {
    const info = allUserInfo.get(userId) ?? { displayName: userId, avatar: null };
    const totalNetValue = sides.reduce((s, side) => s + side.netValue, 0);

    // Win/loss counting (only resolved trades)
    let wins = 0;
    let losses = 0;
    for (const side of sides) {
      // Find the trade to check if it's unresolved
      const trade = trades.find((t) => t.sides.includes(side));
      if (trade?.hasUnresolved) continue;
      if (side.netValue > 0) wins++;
      else if (side.netValue < 0) losses++;
    }
    const tradeWinRate = wins + losses > 0 ? wins / (wins + losses) : 0;

    // Biggest win/loss
    let biggestWin: ManagerTradeSummary['biggestWin'] = null;
    let biggestLoss: ManagerTradeSummary['biggestLoss'] = null;
    for (let i = 0; i < trades.length; i++) {
      const netVal = sides[i].netValue;
      if (biggestWin === null || netVal > biggestWin.netValue) {
        biggestWin = { trade: trades[i], netValue: netVal };
      }
      if (biggestLoss === null || netVal < biggestLoss.netValue) {
        biggestLoss = { trade: trades[i], netValue: netVal };
      }
    }

    // Most frequent trade partner
    const partnerCounts = new Map<string, number>();
    for (const trade of trades) {
      for (const side of trade.sides) {
        if (side.userId && side.userId !== userId) {
          partnerCounts.set(side.userId, (partnerCounts.get(side.userId) ?? 0) + 1);
        }
      }
    }
    let mostFrequentPartner: ManagerTradeSummary['mostFrequentPartner'] = null;
    for (const [partnerId, count] of partnerCounts) {
      if (!mostFrequentPartner || count > mostFrequentPartner.count) {
        const partnerInfo = allUserInfo.get(partnerId);
        mostFrequentPartner = {
          userId: partnerId,
          displayName: partnerInfo?.displayName ?? partnerId,
          count,
        };
      }
    }

    rawSummaries.push({
      userId,
      totalNetValue,
      summary: {
        userId,
        displayName: info.displayName,
        avatar: info.avatar,
        totalNetValue,
        tradeWinRate,
        totalTrades: trades.length,
        avgValuePerTrade: trades.length > 0 ? totalNetValue / trades.length : 0,
        biggestWin,
        biggestLoss,
        mostFrequentPartner,
        trades,
      },
    });
  }

  // Assign grades by totalNetValue percentile
  const sorted = [...rawSummaries].sort((a, b) => b.totalNetValue - a.totalNetValue);
  const n = sorted.length;

  const managerSummaries = new Map<string, ManagerTradeSummary>();

  // Track league-wide superlatives
  let biggestWinAllTime: LeagueTradeAnalysis['biggestWinAllTime'] = null;
  let biggestLossAllTime: LeagueTradeAnalysis['biggestLossAllTime'] = null;
  let mostActiveTrader: LeagueTradeAnalysis['mostActiveTrader'] = null;

  sorted.forEach((entry, idx) => {
    const leagueRank = idx + 1;
    const netValuePercentile = n === 1 ? 100 : ((n - idx - 1) / (n - 1)) * 100;
    const { grade, gradeColor } = assignGrade(netValuePercentile);

    const fullSummary: ManagerTradeSummary = {
      ...entry.summary,
      grade,
      gradeColor,
      netValuePercentile,
      leagueRank,
    };

    managerSummaries.set(entry.userId, fullSummary);

    // League superlatives
    if (fullSummary.biggestWin) {
      if (!biggestWinAllTime || fullSummary.biggestWin.netValue > biggestWinAllTime.netValue) {
        biggestWinAllTime = {
          userId: entry.userId,
          displayName: fullSummary.displayName,
          trade: fullSummary.biggestWin.trade,
          netValue: fullSummary.biggestWin.netValue,
        };
      }
    }
    if (fullSummary.biggestLoss) {
      if (!biggestLossAllTime || fullSummary.biggestLoss.netValue < biggestLossAllTime.netValue) {
        biggestLossAllTime = {
          userId: entry.userId,
          displayName: fullSummary.displayName,
          trade: fullSummary.biggestLoss.trade,
          netValue: fullSummary.biggestLoss.netValue,
        };
      }
    }
    if (!mostActiveTrader || fullSummary.totalTrades > mostActiveTrader.count) {
      mostActiveTrader = {
        userId: entry.userId,
        displayName: fullSummary.displayName,
        count: fullSummary.totalTrades,
      };
    }
  });

  return {
    managerSummaries,
    allTrades: allAnalyzedTrades,
    biggestWinAllTime,
    biggestLossAllTime,
    mostActiveTrader,
    hasData: allAnalyzedTrades.length > 0,
  };
}
