'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trophy, TrendingUp, Target, ArrowLeftRight, ClipboardList } from 'lucide-react';
import { AboutModal } from '@/components/AboutModal';
import { ContactModal } from '@/components/ContactModal';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { sleeperApi } from '@/api/sleeper';
import { saveSessionUser } from '@/hooks/useSessionUser';

const FEATURE_CARDS = [
  {
    icon: Trophy,
    title: 'All-Time Records',
    description: 'Championships, win streaks, blowouts, droughts.',
    color: 'text-yellow-400',
  },
  {
    icon: TrendingUp,
    title: 'Franchise Trajectory',
    description: 'Cumulative WAR across your entire league history.',
    color: 'text-brand-cyan',
  },
  {
    icon: Target,
    title: 'Franchise Outlook',
    description: '3-year projections and contender window analysis.',
    color: 'text-emerald-400',
  },
  {
    icon: ArrowLeftRight,
    title: 'Trade Intelligence',
    description: "Who's been winning the deal room?",
    color: 'text-purple-400',
  },
  {
    icon: ClipboardList,
    title: 'Draft Leaderboard',
    description: 'Steals, busts, and grades across all your drafts.',
    color: 'text-orange-400',
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

      // Fetch leagues for both active seasons in parallel
      const [l2024, l2025] = await Promise.all([
        sleeperApi.getUserLeagues(user.user_id, '2024').catch(() => []),
        sleeperApi.getUserLeagues(user.user_id, '2025').catch(() => []),
      ]);

      const allLeagues = [...(l2024 ?? []), ...(l2025 ?? [])];
      if (allLeagues.length === 0) throw new Error('No leagues found for this user');

      // Group by name
      const grouped = allLeagues.reduce<Record<string, typeof allLeagues>>((acc, l) => {
        (acc[l.name] ??= []).push(l);
        return acc;
      }, {});

      // Sort groups: longest tenure first (for auto-selection)
      const byTenure = Object.entries(grouped).sort(([, a], [, b]) => b.length - a.length);
      // Also sort by most recently active (for session storage)
      const byRecent = Object.entries(grouped).sort(([, a], [, b]) => {
        const maxA = Math.max(...a.map((l) => Number(l.season)));
        const maxB = Math.max(...b.map((l) => Number(l.season)));
        return maxB - maxA;
      });

      // Save session
      saveSessionUser({
        username: trimmed,
        userId: user.user_id,
        displayName: user.display_name,
        avatar: user.avatar ?? null,
        leagueGroups: byRecent,
      });

      // Navigate to the most recent season of the longest-tenured league
      const [, longestGroup] = byTenure[0];
      const latestLeague = [...longestGroup].sort(
        (a, b) => Number(b.season) - Number(a.season),
      )[0];

      router.push(`/league/${latestLeague.league_id}/overview`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-bg flex flex-col items-center justify-center px-4 font-sans gap-8 py-12">
      <Card className="relative z-10 w-full max-w-sm border-card-border gap-0 py-0">
        <CardHeader className="flex flex-col items-center text-center gap-3 pt-8 pb-6">
          <span className="text-5xl leading-none">📖</span>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl font-bold tracking-tight text-white">
              recordbook.fyi
            </CardTitle>
            <CardDescription>
              Fantasy football analytics for your Sleeper leagues
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-0 pb-8">
          <form id="username-form" onSubmit={handleSubmit}>
            <Field>
              <FieldLabel htmlFor="username">Username</FieldLabel>
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

        <CardFooter className="flex-col gap-3 border-t border-border pt-6 pb-6">
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
                Loading…
              </>
            ) : (
              'View Dashboard'
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Reads public league data from the Sleeper API
          </p>
        </CardFooter>
      </Card>

      {/* Feature preview */}
      <div className="w-full max-w-xl">
        <p className="text-center text-xs text-gray-500 uppercase tracking-widest mb-4">What you&apos;ll discover</p>
        <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible no-scrollbar">
          {FEATURE_CARDS.map(({ icon: Icon, title, description, color }) => (
            <div
              key={title}
              className="flex-shrink-0 w-44 sm:w-auto bg-card-bg border border-card-border rounded-2xl p-4 flex flex-col gap-2"
            >
              <Icon size={18} className={color} />
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
        <span>·</span>
        <ContactModal>
          <button className="hover:text-gray-300 transition-colors px-1.5 py-1 rounded hover:bg-white/5">
            Contact
          </button>
        </ContactModal>
        <span>·</span>
        <span className="text-gray-700">Free &amp; open · Made in Seattle 🌧️</span>
      </div>
    </div>
  );
}
