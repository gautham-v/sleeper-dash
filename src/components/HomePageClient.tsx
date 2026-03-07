'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { fetchUserLeaguesGrouped } from '@/utils/leagueSeasons';
import { useAuthContext } from '@/context/auth';
import { createClient } from '@/lib/supabase-browser';

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

// Shared helper: fetch leagues for a sleeper username and navigate to the default league
async function loadLeaguesAndRedirect({
  username,
  userId,
  displayName,
  avatar,
  router,
}: {
  username: string;
  userId: string;
  displayName: string;
  avatar: string | null;
  router: ReturnType<typeof useRouter>;
}) {
  const byRecent = await fetchUserLeaguesGrouped(userId);
  const byTenure = [...byRecent].sort(([, a], [, b]) => b.length - a.length);

  saveSessionUser({ username, userId, displayName, avatar, leagueGroups: byRecent });

  posthog.identify(userId, { username, display_name: displayName });
  posthog.capture('username_searched', { success: true, league_count: byRecent.reduce((n, [, g]) => n + g.length, 0) });

  const [, longestGroup] = byTenure[0];
  const latestLeague = [...longestGroup].sort(
    (a, b) => Number(b.season) - Number(a.season),
  )[0];

  router.push(`/league/${latestLeague.league_id}/overview`);
}

