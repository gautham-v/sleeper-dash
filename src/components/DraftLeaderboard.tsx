import { useState, useMemo } from 'react';
import { MetricTooltip } from '@/components/MetricTooltip';
import { Loader2, ChevronDown, TrendingUp, TrendingDown, Medal, Layers, Star } from 'lucide-react';
import { useLeagueDraftHistory } from '../hooks/useLeagueDraftHistory';
import { Avatar } from './Avatar';
import type { ManagerDraftSummary, AnalyzedPick } from '../types/sleeper';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';

// ── Shared helpers ────────────────────────────────────────────────────────────

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
  if (surplus > 1)  return 'text-green-400';
  if (surplus < -1) return 'text-red-400';
  return 'text-gray-400';
}

function surplusLabel(surplus: number): string {
  return (surplus >= 0 ? '+' : '') + surplus.toFixed(1);
}

// ── Section A ─────────────────────────────────────────────────────────────────

type SortKey = 'surplus' | 'hitRate' | 'avgPick';

function SortHeader({
  label, sortKey, active, onClick,
}: { label: React.ReactNode; sortKey: SortKey; active: SortKey; onClick: (k: SortKey) => void }) {
  const isActive = active === sortKey;
  return (
    <TableHead
      className={`text-xs uppercase tracking-wider font-medium py-3 px-2 text-right h-auto hidden sm:table-cell cursor-pointer select-none ${
        isActive ? 'text-brand-cyan' : 'text-muted-foreground hover:text-foreground'
      }`}
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-1 justify-end">
        {label}
        {isActive && <ChevronDown size={11} />}
      </span>
    </TableHead>
  );
}

