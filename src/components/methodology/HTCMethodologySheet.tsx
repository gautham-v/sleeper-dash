'use client';
import { useState, useRef } from 'react';
import { X, BarChart2, TrendingUp, Timer, Users, Target, Activity } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { DimensionCard } from './DimensionCard';

const HTC_DIMENSIONS = [
  {
    icon: BarChart2,
    label: 'Starting Value',
    description: 'Is this player earning their roster spot? Measures WAR contribution relative to a replacement-level starter at their position.',
  },
  {
    icon: TrendingUp,
    label: 'Dynasty Clock',
    description: "Are their best years ahead or behind them? Compares projected future value to current value and identifies where they sit in their peak window.",
  },
  {
    icon: Timer,
    label: 'Market Timing',
    description: 'Is now a good time to move this player? Flags declining trade value — ascending players always score low here, so the signal only fires when it matters.',
  },
  {
    icon: Users,
    label: 'Roster Fit',
    description: 'How much does your lineup actually need them? Considers positional scarcity, your specific starter slots, and the SuperFlex QB premium.',
  },
  {
    icon: Target,
    label: 'Team Direction',
    description: "Does keeping them match where your team is headed? Adapts to your team's mode — Rebuilding, Contending, Balanced, Asset Accumulation, or All-In.",
  },
  {
    icon: Activity,
    label: 'Current Status',
    description: 'Injury status, depth chart position, and experience level right now.',
  },
] as const;

const OVERRIDES = [
  'High-WAR players on IR are protected from cut recommendations',
  'Top-3 WAR contributors on your roster are always held',
  'Young players with strong upside get a floor regardless of score',
  'SuperFlex QBs receive a positional premium adjustment',
  "Required lineup starters can't be recommended for a cut",
  'High-confidence young assets are flagged for holds',
];

interface HTCMethodologySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HTCMethodologySheet({ open, onOpenChange }: HTCMethodologySheetProps) {
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) setDragY(0);
    onOpenChange(next);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
    setIsDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    setDragY(Math.max(0, e.touches[0].clientY - startYRef.current));
  };
  const onTouchEnd = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    if (dragY > 80) handleOpenChange(false);
    else setDragY(0);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        style={{
          maxHeight: '85dvh',
          overflowY: 'hidden',
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s ease-out',
        }}
        className="flex flex-col bg-base-bg text-white border-t border-card-border rounded-t-2xl p-0 [&>button]:hidden sm:max-w-md sm:mx-auto sm:rounded-2xl sm:border sm:border-card-border"
      >
        {/* Mobile drag handle */}
        <div
          className="sm:hidden flex-shrink-0 flex justify-center pt-3 pb-2 touch-none select-none cursor-grab active:cursor-grabbing"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-10 h-1.5 rounded-full bg-gray-600" />
        </div>

        {/* Desktop close */}
        <button
          onClick={() => handleOpenChange(false)}
          className="hidden sm:flex absolute right-4 top-4 text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <SheetTitle className="sr-only">How Hold / Trade / Cut verdicts work</SheetTitle>

        <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-8 pt-1 sm:pt-6 sm:px-6 space-y-5">
          {/* Header */}
          <div>
            <h2 className="text-base font-bold text-white">How Verdicts Work</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Each player is scored across six dimensions. Weights and thresholds shift based on your team's
              strategy — a rebuilding team's HOLD is much harder to earn than a contender's.
            </p>
          </div>

          {/* Strategy mode callout */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3.5">
            <div className="text-xs font-semibold text-white mb-1">Strategy Mode adjusts everything</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              A <span className="text-white">Balanced</span> team needs a strong score to earn a HOLD.
              A <span className="text-white">Full Rebuild</span> sets an even higher bar.
              A <span className="text-white">Push All-In</span> contender has a lower threshold — holding
              productive veterans is the priority.
            </p>
          </div>

          {/* Six dimensions */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              6 Signal Dimensions
            </div>
            <div className="space-y-2">
              {HTC_DIMENSIONS.map((d) => (
                <DimensionCard key={d.label} icon={d.icon} label={d.label} description={d.description} />
              ))}
            </div>
          </div>

          {/* Override rules */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Protective Overrides
            </div>
            <div className="bg-card-bg border border-card-border rounded-lg p-3.5 space-y-2">
              {OVERRIDES.map((rule) => (
                <div key={rule} className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5 flex-shrink-0">·</span>
                  <span className="text-xs text-muted-foreground leading-relaxed">{rule}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Confidence */}
          <div className="bg-card-bg border border-card-border rounded-lg p-3.5">
            <div className="text-xs font-semibold text-white mb-1">About Confidence</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Confidence reflects how far a score sits from the decision boundary. A high-confidence HOLD
              is a clear signal. A low-confidence TRADE is worth revisiting next month.
            </p>
          </div>

          {/* How It Works link */}
          <a
            href="/how-it-works"
            className="block text-xs text-muted-foreground hover:text-white transition-colors text-center pt-1"
          >
            Full methodology →
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
