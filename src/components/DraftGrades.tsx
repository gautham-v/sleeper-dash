import type { SleeperDraftPick, SleeperRoster } from '../types/sleeper';

interface DraftGradesProps {
  picks: SleeperDraftPick[];
  rosters: SleeperRoster[];
  rosterMap: Map<number, { teamName: string; displayName: string }>;
  totalRounds: number;
}

const POSITION_COLORS: Record<string, string> = {
  QB: 'bg-red-500/10 text-red-400 border border-red-500/20',
  RB: 'bg-brand-green/10 text-brand-green border border-brand-green/20',
  WR: 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20',
  TE: 'bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20',
  K: 'bg-white/5 text-gray-300 border border-white/10',
  DEF: 'bg-brand-purple/10 text-brand-purple border border-brand-purple/20',
  DST: 'bg-brand-purple/10 text-brand-purple border border-brand-purple/20',
};

function gradeFromRank(rank: number, total: number): { grade: string; color: string } {
  const pct = rank / total;
  if (pct <= 0.1) return { grade: 'A+', color: 'text-brand-cyan drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]' };
  if (pct <= 0.25) return { grade: 'A', color: 'text-brand-green drop-shadow-[0_0_8px_rgba(185,251,192,0.8)]' };
  if (pct <= 0.4) return { grade: 'B', color: 'text-brand-yellow drop-shadow-[0_0_8px_rgba(240,246,0,0.8)]' };
  if (pct <= 0.6) return { grade: 'C', color: 'text-orange-400' };
  if (pct <= 0.75) return { grade: 'D', color: 'text-red-400' };
  return { grade: 'F', color: 'text-gray-500' };
}

export function DraftGrades({ picks, rosters, rosterMap, totalRounds }: DraftGradesProps) {
  if (picks.length === 0) {
    return (
      <div className="bg-card-bg rounded-2xl p-8 text-center text-gray-500 border border-card-border border-dashed">
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
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
        Draft board for all {totalRounds} rounds · Grade based on season total points rank
      </p>

      {/* Draft board grid */}
      <div className="bg-card-bg rounded-2xl overflow-hidden border border-card-border shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-card-border bg-black/20">
                <th className="text-left py-4 px-5">Team</th>
                <th className="text-center py-4 px-3">PF</th>
                <th className="text-center py-4 px-3">Grade</th>
                {Array.from({ length: totalRounds }, (_, i) => (
                  <th key={i} className="text-center py-4 px-3 text-gray-600">
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
                  <tr key={rosterId} className="border-b border-card-border/50 hover:bg-white/5 transition-colors group">
                    <td className="py-4 px-5">
                      <div className="font-bold text-white group-hover:text-brand-cyan transition-colors">{team?.teamName ?? `Team ${rosterId}`}</div>
                      <div className="text-gray-500 text-[10px] uppercase tracking-wide">{team?.displayName}</div>
                    </td>
                    <td className="py-4 px-3 text-center font-medium text-white tabular-nums">{pts.toFixed(1)}</td>
                    <td className="py-4 px-3 text-center">
                      <span className={`font-black text-lg ${color}`}>{grade}</span>
                    </td>
                    {Array.from({ length: totalRounds }, (_, i) => {
                      const pick = picksByRound.get(i + 1);
                      if (!pick) return <td key={i} className="py-4 px-3 text-center text-gray-700">—</td>;
                      const posClass = POSITION_COLORS[pick.metadata.position] ?? 'bg-white/5 text-gray-300 border-white/10';
                      return (
                        <td key={i} className="py-4 px-3 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider ${posClass}`}
                            >
                              {pick.metadata.position}
                            </span>
                            <span className="text-gray-300 font-medium text-xs leading-tight max-w-16 truncate group-hover:text-white">
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
    </div>
  );
}
