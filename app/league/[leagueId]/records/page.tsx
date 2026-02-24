'use client';

import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AllTimeRecords } from '@/components/AllTimeRecords';
import { YearOverYear } from '@/components/YearOverYear';
import { useYearOverYear } from '@/hooks/useLeagueData';

export default function RecordsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const yoyQuery = useYearOverYear(leagueId);

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Record Book</h2>
        <AllTimeRecords
          leagueId={leagueId}
          onSelectManager={(uid) => router.push(`/league/${leagueId}/managers/${uid}`)}
        />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">Year-Over-Year Trends</h2>
        {yoyQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-brand-cyan" size={24} />
          </div>
        ) : yoyQuery.data && yoyQuery.data.length >= 2 ? (
          <YearOverYear data={yoyQuery.data} />
        ) : null}
      </div>
    </div>
  );
}
