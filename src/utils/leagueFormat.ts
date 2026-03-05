import type { SleeperLeague } from '../types/sleeper';
import type { LeagueFormatContext } from '../types/recommendations';

/**
 * Extract league format context from Sleeper league settings.
 * Determines starter slots, flex eligibility, SuperFlex detection, scoring format.
 */
export function extractLeagueFormat(league: SleeperLeague): LeagueFormatContext {
  const rosterPositions = league.roster_positions;
  const starterSlots: Record<string, number> = {};
  let flexCount = 0;
  let superFlexCount = 0;
  let benchCount = 0;

  for (const pos of rosterPositions) {
    if (pos === 'BN') {
      benchCount++;
    } else if (pos === 'FLEX') {
      flexCount++;
    } else if (pos === 'SUPER_FLEX') {
      superFlexCount++;
    } else if (pos === 'REC_FLEX') {
      // Receiving flex (WR/TE only)
      flexCount++;
    } else {
      starterSlots[pos] = (starterSlots[pos] || 0) + 1;
    }
  }

  // FLEX can be filled by RB, WR, TE
  const flexPositions = ['RB', 'WR', 'TE'];
  // SUPER_FLEX adds QB to flex-eligible
  const superFlexPositions = ['QB', 'RB', 'WR', 'TE'];

  // Add flex slots to the effective starter counts
  // (these aren't position-locked but represent additional starter opportunities)
  if (flexCount > 0) {
    starterSlots['FLEX'] = flexCount;
  }
  if (superFlexCount > 0) {
    starterSlots['SUPER_FLEX'] = superFlexCount;
  }

  const isSuperFlex = superFlexCount > 0;
  const rosterSize = rosterPositions.length;
  const taxiSlots = league.settings.taxi_slots ?? 0;

  // Determine scoring format from scoring_settings
  const recPts = league.scoring_settings?.rec ?? 0;
  let scoringFormat: 'ppr' | 'half' | 'standard';
  if (recPts >= 0.8) {
    scoringFormat = 'ppr';
  } else if (recPts >= 0.4) {
    scoringFormat = 'half';
  } else {
    scoringFormat = 'standard';
  }

  return {
    isSuperFlex,
    starterSlots,
    flexPositions,
    superFlexPositions,
    rosterSize,
    benchSlots: benchCount,
    hasTaxiSquad: taxiSlots > 0,
    taxiSlots,
    scoringFormat,
  };
}

/**
 * Count total starter slots that a given position can fill.
 * E.g., a WR can fill WR slots + FLEX slots + SUPER_FLEX slots.
 */
export function effectiveStarterSlots(
  position: string,
  format: LeagueFormatContext,
): number {
  const directSlots = format.starterSlots[position] || 0;
  const flexSlots = format.flexPositions.includes(position)
    ? (format.starterSlots['FLEX'] || 0)
    : 0;
  const sfSlots = format.superFlexPositions.includes(position)
    ? (format.starterSlots['SUPER_FLEX'] || 0)
    : 0;
  return directSlots + flexSlots + sfSlots;
}

/**
 * Determine if a player fills a "required" starter role on this roster.
 * A player is a required starter if they rank in the top N players at their
 * position by WAR, where N is the number of starter slots they could fill
 * (including flex eligibility).
 */
export function isRequiredStarter(
  playerId: string,
  position: string,
  rosterPlayersAtPosition: { playerId: string; war: number }[],
  format: LeagueFormatContext,
): boolean {
  const totalSlots = effectiveStarterSlots(position, format);
  const sorted = [...rosterPlayersAtPosition].sort((a, b) => b.war - a.war);
  const starterCutoff = Math.min(totalSlots, sorted.length);
  const starterIds = new Set(sorted.slice(0, starterCutoff).map(p => p.playerId));
  return starterIds.has(playerId);
}
