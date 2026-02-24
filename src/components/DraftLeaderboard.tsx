import { useState, useMemo } from 'react';
import { Loader2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Medal, Layers } from 'lucide-react';
import { useLeagueDraftHistory } from '../hooks/useLeagueDraftHistory';
import { Avatar } from './Avatar';
import type { ManagerDraftSummary, AnalyzedPick } from '../types/sleeper';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

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
}: { label: string; sortKey: SortKey; active: SortKey; onClick: (k: SortKey) => void }) {
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
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 text-center h-auto">Grade</TableHead>
            <SortHeader label="Surplus"   sortKey="surplus"  active={sortBy} onClick={setSortBy} />
            <SortHeader label="Hit%"      sortKey="hitRate"  active={sortBy} onClick={setSortBy} />
            <SortHeader label="Avg/Pick"  sortKey="avgPick"  active={sortBy} onClick={setSortBy} />
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 pr-4 text-right h-auto hidden sm:table-cell">Bust%</TableHead>
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
}

const DRAFT_CLASS_PREVIEW = 5;

function BestDraftClasses({
  rows, onSelectManager,
}: { rows: DraftClassRow[]; onSelectManager: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, DRAFT_CLASS_PREVIEW);
  const canExpand = rows.length > DRAFT_CLASS_PREVIEW;

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
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 text-right h-auto">Avg Surplus</TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 text-right h-auto hidden sm:table-cell">Hit%</TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-medium py-3 px-2 pr-4 text-right h-auto hidden sm:table-cell">Bust%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((row, i) => (
            <TableRow
              key={`${row.managerId}-${row.season}`}
              className="border-card-border hover:bg-muted/30 cursor-pointer"
              onClick={() => onSelectManager(row.managerId)}
            >
              <TableCell className="py-3 px-2 pl-4 text-gray-400 text-sm w-8">{i + 1}</TableCell>
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
      {canExpand && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-gray-500 hover:text-gray-300 border-t border-card-border transition-colors"
        >
          {expanded ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> Show all {rows.length}</>}
        </button>
      )}
    </div>
  );
}

// ── Section C / D (shared pick table) ────────────────────────────────────────

interface PickRow extends AnalyzedPick {
  managerId: string;
  managerName: string;
  managerAvatar: string | null;
}

const PICK_TABLE_PREVIEW = 10;

function PickTable({
  title, icon: Icon, iconClass, rows, emptyText,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
  rows: PickRow[];
  emptyText: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, PICK_TABLE_PREVIEW);
  const canExpand = rows.length > PICK_TABLE_PREVIEW;

  return (
    <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
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
              {visible.map((pick, i) => {
                const posColor = POSITION_COLORS[pick.position] ?? 'bg-gray-700 text-gray-300 border-gray-600';
                return (
                  <TableRow key={`${pick.managerId}-${pick.season}-${pick.pickNo}`} className="border-card-border hover:bg-muted/30">
                    <TableCell className="py-3 px-2 pl-4 text-gray-400 text-sm w-8">{i + 1}</TableCell>
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
          {canExpand && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-gray-500 hover:text-gray-300 border-t border-card-border transition-colors"
            >
              {expanded ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> Show all {rows.length}</>}
            </button>
          )}
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
        });
      }
    }
    return rows.sort((a, b) => b.avgSurplus - a.avgSurplus).slice(0, 20);
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
    () => [...allPickRows].sort((a, b) => b.surplus - a.surplus).slice(0, 25),
    [allPickRows],
  );
  const busts = useMemo(
    () => [...allPickRows].sort((a, b) => a.surplus - b.surplus).slice(0, 25),
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

  return (
    <div className="space-y-6">
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
          iconClass="text-green-400"
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
        Surplus = pick WAR minus expected WAR for that round. Hit = top 30% WAR in round; Bust = bottom 30%.
      </p>
    </div>
  );
}
