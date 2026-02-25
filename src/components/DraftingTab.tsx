import { useMemo, useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Target, Users } from 'lucide-react';
import type { LeagueDraftAnalysis, AnalyzedPick } from '../types/sleeper';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface DraftingTabProps {
  userId: string;
  analysis: LeagueDraftAnalysis;
}

const POSITION_COLORS: Record<string, string> = {
  QB:  'bg-red-900/50 text-red-300 border-red-800/50',
  RB:  'bg-green-900/50 text-green-300 border-green-800/50',
  WR:  'bg-blue-900/50 text-blue-300 border-blue-800/50',
  TE:  'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
  K:   'bg-gray-700 text-gray-300 border-gray-600',
  DEF: 'bg-purple-900/50 text-purple-300 border-purple-800/50',
  DST: 'bg-purple-900/50 text-purple-300 border-purple-800/50',
};

function surplusColor(surplus: number): string {
  if (surplus > 1) return 'text-green-400';
  if (surplus < -1) return 'text-red-400';
  return 'text-gray-400';
}

function surplusLabel(surplus: number): string {
  return (surplus >= 0 ? '+' : '') + surplus.toFixed(1);
}

function draftClassGrade(avgSurplus: number): { grade: string; color: string } {
  if (avgSurplus >= 3)    return { grade: 'A+', color: 'text-emerald-400' };
  if (avgSurplus >= 1.5)  return { grade: 'A',  color: 'text-emerald-400' };
  if (avgSurplus >= 0.5)  return { grade: 'B+', color: 'text-green-400' };
  if (avgSurplus >= 0)    return { grade: 'B',  color: 'text-green-400' };
  if (avgSurplus >= -0.5) return { grade: 'C',  color: 'text-yellow-400' };
  if (avgSurplus >= -1.5) return { grade: 'D',  color: 'text-orange-400' };
  return { grade: 'F', color: 'text-red-400' };
}

function hitOrBustLabel(surplus: number): { label: string; className: string } {
  if (surplus > 1)  return { label: 'Hit',     className: 'text-emerald-400' };
  if (surplus < -1) return { label: 'Bust',    className: 'text-red-400' };
  return { label: 'Average', className: 'text-gray-400' };
}

function PickCard({ pick, label, icon: Icon, borderClass }: {
  pick: AnalyzedPick;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  borderClass: string;
}) {
  const posClass = POSITION_COLORS[pick.position] ?? 'bg-gray-700 text-gray-300 border-gray-600';
  return (
    <div className={`rounded-2xl p-4 border ${borderClass}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} className="opacity-70" />
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span>
      </div>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 px-1.5 py-0.5 rounded text-xs font-bold border ${posClass}`}>
          {pick.position}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm leading-tight truncate">{pick.playerName}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {pick.season} · Round {pick.round}, Pick {pick.pickNo}
            {pick.isKeeper && <span className="ml-1 text-brand-cyan">(K)</span>}
          </div>
        </div>
        <div className={`text-lg font-bold tabular-nums flex-shrink-0 ${surplusColor(pick.surplus)}`}>
          {surplusLabel(pick.surplus)}
        </div>
      </div>
    </div>
  );
}

const PICKS_PER_PAGE = 10;

