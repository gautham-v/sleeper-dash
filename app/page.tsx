'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { Loader2, Brain, Target, TrendingUp } from 'lucide-react';
import { AboutModal } from '@/components/AboutModal';
import { ContactModal } from '@/components/ContactModal';
import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { sleeperApi } from '@/api/sleeper';
import { saveSessionUser } from '@/hooks/useSessionUser';

const PILLARS = [
  {
    icon: Brain,
    title: 'Dynasty Strategy Engine',
    description: 'Personalized Hold / Trade / Cut verdicts with reasons.',
    color: 'text-emerald-400',
    isNew: true,
  },
  {
    icon: Target,
    title: 'Rookie Draft Intelligence',
    description: 'Prospect comps from 3,500+ historical rookies.',
    color: 'text-sky-400',
    isNew: true,
  },
  {
    icon: TrendingUp,
    title: 'Franchise Outlook & Trades',
    description: '3-year projections and trade impact simulation.',
    color: 'text-purple-400',
    isNew: false,
  },
] as const;

export default function HomePage() {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);

    try {
      const user = await sleeperApi.getUser(trimmed);
      if (!user?.user_id) throw new Error('User not found');

      const [l2024, l2025] = await Promise.all([
        sleeperApi.getUserLeagues(user.user_id, '2024').catch(() => []),
        sleeperApi.getUserLeagues(user.user_id, '2025').catch(() => []),
      ]);

      const allLeagues = [...(l2024 ?? []), ...(l2025 ?? [])];
      if (allLeagues.length === 0) throw new Error('No leagues found for this user');

      const grouped = allLeagues.reduce<Record<string, typeof allLeagues>>((acc, l) => {
        (acc[l.name] ??= []).push(l);
        return acc;
      }, {});

      const byTenure = Object.entries(grouped).sort(([, a], [, b]) => b.length - a.length);
      const byRecent = Object.entries(grouped).sort(([, a], [, b]) => {
        const maxA = Math.max(...a.map((l) => Number(l.season)));
        const maxB = Math.max(...b.map((l) => Number(l.season)));
        return maxB - maxA;
      });

      saveSessionUser({
        username: trimmed,
        userId: user.user_id,
        displayName: user.display_name,
        avatar: user.avatar ?? null,
        leagueGroups: byRecent,
      });

      posthog.identify(user.user_id, {
        username: trimmed,
        display_name: user.display_name,
      });

      posthog.capture('username_searched', { success: true, league_count: allLeagues.length });

      const [, longestGroup] = byTenure[0];
      const latestLeague = [...longestGroup].sort(
        (a, b) => Number(b.season) - Number(a.season),
      )[0];

      router.push(`/league/${latestLeague.league_id}/overview`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      posthog.capture('username_searched', { success: false, error: message });
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-bg flex flex-col items-center justify-center px-4 font-sans gap-8 py-16">

      {/* Hero */}
      <div className="text-center space-y-3 max-w-lg">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-white">leaguemate</span><span className="text-muted-foreground">.fyi</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Dynasty strategy, built around your roster.
        </p>
      </div>

      {/* Login card */}
      <Card className="relative z-10 w-full max-w-sm border-card-border gap-0 py-0">
        <CardContent className="pt-6 pb-0">
          <form id="username-form" onSubmit={handleSubmit}>
            <Field>
              <FieldLabel htmlFor="username">Sleeper Username</FieldLabel>
              <Input
                id="username"
                type="text"
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(null); }}
                placeholder="e.g. sleeperuser123"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={loading}
                className="focus-visible:ring-brand-cyan/30 focus-visible:border-brand-cyan/50 h-10"
              />
            </Field>
            {error && (
              <p className="mt-2 text-xs text-red-400">{error}</p>
            )}
          </form>
        </CardContent>

        <CardFooter className="flex-col gap-3 pt-4 pb-6">
          <Button
            type="submit"
            form="username-form"
            disabled={!value.trim() || loading}
            size="lg"
            className="w-full font-bold"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Loading&hellip;
              </>
            ) : (
              'View My Dashboard'
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            No account needed
          </p>
        </CardFooter>
      </Card>

      {/* Three pillars */}
      <div className="w-full max-w-2xl">
        <p className="text-center text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-4">
          What makes it different
        </p>
        <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible no-scrollbar">
          {PILLARS.map(({ icon: Icon, title, description, color, isNew }) => (
            <div
              key={title}
              className="flex-shrink-0 w-56 sm:w-auto bg-card-bg border border-card-border rounded-2xl p-4 flex flex-col gap-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <Icon size={18} className={color} />
                {isNew && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full leading-none">
                    New
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold text-white leading-tight">{title}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1.5 text-xs text-gray-600">
        <AboutModal>
          <button className="hover:text-gray-300 transition-colors px-1.5 py-1 rounded hover:bg-white/5">
            About
          </button>
        </AboutModal>
        <span>&middot;</span>
        <a
          href="/how-it-works"
          className="hover:text-gray-300 transition-colors px-1.5 py-1 rounded hover:bg-white/5"
        >
          How It Works
        </a>
        <span>&middot;</span>
        <ContactModal>
          <button className="hover:text-gray-300 transition-colors px-1.5 py-1 rounded hover:bg-white/5">
            Contact
          </button>
        </ContactModal>
        <span>&middot;</span>
        <a
          href="/terms"
          className="hover:text-gray-300 transition-colors px-1.5 py-1 rounded hover:bg-white/5"
        >
          Terms
        </a>
      </div>
    </div>
  );
}
