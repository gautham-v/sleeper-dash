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

        <SheetTitle className="sr-only">About recordbook.fyi</SheetTitle>

        {/* Scrollable content — separate from drag handle */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-8 pt-1 sm:pt-6 sm:px-7 space-y-6">

          {/* Header */}
          <div className="flex items-center gap-3.5">
            <span className="text-4xl leading-none">📖</span>
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">recordbook.fyi</h2>
              <p className="text-sm text-gray-400 mt-0.5">Fantasy football analytics for Sleeper leagues</p>
            </div>
          </div>

          {/* Story */}
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">The Story</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              Hey, I'm <span className="text-white font-semibold">Gautham</span> 👋 — a product manager based in{' '}
              <span className="text-white font-semibold">Seattle, WA</span> 🌧️🏔️. I built recordbook.fyi because I
              wanted deeper historical stats for my own Sleeper leagues and figured other fantasy nerds might too.
            </p>
          </section>

          {/* Nights & weekends */}
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Nights & Weekends 🌙</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              This site is a <span className="text-white font-semibold">one-person passion project</span> built and
              maintained entirely by me in my free time. It's{' '}
              <span className="text-white font-semibold">completely free</span> — no ads, no accounts, no paywalls.
              Your public Sleeper data loads directly in the browser.
            </p>
          </section>

          {/* Tech stack */}
          <section className="space-y-2.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">🛠️ Under the Hood</h3>
            <div className="flex flex-wrap gap-2">
              {[
                'React 19',
                'TypeScript',
                'Vite',
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

          {/* Fun fact */}
          <div className="bg-card-bg border border-card-border rounded-xl p-4">
            <p className="text-xs text-gray-400 leading-relaxed">
              ☕ Fun fact: this app has no backend and no database. Every stat and record you see is computed live
              from the Sleeper API — right there in your browser.
            </p>
          </div>

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