export function DraftingTab({ userId, analysis }: DraftingTabProps) {
  const summary = analysis.managerSummaries.get(userId);
  const [picksPage, setPicksPage] = useState(1);

  const allPicks = useMemo(() => {
    if (!summary) return [];
    return summary.draftClasses
      .flatMap(cls => cls.picks)
      .sort((a, b) => Number(b.season) - Number(a.season) || a.pickNo - b.pickNo);
  }, [summary]);

  const pagedPicks = allPicks.slice((picksPage - 1) * PICKS_PER_PAGE, picksPage * PICKS_PER_PAGE);
  const totalPickPages = Math.ceil(allPicks.length / PICKS_PER_PAGE);

  useEffect(() => {
    setPicksPage(1);
  }, [userId]);

  if (!analysis.hasData || !summary) {
    return (
      <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
        <div className="text-2xl mb-3">📋</div>
        <div className="text-sm font-medium text-gray-300">No draft data available</div>
        <div className="text-xs text-gray-500 mt-1">
          Draft analysis requires completed snake draft history for this league.
        </div>
      </div>
    );
  }

  const totalManagers = analysis.managerSummaries.size;

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="bg-card-bg border border-card-border rounded-2xl p-5">
        <div className="flex items-start gap-4">
          {/* Grade badge */}
          <div className="flex-shrink-0 text-center">
            <div className={`text-5xl font-black leading-none ${summary.gradeColor}`}>
              {summary.grade}
            </div>
            <div className="text-xs text-gray-500 mt-1">Draft Grade</div>
          </div>

          {/* Stats grid */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
            <div>
              <div className={`text-xl font-bold tabular-nums ${surplusColor(summary.totalSurplus)}`}>
                {surplusLabel(summary.totalSurplus)}
              </div>
              <div className="text-xs text-gray-500">Total Surplus</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white tabular-nums">
                {(summary.hitRate * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500">Hit Rate</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white tabular-nums">
                #{summary.leagueRank} <span className="text-sm font-normal text-gray-500">/ {totalManagers}</span>
              </div>
              <div className="text-xs text-gray-500">League Rank</div>
            </div>
            <div>
              <div className={`text-base font-bold tabular-nums ${surplusColor(summary.avgSurplusPerPick)}`}>
                {surplusLabel(summary.avgSurplusPerPick)}
              </div>
              <div className="text-xs text-gray-500">Avg Surplus/Pick</div>
            </div>
            <div>
              <div className="text-base font-bold text-white tabular-nums">
                {(summary.bustRate * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500">Bust Rate</div>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-600">
          Value Score = how much better/worse a pick performed vs. the average for that draft round. Positive = outperformed expectations. Hit = top 30% in round; Bust = bottom 30%.
        </div>
      </div>

      {/* Best / Worst picks */}
      {(summary.bestPick || summary.worstPick) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {summary.bestPick && (
            <PickCard
              pick={summary.bestPick}
              label="Best Pick"
              icon={TrendingUp}
              borderClass="bg-green-900/10 border-green-700/30 text-green-400"
            />
          )}
          {summary.worstPick && summary.worstPick.playerId !== summary.bestPick?.playerId && (
            <PickCard
              pick={summary.worstPick}
              label="Worst Pick"
              icon={TrendingDown}
              borderClass="bg-red-900/10 border-red-700/30 text-red-400"
            />
          )}
        </div>
      )}

      {/* Draft classes by year */}
      {summary.draftClasses.length > 0 && (
        <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
          <div className="px-5 pt-4 pb-3 flex items-center gap-2">
            <Target size={15} className="text-gray-400" />
            <span className="font-semibold text-white text-sm">Draft Classes</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
                <TableHead className="text-left py-2.5 px-5">Season</TableHead>
                <TableHead className="text-center py-2.5 px-3">Grade</TableHead>
                <TableHead className="text-center py-2.5 px-3">Picks</TableHead>
                <TableHead className="text-center py-2.5 px-3">Avg Value</TableHead>
                <TableHead className="text-center py-2.5 px-3 hidden sm:table-cell">Hit%</TableHead>
                <TableHead className="text-center py-2.5 px-3 hidden sm:table-cell">Bust%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.draftClasses.map((cls) => (
                <TableRow key={cls.season} className="border-b border-gray-800/60 hover:bg-gray-800/20">
                  <TableCell className="py-3 px-5 font-medium text-white">{cls.season}</TableCell>
                  <TableCell className="py-3 px-3 text-center">
                    {(() => {
                      const { grade, color } = draftClassGrade(cls.avgSurplus);
                      return <span className={`text-sm font-bold ${color}`}>{grade}</span>;
                    })()}
                  </TableCell>
                  <TableCell className="py-3 px-3 text-center text-gray-400 tabular-nums">{cls.picks.length}</TableCell>
                  <TableCell className="py-3 px-3 text-center tabular-nums">
                    <span className={surplusColor(cls.avgSurplus)}>{surplusLabel(cls.avgSurplus)}</span>
                  </TableCell>
                  <TableCell className="py-3 px-3 text-center text-green-400 tabular-nums hidden sm:table-cell">
                    {(cls.hitRate * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell className="py-3 px-3 text-center text-red-400 tabular-nums hidden sm:table-cell">
                    {(cls.bustRate * 100).toFixed(0)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* All Drafted Players */}
      {allPicks.length > 0 && (
        <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
          <div className="px-5 pt-4 pb-3 flex items-center gap-2">
            <Users size={15} className="text-gray-400" />
            <span className="font-semibold text-white text-sm">All Drafted Players</span>
            <span className="text-xs text-gray-600">({allPicks.length})</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
                <TableHead className="text-left py-2.5 px-5">Player</TableHead>
                <TableHead className="text-center py-2.5 px-3">Year</TableHead>
                <TableHead className="text-center py-2.5 px-3">Rd/Pick</TableHead>
                <TableHead className="text-center py-2.5 px-3 hidden sm:table-cell">Result</TableHead>
                <TableHead className="text-right py-2.5 px-5">Value Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedPicks.map((pick, idx) => {
                const { label, className } = hitOrBustLabel(pick.surplus);
                const posClass = POSITION_COLORS[pick.position] ?? 'bg-gray-700 text-gray-300 border-gray-600';
                return (
                  <TableRow key={`${pick.season}-${pick.pickNo}-${idx}`} className="border-b border-gray-800/60 hover:bg-gray-800/20">
                    <TableCell className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${posClass}`}>
                          {pick.position}
                        </span>
                        <span className="text-sm text-white font-medium truncate">{pick.playerName}</span>
                        {pick.isKeeper && <span className="text-[10px] text-brand-cyan font-medium ml-1">(K)</span>}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-3 text-center text-sm text-gray-400">{pick.season}</TableCell>
                    <TableCell className="py-3 px-3 text-center text-sm text-gray-400 tabular-nums">
                      R{pick.round} #{pick.pickNo}
                    </TableCell>
                    <TableCell className="py-3 px-3 text-center hidden sm:table-cell">
                      <span className={`text-xs font-semibold ${className}`}>{label}</span>
                    </TableCell>
                    <TableCell className={`py-3 px-5 text-right tabular-nums text-sm font-bold ${surplusColor(pick.surplus)}`}>
                      {surplusLabel(pick.surplus)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {totalPickPages > 1 && (
            <div className="px-5 py-3 border-t border-card-border">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious onClick={() => setPicksPage(p => Math.max(1, p - 1))} disabled={picksPage === 1} />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext onClick={() => setPicksPage(p => Math.min(totalPickPages, p + 1))} disabled={picksPage === totalPickPages} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
