'use client';

import { useState, useEffect } from 'react';
import { X, Lock, Zap, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase-browser';
import { useAuthContext } from '@/context/auth';

interface UpgradeModalProps {
  leagueCount: number;
  onClose: () => void;
}

const ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL!;

async function startCheckout(priceId: string): Promise<void> {
  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      priceId,
      successUrl: window.location.href,
      cancelUrl: window.location.href,
    }),
  });

  if (!res.ok) {
    console.error('Checkout error', await res.text());
    return;
  }

  const { url } = await res.json() as { url: string };
  if (url) window.location.href = url;
}

export function UpgradeModal({ leagueCount, onClose }: UpgradeModalProps) {
  const { user, loading } = useAuthContext();
  const [loadingPrice, setLoadingPrice] = useState<string | null>(null);
  const [view, setView] = useState<'upgrade' | 'signin'>('upgrade');

  useEffect(() => {
    if (!loading) {
      setView(user ? 'upgrade' : 'signin');
    }
  }, [loading, user]);

  const handleCheckout = async (priceId: string) => {
    if (!user) {
      setView('signin');
      return;
    }
    setLoadingPrice(priceId);
    await startCheckout(priceId);
    setLoadingPrice(null);
  };

  const handleGoogleSignIn = async () => {
    const next = encodeURIComponent(window.location.pathname + '?upgrade=true');
    await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
        queryParams: { prompt: 'select_account' },
      },
    });
  };

  if (loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card-bg border border-card-border rounded-2xl overflow-hidden shadow-2xl">

        {/* Header — shared between views */}
        <div className="relative px-5 pt-5 pb-4 border-b border-card-border/60">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center">
              <Lock size={15} className="text-brand-cyan" />
            </div>
            <h2 className="text-base font-bold text-white">Unlock all your leagues</h2>
          </div>
          <p className="text-sm text-gray-400">
            {view === 'signin'
              ? 'Sign in to continue'
              : leagueCount > 1
                ? `Switch between all ${leagueCount} leagues from one dashboard.`
                : 'Manage all your leagues from one persistent dashboard.'}
          </p>
        </div>

        {view === 'signin' ? (
          /* Sign-in body */
          <div className="px-5 py-6 space-y-4">
            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-card-border bg-transparent hover:bg-white/5 text-white text-sm font-medium transition-colors"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
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
            </button>

            <p className="text-[11px] text-gray-600 text-center">
              Free to try · No credit card until you choose a plan
            </p>

            <div className="text-center">
              <button
                onClick={() => setView('upgrade')}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Feature list */}
            <div className="px-5 py-4 space-y-2.5">
              {[
                { icon: Zap, text: 'One-tap league switching' },
                { icon: Star, text: 'Saved leagues across sessions' },
                { icon: Zap, text: 'Future premium features included' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 text-sm text-gray-300">
                  <Icon size={14} className="text-brand-cyan flex-shrink-0" />
                  {text}
                </div>
              ))}
            </div>

            {/* Pricing CTA */}
            <div className="px-5 pb-5 space-y-2.5">
              <Button
                className="w-full font-bold"
                size="lg"
                disabled={!!loadingPrice}
                onClick={() => handleCheckout(ANNUAL_PRICE_ID)}
              >
                {loadingPrice === ANNUAL_PRICE_ID ? 'Loading...' : 'Get Pro — $19.99 / year'}
              </Button>

              <p className="text-[10px] text-gray-600 text-center">
                Cancel anytime. Shared links always stay free.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
