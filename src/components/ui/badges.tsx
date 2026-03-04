import { cn } from '@/lib/utils';

// ── PosBadge ──────────────────────────────────────────────────────────────────
// Dark-first colors — adapt via CSS variable remapping in light mode (globals.css)

const POS_COLORS: Record<string, string> = {
  // red/yellow/green/gray have CSS-variable remapping in globals.css → auto-adapt in light mode
  QB:   'bg-red-900/50 text-red-300 border-red-800/50',
  RB:   'bg-green-900/50 text-green-400 border-green-700/50',  // text-green-400 remaps to dark green in light mode
  TE:   'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
  K:    'bg-gray-700 text-gray-300 border-gray-600',
  // indigo has CSS-variable remapping (800→light, 300→dark) → works in both modes
  WR:   'bg-indigo-800/40 text-indigo-300 border-indigo-600/40',
  // purple doesn't remap — bg stays dark in light mode; use text-white for contrast in both modes
  DEF:  'bg-purple-900/50 text-white border-purple-800/50',
  DST:  'bg-purple-900/50 text-white border-purple-800/50',
  PICK: 'bg-purple-900/50 text-white border-purple-800/50',
};

const POS_FALLBACK = 'bg-gray-800/50 text-gray-400 border-gray-700/50';

export function PosBadge({ pos }: { pos: string }) {
  const cls = POS_COLORS[pos] ?? POS_FALLBACK;
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold border min-w-[2.5rem] text-center shrink-0 ${cls}`}>
      {pos}
    </span>
  );
}

// ── TierBadge ─────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  // emerald-800 remaps to light green in light mode; emerald-900 doesn't remap
  Contender:  'bg-emerald-800/40 text-emerald-400 border-emerald-800/40',
  Fringe:     'bg-yellow-900/40 text-yellow-400 border-yellow-700/40',
  Rebuilding: 'bg-red-900/40 text-red-400 border-red-700/40',
};

export function TierBadge({ tier, size = 'md', label }: { tier: string; size?: 'sm' | 'md'; label?: string }) {
  const cls = TIER_COLORS[tier] ?? POS_FALLBACK;
  const sizeCls = size === 'sm'
    ? 'px-2 py-0.5 rounded text-xs font-semibold border'
    : 'px-3 py-1 rounded-lg text-sm font-bold border';
  return (
    <span className={`inline-block ${sizeCls} ${cls}`}>
      {label ?? tier}
    </span>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  win:              'bg-green-900/30 text-green-400 border-green-700/40',
  loss:             'bg-red-900/30 text-red-400 border-red-700/40',
  even:             'bg-gray-800/50 text-gray-400 border-gray-700/40',
  pending:          'bg-yellow-900/30 text-yellow-400 border-yellow-700/40',
  'buy-low':        'bg-orange-900/40 text-orange-300 border-orange-800/50',
  'closing-window': 'bg-yellow-800/40 text-yellow-400 border-yellow-700/40',
  'ideal-fit':      'bg-emerald-800/40 text-emerald-400 border-emerald-800/40',
  'good-fit':       'bg-blue-900/40 text-blue-300 border-blue-800/50',
  drafted:          'bg-yellow-900/40 text-yellow-400 border-yellow-700/40',
  current:          'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/30',
};

const STATUS_LABELS: Record<string, string> = {
  win:              'Win',
  loss:             'Loss',
  even:             'Even',
  pending:          'Pending',
  'buy-low':        'Buy Low',
  'closing-window': 'Closing Window',
  'ideal-fit':      'Ideal fit',
  'good-fit':       'Good fit',
  drafted:          'drafted',
  current:          'current',
};

export function StatusBadge({
  variant,
  label,
  className,
}: {
  variant: keyof typeof STATUS_COLORS;
  label?: string;
  className?: string;
}) {
  const cls = STATUS_COLORS[variant] ?? POS_FALLBACK;
  const text = label ?? STATUS_LABELS[variant] ?? variant;
  return (
    <span className={cn('inline-block px-1.5 py-0.5 rounded text-xs font-medium border', cls, className)}>
      {text}
    </span>
  );
}
