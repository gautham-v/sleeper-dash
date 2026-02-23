'use client';

import { useParams, useRouter } from 'next/navigation';
import { AllTimeRecords } from '@/components/AllTimeRecords';

export default function RecordsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Record Book</h2>
      <AllTimeRecords
        leagueId={leagueId}
        onSelectManager={(uid) => router.push(`/league/${leagueId}/managers/${uid}`)}
      />
    </div>
  );
}
