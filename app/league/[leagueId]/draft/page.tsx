'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DraftLeaderboard } from '@/components/DraftLeaderboard';
import { RookieTargetsTab } from '@/components/RookieTargetsTab';
import { ShareButton } from '@/components/ShareButton';

type DraftPageTab = 'analysis' | 'rookies';

export default function DraftPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DraftPageTab>('analysis');

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Draft Analysis</h2>
          <p className="text-gray-400 text-sm">
            League-wide draft performance — steals, busts, and who's actually winning the draft.
          </p>
        </div>
        <ShareButton className="mt-1" />
      </div>

      <div className="flex border-b border-card-border mb-6">
        <button
          onClick={() => setActiveTab('analysis')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'analysis'
              ? 'border-brand-cyan text-white'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          Draft Analysis
        </button>
        <button
          onClick={() => setActiveTab('rookies')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'rookies'
              ? 'border-brand-cyan text-white'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          Rookie Targets
        </button>
      </div>

      {activeTab === 'analysis' && (
        <DraftLeaderboard
          leagueId={leagueId}
          onSelectManager={(uid) => router.push(`/league/${leagueId}/managers/${uid}`)}
        />
      )}
      {activeTab === 'rookies' && <RookieTargetsTab leagueId={leagueId} />}
    </div>
  );
}
