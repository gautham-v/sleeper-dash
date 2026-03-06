/**
 * HTC Engine Calibration Script
 *
 * Fetches real Sleeper league data, runs the Hold/Trade/Cut engine,
 * and outputs a calibration report with verdict distributions,
 * archetype spot-checks, and flagged miscalibrations.
 *
 * Usage: npx tsx scripts/calibrate-htc.ts <leagueId>
 */

const BASE_URL = 'https://api.sleeper.app/v1';

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status} ${url}`);
  return res.json() as Promise<T>;
}

// --- Minimal type imports (avoid 'use client' issues) ---
import { computePlayerSeasonPoints } from '../src/utils/draftCalculations';
import { computeFranchiseOutlook, computeAllTeamWeightedAges } from '../src/utils/franchiseOutlook';
import { computePlayerRecommendations } from '../src/utils/playerRecommendations';
import { extractLeagueFormat } from '../src/utils/leagueFormat';
import type {
  SleeperLeague,
  SleeperRoster,
  SleeperLeagueUser,
  SleeperMatchup,
  SleeperPlayer,
  FutureDraftPick,
  FCPlayerEntry,
  FranchiseOutlookResult,
  FranchiseOutlookRawContext,
  PlayerRosterStat,
  PlayerUsageMetrics,
} from '../src/types/sleeper';
import type { PlayerRecommendation } from '../src/types/recommendations';

const CURVE_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);
const POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;

// ---- Replicate league-aware replacement level from useFranchiseOutlook ----

function computeLeagueAwareReplacementLevel(
  playerSeasonPoints: Map<string, number>,
  allPlayers: Record<string, SleeperPlayer>,
  rosterPositions: string[],
  numTeams: number,
): Map<string, number> {
  const startersPerPos = new Map<string, number>();
  for (const pos of rosterPositions) {
    if (CURVE_POSITIONS.has(pos)) {
      startersPerPos.set(pos, (startersPerPos.get(pos) ?? 0) + 1);
    } else if (pos === 'FLEX') {
      for (const p of ['RB', 'WR', 'TE']) startersPerPos.set(p, (startersPerPos.get(p) ?? 0) + 1);
    } else if (pos === 'SUPER_FLEX') {
      for (const p of ['QB', 'RB', 'WR', 'TE']) startersPerPos.set(p, (startersPerPos.get(p) ?? 0) + 1);
    }
  }

  const byPosition = new Map<string, number[]>();
  for (const [playerId, pts] of playerSeasonPoints) {
    const pos = allPlayers[playerId]?.position ?? '';
    if (!CURVE_POSITIONS.has(pos)) continue;
    const arr = byPosition.get(pos) ?? [];
    arr.push(pts);
    byPosition.set(pos, arr);
  }

  const result = new Map<string, number>();
  for (const [pos, values] of byPosition) {
    const sorted = [...values].sort((a, b) => b - a);
    const slots = startersPerPos.get(pos) ?? 0;
    const idx = numTeams * slots;
    result.set(pos, idx < sorted.length ? sorted[idx] : sorted[Math.floor(sorted.length / 2)]);
  }
  return result;
}

// ---- Replicate usage metrics extraction from useManagerRosterStats ----

function computeUsageMetrics(
  weekMatchups: SleeperMatchup[][],
  weekStats: Record<string, Record<string, number>>[],
  userRosterId: number,
): Map<string, PlayerUsageMetrics> {
  const weeklyUsage = new Map<string, {
    snapPcts: number[];
    targets: number[];
    rushAtts: number[];
    redZoneOpps: number;
    gamesPlayed: number;
  }>();
  const weekTeamTargets: number[] = [];
  const weekTeamRushAtts: number[] = [];

  for (let w = 0; w < weekMatchups.length; w++) {
    const matchups = weekMatchups[w];
    const stats = weekStats[w];
    const userMatchup = matchups.find(m => m.roster_id === userRosterId);
    if (!userMatchup || !userMatchup.players) continue;

    let teamTargets = 0;
    let teamRushAtts = 0;
    for (const pid of userMatchup.players) {
      const ps = stats[pid];
      if (ps) {
        teamTargets += (ps.rec_tgt ?? 0);
        teamRushAtts += (ps.rush_att ?? 0);
      }
    }
    weekTeamTargets.push(teamTargets);
    weekTeamRushAtts.push(teamRushAtts);

    for (const playerId of userMatchup.players) {
      const playerStats = stats[playerId];
      if (!playerStats) continue;
      if (!weeklyUsage.has(playerId)) {
        weeklyUsage.set(playerId, { snapPcts: [], targets: [], rushAtts: [], redZoneOpps: 0, gamesPlayed: 0 });
      }
      const usage = weeklyUsage.get(playerId)!;
      const offSnp = playerStats.off_snp ?? 0;
      const tmOffSnp = playerStats.tm_off_snp ?? 0;
      const snapPct = tmOffSnp > 0 ? offSnp / tmOffSnp : 0;
      const tgt = playerStats.rec_tgt ?? 0;
      const rushAtt = playerStats.rush_att ?? 0;
      const rzTgt = playerStats.rec_rz_tgt ?? 0;
      const rzRush = playerStats.rush_rz_att ?? 0;

      if (offSnp > 0 || tgt > 0 || rushAtt > 0) {
        usage.gamesPlayed += 1;
        usage.snapPcts.push(snapPct);
        usage.targets.push(tgt);
        usage.rushAtts.push(rushAtt);
        usage.redZoneOpps += rzTgt + rzRush;
      }
    }
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const RECENT_N = 4;
  const recentSlice = <T,>(arr: T[]) => arr.slice(-RECENT_N);

  const result = new Map<string, PlayerUsageMetrics>();
  for (const [playerId, wu] of weeklyUsage) {
    if (wu.gamesPlayed < 2) continue;
    const snapPct = avg(wu.snapPcts);
    const recentSnapPct = avg(recentSlice(wu.snapPcts));
    const snapDelta = recentSnapPct - snapPct;
    const snapTrend: 'rising' | 'stable' | 'declining' =
      snapDelta > 0.05 ? 'rising' : snapDelta < -0.05 ? 'declining' : 'stable';

    const seasonTeamTgtAvg = avg(weekTeamTargets);
    const targetShare = seasonTeamTgtAvg > 0 ? avg(wu.targets) / seasonTeamTgtAvg : 0;
    const recentTeamTgtAvg = avg(weekTeamTargets.slice(-RECENT_N));
    const recentTargetShare = recentTeamTgtAvg > 0 ? avg(recentSlice(wu.targets)) / recentTeamTgtAvg : 0;

    const seasonTeamRushAvg = avg(weekTeamRushAtts);
    const rushShare = seasonTeamRushAvg > 0 ? avg(wu.rushAtts) / seasonTeamRushAvg : 0;
    const recentTeamRushAvg = avg(weekTeamRushAtts.slice(-RECENT_N));
    const recentRushShare = recentTeamRushAvg > 0 ? avg(recentSlice(wu.rushAtts)) / recentTeamRushAvg : 0;

    result.set(playerId, {
      snapPct: Math.round(snapPct * 1000) / 1000,
      recentSnapPct: Math.round(recentSnapPct * 1000) / 1000,
      snapTrend,
      targetShare: Math.round(targetShare * 1000) / 1000,
      recentTargetShare: Math.round(recentTargetShare * 1000) / 1000,
      rushShare: Math.round(rushShare * 1000) / 1000,
      recentRushShare: Math.round(recentRushShare * 1000) / 1000,
      gamesPlayed: wu.gamesPlayed,
      redZoneOpps: wu.redZoneOpps,
    });
  }
  return result;
}

// ---- Main ----

async function main() {
  const leagueId = process.argv[2];
  if (!leagueId) {
    console.error('Usage: npx tsx scripts/calibrate-htc.ts <leagueId>');
    process.exit(1);
  }

  console.log(`\n🏈 HTC Calibration — League ${leagueId}\n`);
  console.log('Fetching league data...');

  // 1. Fetch league metadata + rosters + users + all players + traded picks + drafts
  const [league, rosters, leagueUsers, allPlayers, tradedPicks] = await Promise.all([
    fetchJSON<SleeperLeague>(`${BASE_URL}/league/${leagueId}`),
    fetchJSON<SleeperRoster[]>(`${BASE_URL}/league/${leagueId}/rosters`),
    fetchJSON<SleeperLeagueUser[]>(`${BASE_URL}/league/${leagueId}/users`),
    fetchJSON<Record<string, SleeperPlayer>>(`${BASE_URL}/players/nfl`),
    fetchJSON<FutureDraftPick[]>(`${BASE_URL}/league/${leagueId}/traded_picks`),
  ]);

  const playoffStart = league.settings.playoff_week_start || 15;
  const regularSeasonWeeks = playoffStart - 1;
  const weekNums = Array.from({ length: regularSeasonWeeks }, (_, i) => i + 1);

  console.log(`League: ${league.name} | Season: ${league.season} | ${league.settings.num_teams} teams | ${regularSeasonWeeks} regular season weeks`);

  // 2. Fetch matchups + weekly stats
  console.log('Fetching matchups and weekly stats...');
  const weekData = await Promise.all(
    weekNums.map(w => Promise.all([
      fetchJSON<SleeperMatchup[]>(`${BASE_URL}/league/${leagueId}/matchups/${w}`),
      fetchJSON<Record<string, Record<string, number>>>(`${BASE_URL}/stats/nfl/regular/${league.season}/${w}`),
    ]))
  );

  const weekMatchups = weekData.map(([m]) => m);
  const weekStats = weekData.map(([, s]) => s);

  // 3. Fetch FantasyCalc values
  console.log('Fetching FantasyCalc dynasty values...');
  const isSF = league.roster_positions.includes('SUPER_FLEX');
  const recPts = league.scoring_settings?.rec ?? 1;
  const ppr = recPts >= 0.8 ? 1 : recPts >= 0.4 ? 0.5 : 0;
  const fcUrl = `https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=${isSF ? 2 : 1}&numTeams=12&ppr=${ppr}`;
  const fcData: FCPlayerEntry[] = await fetchJSON(fcUrl);

  const fcMap = new Map<string, number>();
  const rookiePool: FCPlayerEntry[] = [];
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
  for (const entry of fcData) {
    if (entry.player.sleeperId) {
      fcMap.set(entry.player.sleeperId, entry.value);
    } else {
      const key = `${normalize(entry.player.name)}:${entry.player.position}`;
      fcMap.set(key, entry.value);
    }
    if (entry.player.maybeYoe === 0) rookiePool.push(entry);
  }

  // 4. Compute season points + WAR
  const weeksWithData = weekMatchups.filter(
    week => week.some(m => Object.keys(m.players_points ?? {}).length > 0),
  ).length;
  const isSeasonComplete = weeksWithData === regularSeasonWeeks;
  const seasonFactor = weeksWithData > 0 ? regularSeasonWeeks / weeksWithData : 1;

  const rawPoints = computePlayerSeasonPoints(weekMatchups);
  const playerSeasonPoints = new Map<string, number>();
  for (const [pid, pts] of rawPoints) {
    playerSeasonPoints.set(pid, pts * seasonFactor);
  }

  const replacementLevels = computeLeagueAwareReplacementLevel(
    playerSeasonPoints, allPlayers, league.roster_positions, league.settings.num_teams,
  );
  const playerWARMap = new Map<string, number>();
  for (const [playerId, pts] of playerSeasonPoints) {
    const pos = allPlayers[playerId]?.position ?? '';
    if (!CURVE_POSITIONS.has(pos)) continue;
    playerWARMap.set(playerId, pts - (replacementLevels.get(pos) ?? 0));
  }

  // 5. Team WAR + weighted ages
  const validRosters = rosters.filter(r => r.owner_id);
  const allTeamWARs = validRosters.map(r =>
    (r.players ?? []).reduce((sum, pid) => sum + (playerWARMap.get(pid) ?? 0), 0),
  );
  const allTeamWeightedAges = computeAllTeamWeightedAges(validRosters, allPlayers, playerWARMap);

  // 6. Pick slot map
  const rosterIdToUserId = new Map<number, string>();
  for (const roster of rosters) {
    if (roster.owner_id) rosterIdToUserId.set(roster.roster_id, roster.owner_id);
  }
  const userIdToRosterId = new Map<string, number>();
  for (const [rid, uid] of rosterIdToUserId) userIdToRosterId.set(uid, rid);

  // 7. Future picks
  const currentSeasonNum = parseInt(league.season ?? '0');
  const picksByRosterId = new Map<number, FutureDraftPick[]>();
  for (const pick of tradedPicks) {
    if (pick.owner_id == null) continue;
    if (parseInt(pick.season) <= currentSeasonNum) continue;
    const arr = picksByRosterId.get(pick.owner_id) ?? [];
    arr.push(pick);
    picksByRosterId.set(pick.owner_id, arr);
  }
  // Add own picks for future seasons
  const futurePickDimensions = new Map<string, Set<number>>();
  for (const pick of tradedPicks) {
    if (parseInt(pick.season) > currentSeasonNum) {
      const rounds = futurePickDimensions.get(pick.season) ?? new Set<number>();
      rounds.add(pick.round);
      futurePickDimensions.set(pick.season, rounds);
    }
  }
  if (futurePickDimensions.size === 0) {
    for (let yr = 1; yr <= 2; yr++) {
      futurePickDimensions.set(String(currentSeasonNum + yr), new Set([1, 2, 3]));
    }
  }
  const tradedAwayKeys = new Set<string>();
  for (const pick of tradedPicks) {
    if (pick.owner_id !== null && pick.owner_id !== pick.roster_id) {
      tradedAwayKeys.add(`${pick.season}:${pick.round}:${pick.roster_id}`);
    }
  }
  for (const [season, rounds] of futurePickDimensions) {
    for (const round of rounds) {
      for (const roster of rosters) {
        if (!roster.owner_id) continue;
        if (tradedAwayKeys.has(`${season}:${round}:${roster.roster_id}`)) continue;
        const ownPick: FutureDraftPick = {
          season, round, roster_id: roster.roster_id,
          previous_owner_id: null, owner_id: roster.roster_id,
        };
        const arr = picksByRosterId.get(roster.roster_id) ?? [];
        arr.push(ownPick);
        picksByRosterId.set(roster.roster_id, arr);
      }
    }
  }

  // 8. User display names + avatars
  const userDisplayNames = new Map<string, string>();
  const userAvatars = new Map<string, string | null>();
  for (const u of leagueUsers) {
    userDisplayNames.set(u.user_id, u.metadata?.team_name || u.display_name);
    userAvatars.set(u.user_id, u.avatar);
  }

  // 9. Cross-team WAR by position + ranks
  const teamPositionWAR = new Map<number, Map<string, number>>();
  for (const roster of validRosters) {
    const posWAR = new Map<string, number>(POSITIONS.map(p => [p, 0]));
    for (const pid of roster.players ?? []) {
      const pos = allPlayers[pid]?.position ?? '';
      if (!CURVE_POSITIONS.has(pos)) continue;
      posWAR.set(pos, (posWAR.get(pos) ?? 0) + (playerWARMap.get(pid) ?? 0));
    }
    teamPositionWAR.set(roster.roster_id, posWAR);
  }

  const leagueAvgWARByPosition = new Map(
    POSITIONS.map(pos => [
      pos,
      [...teamPositionWAR.values()].reduce((s, m) => s + (m.get(pos) ?? 0), 0) / validRosters.length,
    ]),
  );

  const positionRanksByRoster = new Map<number, Map<string, number>>();
  for (const pos of POSITIONS) {
    const sorted = [...validRosters].sort(
      (a, b) => (teamPositionWAR.get(b.roster_id)?.get(pos) ?? 0) - (teamPositionWAR.get(a.roster_id)?.get(pos) ?? 0),
    );
    sorted.forEach((r, i) => {
      const m = positionRanksByRoster.get(r.roster_id) ?? new Map();
      m.set(pos, i + 1);
      positionRanksByRoster.set(r.roster_id, m);
    });
  }

  const warRankByRoster = new Map(
    [...validRosters]
      .map((r, i) => ({ rosterId: r.roster_id, war: allTeamWARs[i] }))
      .sort((a, b) => b.war - a.war)
      .map((r, i) => [r.rosterId, i + 1] as const),
  );
  const winsRankByRoster = new Map(
    [...validRosters]
      .sort((a, b) => b.settings.wins - a.settings.wins)
      .map((r, i) => [r.roster_id, i + 1] as const),
  );

  // 10. Compute franchise outlook for all teams
  console.log('Computing franchise outlook...');
  const outlookMap = new Map<string, FranchiseOutlookResult>();
  for (const roster of validRosters) {
    const result = computeFranchiseOutlook(
      roster, allPlayers, playerWARMap, allTeamWARs, allTeamWeightedAges,
      picksByRosterId.get(roster.roster_id) ?? [],
      isSeasonComplete, leagueAvgWARByPosition,
      positionRanksByRoster.get(roster.roster_id) ?? new Map(),
      warRankByRoster.get(roster.roster_id) ?? 1,
      winsRankByRoster.get(roster.roster_id) ?? 1,
      fcMap, rookiePool, validRosters, userDisplayNames, userAvatars,
      teamPositionWAR, positionRanksByRoster, picksByRosterId,
    );
    outlookMap.set(roster.owner_id!, result);
  }

  const rawContext: FranchiseOutlookRawContext = {
    allPlayers, playerWARMap, allTeamWARs, allTeamWeightedAges,
    isSeasonComplete, leagueAvgWARByPosition, allRosters: validRosters,
    userDisplayNames, userAvatars, teamPositionWAR, positionRanksByRoster,
    picksByRosterId, fcMap, rookiePool, warRankByRoster, winsRankByRoster,
    htcByPlayerId: new Map(),
  };

  // 11. Run HTC engine for every team
  console.log('Running HTC engine...\n');
  const leagueFormat = extractLeagueFormat(league);

  // Aggregate stats
  let totalPlayers = 0;
  let totalHold = 0;
  let totalTrade = 0;
  let totalCut = 0;
  const verdictByPos: Record<string, { hold: number; trade: number; cut: number }> = {};
  const flaggedIssues: string[] = [];
  const allRecs: { teamName: string; rec: PlayerRecommendation; strategyMode: string }[] = [];

  for (const roster of validRosters) {
    const userId = roster.owner_id!;
    const outlook = outlookMap.get(userId)!;
    const teamName = userDisplayNames.get(userId) ?? userId;

    // Build minimal roster stats with usage metrics
    const usageMap = computeUsageMetrics(weekMatchups, weekStats, roster.roster_id);
    const rosterStatsArr: PlayerRosterStat[] = (roster.players ?? [])
      .filter(pid => allPlayers[pid] && CURVE_POSITIONS.has(allPlayers[pid].position ?? ''))
      .map(pid => {
        const p = allPlayers[pid];
        return {
          playerId: pid,
          playerName: `${p.first_name} ${p.last_name}`,
          position: p.position ?? 'UNK',
          totalPoints: playerSeasonPoints.get(pid) ?? 0,
          totalStarts: 0,
          totalTDs: 0,
          weeksOnRoster: weeksWithData,
          seasons: 1,
          firstSeason: league.season,
          lastSeason: league.season,
          usage: usageMap.get(pid),
        };
      });

    const result = computePlayerRecommendations(
      userId, outlook, rawContext, rosterStatsArr, leagueFormat, roster,
    );

    for (const rec of result.players) {
      totalPlayers++;
      if (rec.verdict === 'HOLD') totalHold++;
      else if (rec.verdict === 'TRADE') totalTrade++;
      else totalCut++;

      if (!verdictByPos[rec.position]) verdictByPos[rec.position] = { hold: 0, trade: 0, cut: 0 };
      const vp = verdictByPos[rec.position];
      if (rec.verdict === 'HOLD') vp.hold++;
      else if (rec.verdict === 'TRADE') vp.trade++;
      else vp.cut++;

      allRecs.push({ teamName, rec, strategyMode: result.strategyMode });

      // ---- Archetype spot-checks ----

      // Flag 1: Young ascending player with high dynasty value marked CUT
      if (rec.verdict === 'CUT' && rec.age != null && rec.age <= 24 && rec.ageCurveDirection === 'ascending' && rec.dynastyValue != null && rec.dynastyValue > 2000) {
        flaggedIssues.push(`⚠️  ${rec.playerName} (${rec.position}, age ${rec.age}): CUT but young ascending with ${Math.round(rec.dynastyValue)} dynasty value — should be HOLD or TRADE`);
      }

      // Flag 2: Elite producer (WAR >= 5) marked CUT
      if (rec.verdict === 'CUT' && rec.playerWAR >= 5) {
        flaggedIssues.push(`⚠️  ${rec.playerName} (${rec.position}): CUT but ${rec.playerWAR.toFixed(1)} WAR — elite producer should never be CUT`);
      }

      // Flag 3: Zero-value zero-WAR player marked HOLD with high confidence
      if (rec.verdict === 'HOLD' && rec.confidence >= 60 && rec.playerWAR <= 0 && (rec.dynastyValue == null || rec.dynastyValue <= 0)) {
        flaggedIssues.push(`⚠️  ${rec.playerName} (${rec.position}): HOLD@${rec.confidence}% but 0 WAR, 0 dynasty value — should be CUT`);
      }

      // Flag 4: Top dynasty asset (value > 8000) on a contender marked TRADE
      if (rec.verdict === 'TRADE' && rec.dynastyValue != null && rec.dynastyValue >= 8000 && rec.ageCurveDirection !== 'declining' && result.tier === 'Contender') {
        flaggedIssues.push(`⚠️  ${rec.playerName} (${rec.position}): TRADE but top dynasty asset (${Math.round(rec.dynastyValue)}) on a contender with ${rec.ageCurveDirection} curve — should be HOLD`);
      }

      // Flag 5: Ascending QB in SuperFlex marked CUT
      if (rec.verdict === 'CUT' && rec.position === 'QB' && isSF && rec.ageCurveDirection === 'ascending') {
        flaggedIssues.push(`⚠️  ${rec.playerName} (QB): CUT in SuperFlex while ascending — should be HOLD or TRADE`);
      }
    }
  }

  // ---- Output Report ----

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                   HTC CALIBRATION REPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`League: ${league.name}`);
  console.log(`Format: ${isSF ? 'SuperFlex' : '1QB'} | ${ppr === 1 ? 'PPR' : ppr === 0.5 ? 'Half PPR' : 'Standard'} | ${league.settings.num_teams} teams`);
  console.log(`Season: ${league.season} | Weeks with data: ${weeksWithData}/${regularSeasonWeeks}\n`);

  // Overall distribution
  console.log('── Verdict Distribution ──────────────────────────────────────');
  console.log(`Total players scored: ${totalPlayers}`);
  console.log(`  HOLD:  ${totalHold} (${(totalHold / totalPlayers * 100).toFixed(1)}%)`);
  console.log(`  TRADE: ${totalTrade} (${(totalTrade / totalPlayers * 100).toFixed(1)}%)`);
  console.log(`  CUT:   ${totalCut} (${(totalCut / totalPlayers * 100).toFixed(1)}%)\n`);

  // Expected ranges: HOLD ~40-55%, TRADE ~25-35%, CUT ~15-30%
  const holdPct = totalHold / totalPlayers * 100;
  const tradePct = totalTrade / totalPlayers * 100;
  const cutPct = totalCut / totalPlayers * 100;

  if (holdPct > 65) flaggedIssues.push(`📊 HOLD rate too high (${holdPct.toFixed(1)}%) — thresholds may be too lenient`);
  if (holdPct < 30) flaggedIssues.push(`📊 HOLD rate too low (${holdPct.toFixed(1)}%) — thresholds may be too strict`);
  if (tradePct > 45) flaggedIssues.push(`📊 TRADE rate too high (${tradePct.toFixed(1)}%) — engine over-recommending trades`);
  if (tradePct < 10) flaggedIssues.push(`📊 TRADE rate too low (${tradePct.toFixed(1)}%) — engine under-recommending trades`);
  if (cutPct > 40) flaggedIssues.push(`📊 CUT rate too high (${cutPct.toFixed(1)}%) — engine too aggressive on cuts`);
  if (cutPct < 5) flaggedIssues.push(`📊 CUT rate too low (${cutPct.toFixed(1)}%) — engine not identifying roster cloggers`);

  // By position
  console.log('── By Position ──────────────────────────────────────────────');
  for (const pos of POSITIONS) {
    const vp = verdictByPos[pos];
    if (!vp) continue;
    const total = vp.hold + vp.trade + vp.cut;
    console.log(`  ${pos}: H=${vp.hold}(${(vp.hold/total*100).toFixed(0)}%) T=${vp.trade}(${(vp.trade/total*100).toFixed(0)}%) C=${vp.cut}(${(vp.cut/total*100).toFixed(0)}%)`);
  }

  // Per-team breakdown
  console.log('\n── Per-Team Summary ─────────────────────────────────────────');
  for (const roster of validRosters) {
    const userId = roster.owner_id!;
    const outlook = outlookMap.get(userId)!;
    const teamName = userDisplayNames.get(userId) ?? userId;
    const teamRecs = allRecs.filter(r => r.teamName === teamName);
    const h = teamRecs.filter(r => r.rec.verdict === 'HOLD').length;
    const t = teamRecs.filter(r => r.rec.verdict === 'TRADE').length;
    const c = teamRecs.filter(r => r.rec.verdict === 'CUT').length;
    const strategy = outlook.strategyRecommendation.mode;
    const tier = outlook.tier;
    console.log(`  ${teamName.padEnd(25)} ${tier.padEnd(12)} ${strategy.padEnd(20)} H=${h} T=${t} C=${c}`);
  }

  // Top trade targets across the league
  console.log('\n── Top Trade Targets (by dynasty value) ────────────────────');
  const tradeTargets = allRecs
    .filter(r => r.rec.verdict === 'TRADE' && r.rec.dynastyValue != null)
    .sort((a, b) => (b.rec.dynastyValue ?? 0) - (a.rec.dynastyValue ?? 0))
    .slice(0, 15);
  for (const { teamName, rec, strategyMode } of tradeTargets) {
    const val = Math.round(rec.dynastyValue ?? 0).toLocaleString();
    console.log(`  ${rec.playerName.padEnd(22)} ${rec.position} age=${rec.age ?? '?'} WAR=${rec.playerWAR.toFixed(1).padStart(5)} val=${val.padStart(6)} ${rec.tradeType?.padEnd(16) ?? ''} (${teamName}, ${strategyMode})`);
    console.log(`    → ${rec.reason}`);
  }

  // Confidence distribution
  console.log('\n── Confidence Distribution ──────────────────────────────────');
  const confBuckets = [0, 20, 40, 60, 80, 100];
  for (let i = 0; i < confBuckets.length - 1; i++) {
    const lo = confBuckets[i];
    const hi = confBuckets[i + 1];
    const count = allRecs.filter(r => r.rec.confidence >= lo && r.rec.confidence < hi).length;
    const bar = '█'.repeat(Math.ceil(count / 3));
    console.log(`  ${lo.toString().padStart(3)}-${hi.toString().padStart(3)}%: ${count.toString().padStart(4)} ${bar}`);
  }

  // Composite score distribution
  console.log('\n── Composite Score Distribution ─────────────────────────────');
  const compBuckets = [0, 20, 30, 40, 50, 60, 70, 80, 100];
  for (let i = 0; i < compBuckets.length - 1; i++) {
    const lo = compBuckets[i];
    const hi = compBuckets[i + 1];
    const count = allRecs.filter(r => r.rec.scores.composite >= lo && r.rec.scores.composite < hi).length;
    const bar = '█'.repeat(Math.ceil(count / 2));
    console.log(`  ${lo.toString().padStart(3)}-${hi.toString().padStart(3)}: ${count.toString().padStart(4)} ${bar}`);
  }

  // Dimension score averages by verdict
  console.log('\n── Average Dimension Scores by Verdict ─────────────────────');
  for (const verdict of ['HOLD', 'TRADE', 'CUT'] as const) {
    const group = allRecs.filter(r => r.rec.verdict === verdict);
    if (group.length === 0) continue;
    const avgProd = group.reduce((s, r) => s + r.rec.scores.productionAlignment, 0) / group.length;
    const avgAge = group.reduce((s, r) => s + r.rec.scores.ageCurveTrajectory, 0) / group.length;
    const avgSell = group.reduce((s, r) => s + r.rec.scores.sellWindow, 0) / group.length;
    const avgPos = group.reduce((s, r) => s + r.rec.scores.positionalContext, 0) / group.length;
    const avgStrat = group.reduce((s, r) => s + r.rec.scores.strategicFit, 0) / group.length;
    const avgSit = group.reduce((s, r) => s + r.rec.scores.situationScore, 0) / group.length;
    const avgComp = group.reduce((s, r) => s + r.rec.scores.composite, 0) / group.length;
    console.log(`  ${verdict.padEnd(6)} (n=${group.length.toString().padEnd(3)}): prod=${avgProd.toFixed(0).padStart(3)} age=${avgAge.toFixed(0).padStart(3)} sell=${avgSell.toFixed(0).padStart(3)} pos=${avgPos.toFixed(0).padStart(3)} strat=${avgStrat.toFixed(0).padStart(3)} sit=${avgSit.toFixed(0).padStart(3)} → composite=${avgComp.toFixed(1)}`);
  }

  // Flagged issues
  if (flaggedIssues.length > 0) {
    console.log('\n── Flagged Issues ──────────────────────────────────────────');
    for (const issue of flaggedIssues) {
      console.log(`  ${issue}`);
    }
  } else {
    console.log('\n✅ No calibration issues flagged.');
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
