'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DraftLeaderboard } from '@/components/DraftLeaderboard';
import { RookieTargetsTab } from '@/components/RookieTargetsTab';
import { ShareButton } from '@/components/ShareButton';

type DraftPageTab = 'analysis' | 'rookies';

function getRookieSeasonDefaults() {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const isRookieSeason = month >= 2 && month <= 5; // March–June
  const nflDraftDate = new Date(`${now.getFullYear()}-04-23`);
  const daysUntilDraft = Math.ceil((nflDraftDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const showCountdown = daysUntilDraft > 0 && daysUntilDraft <= 90;
  return { isRookieSeason, daysUntilDraft, showCountdown };
}

export default function DraftPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const { isRookieSeason, daysUntilDraft, showCountdown } = getRookieSeasonDefaults();
  const [activeTab, setActiveTab] = useState<DraftPageTab>(isRookieSeason ? 'rookies' : 'analysis');

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

      {showCountdown && (
        <div className="mb-5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 flex items-center gap-3">
          <span className="text-base">🏈</span>
          <span className="text-sm text-amber-400">
            <span className="font-semibold">NFL Draft in {daysUntilDraft} days</span>
            <span className="opacity-70 ml-2">— check your rookie targets below</span>
          </span>
        </div>
      )}

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