function AllTimeDraftRankings({
  managers, onSelectManager,
}: { managers: ManagerDraftSummary[]; onSelectManager: (id: string) => void }) {
  const [sortBy, setSortBy] = useState<SortKey>('surplus');

  const sorted = useMemo(() => {
    return [...managers].sort((a, b) => {
      if (sortBy === 'surplus')  return b.totalSurplus - a.totalSurplus;
      if (sortBy === 'hitRate')  return b.hitRate - a.hitRate;
      if (sortBy === 'avgPick')  return b.avgSurplusPerPick - a.avgSurplusPerPick;
      return 0;
    });
  }, [managers, sortBy]);

  return (
    <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <Medal size={16} className="text-brand-cyan" />
        <h2 className="text-base font-semibold text-white">All-Time Draft Rankings</h2>
        <span className="text-xs text-gray-500 ml-1">click a column header to sort</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-card-border hover:bg-transparent">
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 pl-4 h-auto w-8">#</TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 h-auto">Manager</TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 text-center h-auto"><span className="flex items-center justify-center gap-1">Grade <MetricTooltip metricKey="grade" side="bottom" /></span></TableHead>
            <TableHead
              className={`text-xs uppercase tracking-wider font-medium py-3 px-2 text-right h-auto hidden sm:table-cell cursor-pointer select-none ${
                sortBy === 'surplus' ? 'text-brand-cyan' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setSortBy('surplus')}
            >
              <span className="inline-flex items-center gap-1 justify-end">
                Value+
                {sortBy === 'surplus' && <ChevronDown size={11} />}
                <MetricTooltip metricKey="surplus" side="bottom" />
              </span>
            </TableHead>
            <SortHeader label={<span className="flex items-center gap-1">Hit% <MetricTooltip metricKey="hitRate" side="bottom" /></span>}  sortKey="hitRate"  active={sortBy} onClick={setSortBy} />
            <SortHeader label="Avg/Pick"  sortKey="avgPick"  active={sortBy} onClick={setSortBy} />
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 pr-4 text-right h-auto hidden sm:table-cell"><span className="flex items-center justify-end gap-1">Bust% <MetricTooltip metricKey="bustRate" side="bottom" /></span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((m, i) => (
            <TableRow
              key={m.userId}
              className="border-card-border hover:bg-muted/30 cursor-pointer"
              onClick={() => onSelectManager(m.userId)}
            >
              <TableCell className="py-3 px-2 pl-4 text-gray-400 text-sm w-8">{i + 1}</TableCell>
              <TableCell className="py-3 px-2">
                <div className="flex items-center gap-2">
                  <Avatar avatar={m.avatar} name={m.displayName} size="sm" />
                  <span className="text-sm font-medium text-white truncate max-w-[120px]">{m.displayName}</span>
                </div>
              </TableCell>
              <TableCell className="py-3 px-2 text-center">
                <span className={`text-sm font-bold ${m.gradeColor}`}>{m.grade}</span>
              </TableCell>
              <TableCell className={`py-3 px-2 text-right tabular-nums text-sm font-medium hidden sm:table-cell ${surplusColor(m.totalSurplus)}`}>
                {surplusLabel(m.totalSurplus)}
              </TableCell>
              <TableCell className="py-3 px-2 text-right tabular-nums text-sm text-gray-300 hidden sm:table-cell">
                {(m.hitRate * 100).toFixed(0)}%
              </TableCell>
              <TableCell className={`py-3 px-2 text-right tabular-nums text-sm font-medium hidden sm:table-cell ${surplusColor(m.avgSurplusPerPick)}`}>
                {surplusLabel(m.avgSurplusPerPick)}
              </TableCell>
              <TableCell className="py-3 px-2 pr-4 text-right tabular-nums text-sm text-gray-400 hidden sm:table-cell">
                {(m.bustRate * 100).toFixed(0)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="px-5 py-3 border-t border-card-border/50 text-xs text-muted-foreground">
        Value+ = how much better/worse each pick performed vs. average for that draft round. Positive = outperformed expectations.
      </div>
    </div>
  );
}

// ── Section B ─────────────────────────────────────────────────────────────────

interface DraftClassRow {
  managerId: string;
  displayName: string;
  avatar: string | null;
  season: string;
  picks: number;
  avgSurplus: number;
  hitRate: number;
  bustRate: number;
  topPicks: AnalyzedPick[];
}

const DRAFT_PAGE_SIZE = 10;

function buildPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1];
  if (current > 3) pages.push('ellipsis');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

function DraftPagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <Pagination className="mt-4 pb-2">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} />
        </PaginationItem>
        {buildPageNumbers(page, totalPages).map((p, i) =>
          p === 'ellipsis' ? (
            <PaginationItem key={`e-${i}`}><PaginationEllipsis /></PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink isActive={p === page} onClick={() => onPageChange(p)}>{p}</PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function BestDraftClasses({
  rows, onSelectManager,
}: { rows: DraftClassRow[]; onSelectManager: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(rows.length / DRAFT_PAGE_SIZE);
  const pagedRows = rows.slice((page - 1) * DRAFT_PAGE_SIZE, page * DRAFT_PAGE_SIZE);
  const offset = (page - 1) * DRAFT_PAGE_SIZE;

  return (
    <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <Layers size={16} className="text-brand-cyan" />
        <h2 className="text-base font-semibold text-white">Best Draft Classes Ever</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-card-border hover:bg-transparent">
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 pl-4 h-auto w-8">#</TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 h-auto">Manager</TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 text-right h-auto">Season</TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 text-right h-auto hidden sm:table-cell">Picks</TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 text-right h-auto"><span className="flex items-center justify-end gap-1">Avg Surplus <MetricTooltip metricKey="surplus" side="bottom" /></span></TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 text-right h-auto hidden sm:table-cell">Hit%</TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 pr-4 text-right h-auto hidden sm:table-cell">Bust%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedRows.map((row, i) => (
            <TableRow
              key={`${row.managerId}-${row.season}`}
              className="border-card-border hover:bg-muted/30 cursor-pointer"
              onClick={() => onSelectManager(row.managerId)}
            >
              <TableCell className="py-3 px-2 pl-4 text-gray-400 text-sm w-8">{offset + i + 1}</TableCell>
              <TableCell className="py-3 px-2">
                <div className="flex items-center gap-2">
                  <Avatar avatar={row.avatar} name={row.displayName} size="sm" />
                  <span className="text-sm font-medium text-white truncate max-w-[120px]">{row.displayName}</span>
                </div>
              </TableCell>
              <TableCell className="py-3 px-2 text-right text-sm text-gray-300">{row.season}</TableCell>
              <TableCell className="py-3 px-2 text-right text-sm text-gray-400 hidden sm:table-cell">{row.picks}</TableCell>
              <TableCell className={`py-3 px-2 text-right tabular-nums text-sm font-medium ${surplusColor(row.avgSurplus)}`}>
                {surplusLabel(row.avgSurplus)}
              </TableCell>
              <TableCell className="py-3 px-2 text-right tabular-nums text-sm text-gray-300 hidden sm:table-cell">
                {(row.hitRate * 100).toFixed(0)}%
              </TableCell>
              <TableCell className="py-3 px-2 pr-4 text-right tabular-nums text-sm text-gray-400 hidden sm:table-cell">
                {(row.bustRate * 100).toFixed(0)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <DraftPagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

// ── Section C / D (shared pick table) ────────────────────────────────────────

interface PickRow extends AnalyzedPick {
  managerId: string;
  managerName: string;
  managerAvatar: string | null;
}

function PickTable({
  title, icon: Icon, iconClass, containerClass, rows, emptyText,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
  containerClass?: string;
  rows: PickRow[];
  emptyText: string;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(rows.length / DRAFT_PAGE_SIZE);
  const pagedRows = rows.slice((page - 1) * DRAFT_PAGE_SIZE, page * DRAFT_PAGE_SIZE);
  const offset = (page - 1) * DRAFT_PAGE_SIZE;

  return (
    <div className={`${containerClass ?? 'bg-card-bg border border-card-border'} rounded-2xl overflow-hidden`}>
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <Icon size={16} className={iconClass} />
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-gray-500">{emptyText}</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow className="border-card-border hover:bg-transparent">
                <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 pl-4 h-auto w-8">#</TableHead>
                <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 h-auto">Player</TableHead>
                <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 h-auto hidden sm:table-cell">Manager</TableHead>
                <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 text-right h-auto hidden sm:table-cell">Season</TableHead>
                <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 text-right h-auto">Rd/Pick</TableHead>
                <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 text-right h-auto hidden sm:table-cell">WAR</TableHead>
                <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 pr-4 text-right h-auto">Surplus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map((pick, i) => {
                const posColor = POSITION_COLORS[pick.position] ?? 'bg-gray-700 text-gray-300 border-gray-600';
                return (
                  <TableRow key={`${pick.managerId}-${pick.season}-${pick.pickNo}`} className="border-card-border hover:bg-muted/30">
                    <TableCell className="py-3 px-2 pl-4 text-gray-400 text-sm w-8">{offset + i + 1}</TableCell>
                    <TableCell className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${posColor} shrink-0`}>
                          {pick.position}
                        </span>
                        <span className="text-sm font-medium text-white">{pick.playerName}</span>
                        {pick.isKeeper && (
                          <span className="text-[10px] text-yellow-500 font-medium">K</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-2 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <Avatar avatar={pick.managerAvatar} name={pick.managerName} size="sm" />
                        <span className="text-sm text-gray-300 truncate max-w-[100px]">{pick.managerName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-2 text-right text-sm text-gray-400 hidden sm:table-cell">{pick.season}</TableCell>
                    <TableCell className="py-3 px-2 text-right tabular-nums text-sm text-gray-400">
                      R{pick.round} #{pick.pickNo}
                    </TableCell>
                    <TableCell className="py-3 px-2 text-right tabular-nums text-sm text-gray-400 hidden sm:table-cell">
                      {pick.war.toFixed(1)}
                    </TableCell>
                    <TableCell className={`py-3 px-2 pr-4 text-right tabular-nums text-sm font-medium ${surplusColor(pick.surplus)}`}>
                      {surplusLabel(pick.surplus)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <DraftPagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface DraftLeaderboardProps {
  leagueId: string;
  onSelectManager: (userId: string) => void;
}

export function DraftLeaderboard({ leagueId, onSelectManager }: DraftLeaderboardProps) {
  const { data, isLoading, isError } = useLeagueDraftHistory(leagueId);

  // ── Derived data ──────────────────────────────────────────────────────────

  const managers = useMemo(
    () => (data ? Array.from(data.managerSummaries.values()) : []),
    [data],
  );

  // Section B — all (manager × season) pairs sorted by avgSurplus desc
  const draftClassRows = useMemo((): DraftClassRow[] => {
    if (!data) return [];
    const rows: DraftClassRow[] = [];
    for (const m of data.managerSummaries.values()) {
      for (const dc of m.draftClasses) {
        rows.push({
          managerId:   m.userId,
          displayName: m.displayName,
          avatar:      m.avatar,
          season:      dc.season,
          picks:       dc.picks.length,
          avgSurplus:  dc.avgSurplus,
          hitRate:     dc.hitRate,
          bustRate:    dc.bustRate,
          topPicks:    [...dc.picks].sort((a, b) => b.surplus - a.surplus).slice(0, 3),
        });
      }
    }
    return rows.sort((a, b) => b.avgSurplus - a.avgSurplus);
  }, [data]);

  // Sections C & D — all picks with manager metadata attached
  const allPickRows = useMemo((): PickRow[] => {
    if (!data) return [];
    const rows: PickRow[] = [];
    for (const m of data.managerSummaries.values()) {
      for (const dc of m.draftClasses) {
        for (const p of dc.picks) {
          rows.push({ ...p, managerId: m.userId, managerName: m.displayName, managerAvatar: m.avatar });
        }
      }
    }
    return rows;
  }, [data]);

  const steals = useMemo(
    () => [...allPickRows].sort((a, b) => b.surplus - a.surplus),
    [allPickRows],
  );
  const busts = useMemo(
    () => [...allPickRows].sort((a, b) => a.surplus - b.surplus),
    [allPickRows],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-60 text-brand-cyan">
        <Loader2 className="animate-spin mr-2" size={22} />
        <span className="text-sm">Analyzing draft history…</span>
      </div>
    );
  }

  if (isError || !data || !data.hasData) {
    return (
      <div className="bg-card-bg border border-card-border rounded-2xl p-10 text-center">
        <div className="text-4xl mb-3">📋</div>
        <div className="text-sm font-medium text-gray-300">No draft data available</div>
        <div className="text-xs text-gray-500 mt-1">
          No completed snake drafts were found for this league's history.
        </div>
      </div>
    );
  }

  // Top-3 data
  const top3Classes = draftClassRows.slice(0, 3);
  const top3Steals = steals.slice(0, 3);
  const top3Busts = busts.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* ── Top-3 Highlights ── */}
      <div className="space-y-4">
        {/* Best Draft Classes */}
        {top3Classes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-brand-cyan" />
              <span className="font-semibold text-white text-sm">Top 3 Best Draft Classes</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {top3Classes.map((row, i) => {
                const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                return (
                  <button
                    key={`${row.managerId}-${row.season}`}
                    onClick={() => onSelectManager(row.managerId)}
                    className="bg-card-bg border border-card-border rounded-2xl p-4 text-left hover:border-gray-600 transition-colors w-full"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm w-5 shrink-0">{rankEmoji}</span>
                      <Avatar avatar={row.avatar} name={row.displayName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-white">{row.displayName}</span>
                        <span className="text-xs text-gray-500 ml-1.5">{row.season}</span>
                      </div>
                    </div>
                    <div className="ml-7 mb-2">
                      <span className={`text-sm font-bold tabular-nums ${surplusColor(row.avgSurplus)}`}>
                        Avg {surplusLabel(row.avgSurplus)}
                      </span>
                    </div>
                    {row.topPicks.length > 0 && (
                      <div className="ml-7 flex flex-wrap gap-1">
                        {row.topPicks.map((pick) => (
                          <span key={`${pick.playerId}-${pick.season}`} className="text-xs bg-gray-800/60 border border-gray-700/50 rounded px-1.5 py-0.5 text-gray-300">
                            {pick.playerName}
                            <span className={`ml-1 text-[10px] font-semibold ${surplusColor(pick.surplus)}`}>
                              ({surplusLabel(pick.surplus)})
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Biggest Steals + Busts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Top 3 Steals */}
          {top3Steals.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={13} className="text-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Top 3 Biggest Steals</span>
              </div>
              <div className="space-y-1.5">
                {top3Steals.map((pick, i) => (
                  <div key={`${pick.managerId}-${pick.season}-${pick.pickNo}`} className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-400 w-5 shrink-0">{i + 1}.</span>
                    <span className={`text-[10px] font-bold px-1 py-0.5 rounded border shrink-0 ${POSITION_COLORS[pick.position] ?? 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                      {pick.position}
                    </span>
                    <span className="text-xs font-medium text-white truncate flex-1">{pick.playerName}</span>
                    <span className="text-xs text-gray-400 shrink-0">{pick.managerName.split(' ')[0]}</span>
                    <span className="text-xs font-bold text-emerald-400 tabular-nums shrink-0">{surplusLabel(pick.surplus)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 3 Busts */}
          {top3Busts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown size={13} className="text-red-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Top 3 Biggest Busts</span>
              </div>
              <div className="space-y-1.5">
                {top3Busts.map((pick, i) => (
                  <div key={`${pick.managerId}-${pick.season}-${pick.pickNo}`} className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-red-400 w-5 shrink-0">{i + 1}.</span>
                    <span className={`text-[10px] font-bold px-1 py-0.5 rounded border shrink-0 ${POSITION_COLORS[pick.position] ?? 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                      {pick.position}
                    </span>
                    <span className="text-xs font-medium text-white truncate flex-1">{pick.playerName}</span>
                    <span className="text-xs text-gray-400 shrink-0">{pick.managerName.split(' ')[0]}</span>
                    <span className="text-xs font-bold text-red-400 tabular-nums shrink-0">{surplusLabel(pick.surplus)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Jump to full analysis */}
        <div className="flex justify-end">
          <a
            href="#full-draft-analysis"
            className="text-xs text-brand-cyan hover:underline flex items-center gap-1"
          >
            <Star size={11} />
            Jump to Full Draft Analysis
          </a>
        </div>
      </div>

      {/* ── Full Analysis ── */}
      <div id="full-draft-analysis" className="space-y-6">
        {/* Section A */}
        <AllTimeDraftRankings managers={managers} onSelectManager={onSelectManager} />

        {/* Section B */}
        {draftClassRows.length > 0 && (
          <BestDraftClasses rows={draftClassRows} onSelectManager={onSelectManager} />
        )}

        {/* Sections C & D side-by-side on large screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PickTable
            title="Biggest Steals in League History"
            icon={TrendingUp}
            iconClass="text-emerald-400"
            rows={steals}
            emptyText="No pick data found."
          />
          <PickTable
            title="Biggest Busts in League History"
            icon={TrendingDown}
            iconClass="text-red-400"
            rows={busts}
            emptyText="No pick data found."
          />
        </div>

        {/* Footer note */}
        <p className="text-xs text-gray-600 px-1">
          Value+ = how much better/worse a pick performed vs. average for that draft slot. Hit = top 30% performer in round; Bust = bottom 30%.
        </p>
      </div>
    </div>
  );
}
