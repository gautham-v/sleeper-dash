'use client';

import { useParams, useRouter } from 'next/navigation';
import { AllTimeRecords } from '@/components/AllTimeRecords';
import { ShareButton } from '@/components/ShareButton';

export default function RecordsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">Record Book</h2>
          <ShareButton />
        </div>
        <AllTimeRecords
          leagueId={leagueId}
          onSelectManager={(uid) => router.push(`/league/${leagueId}/managers/${uid}`)}
        />
      </div>
    </div>
  );
}
