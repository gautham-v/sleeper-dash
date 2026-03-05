'use client';
import { useState, useRef } from 'react';
import { X, DollarSign, Zap, Users, Clock, TrendingUp } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { DimensionCard } from './DimensionCard';

const DRAFT_FACTORS = [
  {
    icon: DollarSign,
    label: 'Market Value',
    description: 'Current consensus dynasty rankings and trade values — the primary anchor. Dynasty value dominates the final score.',
  },
  {
    icon: Zap,
    label: 'Prospect Pedigree',
    description: 'College production metrics (target share, air yards dominance) and athletic testing relative to position. Rewards both production and measurables.',
  },
  {
    icon: Users,
    label: 'Roster Need',
    description: 'Vacancy severity at each position on your roster. A critical positional need boosts a player\'s fit score significantly.',
  },
  {
    icon: Clock,
    label: 'Development Timeline',
    description: 'How quickly this position typically contributes vs. your competitive window. RBs are immediate; WRs peak year 2; QBs and TEs need year 3+.',
  },
  {
    icon: TrendingUp,
    label: 'Pick Value',
    description: 'Whether the draft capital cost to acquire this player is above or below expected value for their class position.',
  },
] as const;

interface RookieMethodologySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RookieMethodologySheet({ open, onOpenChange }: RookieMethodologySheetProps) {
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

        <SheetTitle className="sr-only">How the Draft Board works</SheetTitle>

        <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-8 pt-1 sm:pt-6 sm:px-6 space-y-5">
          {/* Header */}
          <div>
            <h2 className="text-base font-bold text-white">How the Draft Board Works</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Every prospect gets a score built from five factors. Dynasty market value is the anchor — the rest
              adjusts up or down from there based on your specific roster.
            </p>
          </div>

          {/* Five factors */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              5 Scoring Factors
            </div>
            <div className="space-y-2">
              {DRAFT_FACTORS.map((d) => (
                <DimensionCard key={d.label} icon={d.icon} label={d.label} description={d.description} />
              ))}
            </div>
          </div>

          {/* Historical comps */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Historical Comps
            </div>
            <div className="bg-card-bg border border-card-border rounded-lg p-3.5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Each prospect is matched to similar players from{' '}
                <span className="text-white font-medium">10 years of draft history</span> (2015–2025, 1,100+ players)
                using their position rank in their draft class, pick number, breakout age, and college usage.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                The resulting probability distributions show how players with similar profiles historically performed
                — not how this specific player will perform. Low-confidence comps are clearly labeled.
              </p>
            </div>
          </div>

          {/* Badge explainer */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Timeline Badges
            </div>
            <div className="bg-card-bg border border-card-border rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-xs font-medium w-20 flex-shrink-0">⚡ Immediate</span>
                <span className="text-xs text-muted-foreground">RBs who typically contribute in year one</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 text-xs font-medium w-20 flex-shrink-0">📈 Year 2</span>
                <span className="text-xs text-muted-foreground">WRs who usually need a season to develop</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 text-xs font-medium w-20 flex-shrink-0">🕐 Year 3+</span>
                <span className="text-xs text-muted-foreground">QBs and TEs with longer development curves</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t border-card-border">
                These are position-based norms, not individual predictions.
              </p>
            </div>
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
