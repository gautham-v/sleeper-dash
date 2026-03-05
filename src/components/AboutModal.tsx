'use client';
import { useState, useRef } from 'react';
import { X, Globe, Linkedin, Mail, ExternalLink } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export function AboutModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) setDragY(0);
    setOpen(next);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const dy = Math.max(0, e.touches[0].clientY - startYRef.current);
    setDragY(dy);
  };

  const onTouchEnd = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    if (dragY > 80) {
      setOpen(false);
    } else {
      setDragY(0);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="bottom"
        style={{
          maxHeight: '75dvh',
          overflowY: 'hidden',
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s ease-out',
        }}
        className="flex flex-col bg-base-bg text-white border-t border-card-border rounded-t-2xl p-0 [&>button]:hidden sm:max-w-xl sm:mx-auto sm:rounded-2xl sm:border sm:border-card-border"
      >
        {/* Mobile drag handle — outside the scroll area, full-width touch target */}
        <div
          className="sm:hidden flex-shrink-0 flex justify-center pt-3 pb-3 touch-none select-none cursor-grab active:cursor-grabbing"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-10 h-1.5 rounded-full bg-gray-600" />
        </div>

        {/* Desktop close button */}
        <button
          onClick={() => setOpen(false)}
          className="hidden sm:flex absolute right-4 top-4 text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <SheetTitle className="sr-only">About leaguemate.fyi</SheetTitle>

        {/* Scrollable content — separate from drag handle */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-8 pt-1 sm:pt-6 sm:px-7 space-y-6">

          {/* Header */}
          <div className="flex items-center gap-3.5">
            <span className="text-4xl leading-none">🏈</span>
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">leaguemate.fyi</h2>
              <p className="text-sm text-gray-400 mt-0.5">Dynasty strategy, built around your roster</p>
            </div>
          </div>

          {/* Story */}
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">The Story</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              Hey, I&apos;m <span className="text-white font-semibold">Gautham</span> &mdash; a product manager based in{' '}
              <span className="text-white font-semibold">Seattle, WA</span>. I built leaguemate.fyi because I was tired
              of generic dynasty advice that didn&apos;t account for my actual roster, my league format, or where my
              team was in its rebuild cycle. So I built the tool I wanted.
            </p>
          </section>

          {/* What it does */}
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">What It Does</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              leaguemate.fyi is a <span className="text-white font-semibold">personalized dynasty strategy engine</span>.
              It ingests your Sleeper roster and cross-references a database of{' '}
              <span className="text-white font-semibold">3,500+ historical rookies</span> to generate Hold, Trade, or
              Cut verdicts tuned to your team&apos;s strategy &mdash; not the market at large. It&apos;s{' '}
              <span className="text-white font-semibold">completely free</span> &mdash; no ads, no accounts, no paywalls.
            </p>
          </section>

          {/* Nights & weekends */}
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Nights &amp; Weekends</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              This is a <span className="text-white font-semibold">one-person passion project</span> built and
              maintained entirely by me in my free time. What started as a historical stats dashboard evolved into a
              full strategy recommendation engine backed by a real historical database &mdash; because one rabbit hole
              leads to another.
            </p>
          </section>

          {/* Tech stack */}
          <section className="space-y-2.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Under the Hood</h3>
            <div className="flex flex-wrap gap-2">
              {[
                'Next.js',
                'TypeScript',
                'Supabase',
                'Tailwind CSS v4',
                'TanStack Query',
                'shadcn/ui',
                'Sleeper API',
              ].map((tech) => (
                <span
                  key={tech}
                  className="text-xs bg-white/5 border border-card-border rounded-lg px-2.5 py-1 text-gray-300 font-medium"
                >
                  {tech}
                </span>
              ))}
            </div>
          </section>

          {/* Links */}
          <div className="border-t border-card-border pt-4 flex flex-wrap gap-4">
            <a
              href="https://gauthamv.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors group"
            >
              <Globe size={14} className="group-hover:text-brand-cyan transition-colors" />
              gauthamv.com
              <ExternalLink size={11} className="text-gray-600 group-hover:text-gray-400" />
            </a>
            <a
              href="https://linkedin.com/in/gautham-v"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors group"
            >
              <Linkedin size={14} className="group-hover:text-brand-cyan transition-colors" />
              LinkedIn
              <ExternalLink size={11} className="text-gray-600 group-hover:text-gray-400" />
            </a>
            <a
              href="mailto:gvem@duck.com"
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors group"
            >
              <Mail size={14} className="group-hover:text-brand-cyan transition-colors" />
              gvem@duck.com
            </a>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
