import type { SleeperDraftPick, SleeperRoster } from '../types/sleeper';

interface DraftGradesProps {
  picks: SleeperDraftPick[];
  rosters: SleeperRoster[];
  rosterMap: Map<number, { teamName: string; displayName: string }>;
  totalRounds: number;
}

const POSITION_COLORS: Record<string, string> = {
  QB: 'bg-red-900/50 text-red-300',
  RB: 'bg-green-900/50 text-green-300',
  WR: 'bg-blue-900/50 text-blue-300',
  TE: 'bg-yellow-900/50 text-yellow-300',
  K: 'bg-gray-700 text-gray-300',
  DEF: 'bg-purple-900/50 text-purple-300',
  DST: 'bg-purple-900/50 text-purple-300',
};

function gradeFromRank(rank: number, total: number): { grade: string; color: string } {
  const pct = rank / total;
  if (pct <= 0.1) return { grade: 'A+', color: 'text-emerald-400' };
  if (pct <= 0.25) return { grade: 'A', color: 'text-green-400' };
  if (pct <= 0.4) return { grade: 'B', color: 'text-lime-400' };
  if (pct <= 0.6) return { grade: 'C', color: 'text-yellow-400' };
  if (pct <= 0.75) return { grade: 'D', color: 'text-orange-400' };
  return { grade: 'F', color: 'text-red-400' };
}

export function DraftGrades({ picks, rosters, rosterMap, totalRounds }: DraftGradesProps) {
  if (picks.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">
        No draft data available.
      </div>
    );
  }

  // Group picks by roster_id
  const picksByRoster = new Map<number, SleeperDraftPick[]>();
  for (const pick of picks) {
    const arr = picksByRoster.get(pick.roster_id) ?? [];
    arr.push(pick);
    picksByRoster.set(pick.roster_id, arr);
  }

  // Roster points for grade comparison
  const rosterPoints = new Map(
    rosters.map((r) => [r.roster_id, r.settings.fpts + (r.settings.fpts_decimal ?? 0) / 100])
  );
  const sortedByPoints = [...rosters].sort((a, b) => {
    const ap = rosterPoints.get(a.roster_id) ?? 0;
    const bp = rosterPoints.get(b.roster_id) ?? 0;
    return bp - ap;
  });
  const pointsRank = new Map(sortedByPoints.map((r, i) => [r.roster_id, i + 1]));

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">
        Draft board for all {totalRounds} rounds · Grade based on season total points rank
      </p>

      {/* Draft board grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="text-gray-500 border-b border-gray-700">
              <th className="text-left p-3 font-normal">Team</th>
              <th className="text-center p-3 font-normal">PF</th>
              <th className="text-center p-3 font-normal">Grade</th>
              {Array.from({ length: totalRounds }, (_, i) => (
                <th key={i} className="text-center p-3 font-normal text-gray-600">
                  R{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...picksByRoster.entries()].map(([rosterId, rPicks]) => {
              const team = rosterMap.get(rosterId);
              const pts = rosterPoints.get(rosterId) ?? 0;
              const rank = pointsRank.get(rosterId) ?? rosters.length;
              const { grade, color } = gradeFromRank(rank, rosters.length);
              const picksByRound = new Map(rPicks.map((p) => [p.round, p]));

              return (
                <tr key={rosterId} className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="p-3">
                    <div className="font-medium text-white">{team?.teamName ?? `Team ${rosterId}`}</div>
                    <div className="text-gray-500">{team?.displayName}</div>
                  </td>
                  <td className="p-3 text-center text-white tabular-nums">{pts.toFixed(1)}</td>
                  <td className="p-3 text-center">
                    <span className={`font-bold text-sm ${color}`}>{grade}</span>
                  </td>
                  {Array.from({ length: totalRounds }, (_, i) => {
                    const pick = picksByRound.get(i + 1);
                    if (!pick) return <td key={i} className="p-3 text-center text-gray-700">—</td>;
                    const posClass = POSITION_COLORS[pick.metadata.position] ?? 'bg-gray-700 text-gray-300';
                    return (
                      <td key={i} className="p-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-semibold ${posClass}`}
                          >
                            {pick.metadata.position}
                          </span>
                          <span className="text-gray-400 text-xs leading-tight max-w-16 truncate">
                            {pick.metadata.last_name}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
