'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { LeagueTrades } from '@/components/LeagueTrades';
import { TradeStrategyTab } from '@/components/TradeStrategyTab';
import { ShareButton } from '@/components/ShareButton';

type TradesPageTab = 'trades' | 'strategy';

export default function TradesPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [activeTab, setActiveTab] = useState<TradesPageTab>('trades');

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Trade Analyzer</h2>
          <p className="text-gray-400 text-sm">
            Analyze every trade in league history and see who came out on top.
          </p>
        </div>
        <ShareButton className="mt-1" />
      </div>

      <div className="flex border-b border-card-border mb-6">
        <button
          onClick={() => setActiveTab('trades')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'trades'
              ? 'border-brand-cyan text-white'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          League Trades
        </button>
        <button
          onClick={() => setActiveTab('strategy')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'strategy'
              ? 'border-brand-cyan text-white'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          Trade Strategy
        </button>
      </div>

      {activeTab === 'trades' && <LeagueTrades leagueId={leagueId} />}
      {activeTab === 'strategy' && <TradeStrategyTab leagueId={leagueId} />}
    </div>
  );
}