export function HomePageClient() {
  // Anonymous form state
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Link-Sleeper-account form state (shown when authenticated but no sleeper_username)
  const [linkValue, setLinkValue] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Google OAuth loading state
  const [oauthLoading, setOauthLoading] = useState(false);

  // Auth state from context
  const { user, loading: authLoading } = useAuthContext();

  const router = useRouter();
  const searchParams = useSearchParams();
  // When ?lookup=true, skip auto-redirect so user can search a different username
  const isLookupMode = searchParams.get('lookup') === 'true';

  // Fallback: if Supabase redirected the auth code to the root instead of /auth/callback,
  // exchange it here and clean up the URL
  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) return;
    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(() => {
      // Remove ?code= from the URL without a full reload
      router.replace('/');
    });
  }, [searchParams, router]);

  // Effect: if user is authenticated and has a linked Sleeper account, auto-load leagues
  // Skip this when in lookup mode (user wants to search a different username)
  useEffect(() => {
    if (authLoading || !user || isLookupMode) return;

    const supabase = createClient();
    supabase
      .from('user_profiles')
      .select('sleeper_user_id, sleeper_username, sleeper_display_name, sleeper_avatar')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (
          data?.sleeper_username &&
          data?.sleeper_user_id
        ) {
          setLoading(true);
          loadLeaguesAndRedirect({
            username: data.sleeper_username,
            userId: data.sleeper_user_id,
            displayName: data.sleeper_display_name ?? data.sleeper_username,
            avatar: data.sleeper_avatar ?? null,
            router,
          }).catch((err) => {
            const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
            setError(message);
            setLoading(false);
          });
        }
        // if no sleeper_username, the link-account UI will be rendered below
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, isLookupMode]);

  // Anonymous form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);

    try {
      const sleeperUser = await sleeperApi.getUser(trimmed);
      if (!sleeperUser?.user_id) throw new Error('User not found');

      await loadLeaguesAndRedirect({
        username: trimmed,
        userId: sleeperUser.user_id,
        displayName: sleeperUser.display_name,
        avatar: sleeperUser.avatar ?? null,
        router,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      posthog.capture('username_searched', { success: false, error: message });
      setError(message);
      setLoading(false);
    }
  };

  // Link Sleeper account submit (authenticated user, no sleeper_username yet)
  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = linkValue.trim();
    if (!trimmed || linkLoading || !user) return;

    setLinkLoading(true);
    setLinkError(null);

    try {
      const sleeperUser = await sleeperApi.getUser(trimmed);
      if (!sleeperUser?.user_id) throw new Error('Sleeper user not found');

      const supabase = createClient();
      const { error: upsertError } = await supabase.from('user_profiles').upsert({
        id: user.id,
        sleeper_user_id: sleeperUser.user_id,
        sleeper_username: trimmed,
        sleeper_display_name: sleeperUser.display_name ?? trimmed,
        sleeper_avatar: sleeperUser.avatar ?? null,
      });
      if (upsertError) throw new Error(upsertError.message);

      posthog.identify(sleeperUser.user_id, {
        username: trimmed,
        display_name: sleeperUser.display_name,
      });
      posthog.capture('sleeper_account_linked', { username: trimmed });

      await loadLeaguesAndRedirect({
        username: trimmed,
        userId: sleeperUser.user_id,
        displayName: sleeperUser.display_name ?? trimmed,
        avatar: sleeperUser.avatar ?? null,
        router,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setLinkError(message);
      setLinkLoading(false);
    }
  };

  // Google OAuth — forces account picker so user can choose a different account
  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://leaguemate.fyi'}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
    // Page will redirect; no need to reset oauthLoading
  };

  // Determine which card body to render
  const renderCardBody = () => {
    // Still resolving auth state — show a neutral spinner so the card doesn't flash
    if (authLoading) {
      return (
        <>
          <CardContent className="pt-6 pb-0 flex justify-center">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </CardContent>
          <CardFooter className="pt-4 pb-6" />
        </>
      );
    }

    // Authenticated user with a linked Sleeper account — auto-redirecting (only when not in lookup mode)
    if (user && loading && !isLookupMode) {
      return (
        <>
          <CardContent className="pt-6 pb-0 flex flex-col items-center gap-2">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Loading your leagues&hellip;</p>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </CardContent>
          <CardFooter className="pt-4 pb-6" />
        </>
      );
    }

    // Authenticated user without a linked Sleeper account (and not in lookup mode) — show link form
    if (user && !isLookupMode) {
      return (
        <>
          <CardContent className="pt-6 pb-0">
            <p className="text-xs text-muted-foreground mb-4">
              Signed in as <span className="text-white">{user.email}</span>. Link your Sleeper account to continue.
            </p>
            <form id="link-form" onSubmit={handleLinkSubmit}>
              <Field>
                <FieldLabel htmlFor="link-username">Sleeper Username</FieldLabel>
                <Input
                  id="link-username"
                  type="text"
                  value={linkValue}
                  onChange={(e) => { setLinkValue(e.target.value); setLinkError(null); }}
                  placeholder="e.g. sleeperuser123"
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={linkLoading}
                  className="focus-visible:ring-brand-cyan/30 focus-visible:border-brand-cyan/50 h-10"
                />
              </Field>
              {linkError && (
                <p className="mt-2 text-xs text-red-400">{linkError}</p>
              )}
            </form>
          </CardContent>
          <CardFooter className="flex-col gap-3 pt-4 pb-6">
            <Button
              type="submit"
              form="link-form"
              disabled={!linkValue.trim() || linkLoading}
              size="lg"
              className="w-full font-bold"
            >
              {linkLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Linking&hellip;
                </>
              ) : (
                'Link Sleeper Account'
              )}
            </Button>
          </CardFooter>
        </>
      );
    }

    // Unauthenticated — or lookup mode (search any username)
    return (
      <>
        <CardContent className="pt-6 pb-0">
          {isLookupMode ? (
            <p className="text-xs text-muted-foreground text-center mb-4">
              Enter a Sleeper username to look up their leagues
            </p>
          ) : (
            <>
              {/* Google sign-in */}
              <div className="mb-4">
                <p className="text-xs text-muted-foreground text-center mb-3">
                  Sign in to save your leagues across sessions
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full font-medium border-card-border bg-transparent hover:bg-white/5 text-white"
                  onClick={handleGoogleSignIn}
                  disabled={oauthLoading}
                >
                  {oauthLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Redirecting&hellip;
                    </>
                  ) : (
                    <>
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="w-4 h-4 shrink-0"
                      >
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      Continue with Google
                    </>
                  )}
                </Button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-card-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-card-border" />
              </div>
            </>
          )}

          {/* Username form — always shown */}
          <form id="username-form" onSubmit={handleSubmit}>
            <Field>
              <FieldLabel htmlFor="username">Sleeper Username</FieldLabel>
              <Input
                id="username"
                type="text"
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(null); }}
                placeholder="e.g. sleeperuser123"
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
          {!isLookupMode && (
            <p className="text-xs text-muted-foreground text-center">
              No account needed
            </p>
          )}
        </CardFooter>
      </>
    );
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
        {renderCardBody()}
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
