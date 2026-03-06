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
      .select('status, cancel_at_period_end, current_period_end')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => {
        setIsPro(!!data);
        setCancelAtPeriodEnd(data?.cancel_at_period_end ?? false);
        setPeriodEnd(data?.current_period_end ?? null);
        setIsLoading(false);
      });
  }, [user, userLoading]);

  return { isPro, isLoading, cancelAtPeriodEnd, periodEnd };
}
