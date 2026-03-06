'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useSupabaseUser } from './useSupabaseUser';

export function useSubscription(): { isPro: boolean; isLoading: boolean; cancelAtPeriodEnd: boolean; periodEnd: string | null } {
  const { user, loading: userLoading } = useSupabaseUser();
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;

    if (!user) {
      setIsPro(false);
      setCancelAtPeriodEnd(false);
      setPeriodEnd(null);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    supabase
      .from('subscriptions')
      .select('status, cancel_at_period_end, current_period_end, cancel_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => {
        setIsPro(!!data);
        // Stripe may use either cancel_at_period_end (bool) or cancel_at (timestamp)
        // to indicate a scheduled cancellation depending on how the portal cancels
        const isCanceling = data?.cancel_at_period_end || !!data?.cancel_at;
        setCancelAtPeriodEnd(isCanceling ?? false);
        // Prefer cancel_at (absolute timestamp) over current_period_end for the display date
        setPeriodEnd(data?.cancel_at ?? data?.current_period_end ?? null);
        setIsLoading(false);
      });
  }, [user, userLoading]);

  return { isPro, isLoading, cancelAtPeriodEnd, periodEnd };
}
