'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useSessionUser } from '@/hooks/useSessionUser';

export default function CareerPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const sessionUser = useSessionUser();

  useEffect(() => {
    if (sessionUser?.userId) {
      router.replace(`/league/${leagueId}/managers/${sessionUser.userId}/career-stats`);
    }
  }, [sessionUser, leagueId, router]);

  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-brand-cyan" size={24} />
    </div>
  );
}
