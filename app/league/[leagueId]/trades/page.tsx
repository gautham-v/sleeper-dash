'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { LeagueTrades } from '@/components/LeagueTrades';
import { TradeStrategyTab } from '@/components/TradeStrategyTab';
import { TradeSimulatorPanel } from '@/components/TradeSimulatorPanel';
import { ShareButton } from '@/components/ShareButton';
import { useFranchiseOutlook, type FranchiseOutlookData } from '@/hooks/useFranchiseOutlook';
import { useTradeSimulator } from '@/hooks/useTradeSimulator';
import { useDashboardData } from '@/hooks/useLeagueData';
import { useSessionUser } from '@/hooks/useSessionUser';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FranchiseOutlookResult, FranchiseOutlookRawContext } from '@/types/sleeper';

type TradesPageTab = 'trades' | 'strategy' | 'simulator';

// Inner component so hooks run unconditionally after data loads
interface SimulatorContentProps {
  userId: string;
  data: FranchiseOutlookData;
}
function SimulatorContent({ userId, data }: SimulatorContentProps) {
  const beforeOutlook: FranchiseOutlookResult | null = data.outlookMap.get(userId) ?? null;
  const rawContext: FranchiseOutlookRawContext = data.rawContext;
  const simulator = useTradeSimulator(userId, rawContext, beforeOutlook);
  return <TradeSimulatorPanel simulator={simulator} mode="fullpage" />;
}

export default function TradesPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [activeTab, setActiveTab] = useState<TradesPageTab>('trades');

  const sessionUser = useSessionUser();
  const { computed } = useDashboardData(leagueId);
  const franchiseOutlook = useFranchiseOutlook(leagueId);

  const defaultUserId = useMemo(() => {
    if (!computed) return '';
    const standingIds = computed.standings.map((s) => s.userId);
    if (sessionUser?.userId && standingIds.includes(sessionUser.userId)) {
      return sessionUser.userId;
    }
    return standingIds[0] ?? '';
  }, [computed, sessionUser]);

  const [selectedUserId, setSelectedUserId] = useState('');
  const effectiveUserId = selectedUserId || defaultUserId;

  const managers = useMemo(() => {
    if (!computed) return [];
    return computed.standings
      .filter((s) => !!s.userId)
      .map((s) => ({ userId: s.userId, displayName: s.displayName }));
  }, [computed]);

  const TAB_LABELS: { id: TradesPageTab; label: string }[] = [
    { id: 'trades', label: 'Trade History' },
    { id: 'strategy', label: 'Trade Strategy' },
    { id: 'simulator', label: 'Simulator' },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Trades</h2>
          <p className="text-gray-400 text-sm">
            Browse league trade history, analyze your roster strategy, and simulate trades before you make them.
          </p>
        </div>
        <ShareButton className="mt-1" />
      </div>

      <div className="flex border-b border-card-border mb-6">
        {TAB_LABELS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === id
                ? 'border-brand-cyan text-white'
                : 'border-transparent text-muted-foreground hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'trades' && <LeagueTrades leagueId={leagueId} />}
      {activeTab === 'strategy' && <TradeStrategyTab leagueId={leagueId} />}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          {managers.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 flex-shrink-0">Viewing as:</span>
              <Select value={effectiveUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="bg-card-bg border-card-border text-white w-56">
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent className="bg-card-bg border-card-border text-white">
                  {managers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {franchiseOutlook.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin text-brand-cyan mr-2" size={24} />
              <span className="text-gray-400 text-sm">Computing franchise outlook…</span>
            </div>
          ) : franchiseOutlook.data && effectiveUserId ? (
            <SimulatorContent userId={effectiveUserId} data={franchiseOutlook.data} />
          ) : (
            <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
              <div className="text-2xl mb-3">⚗️</div>
              <div className="text-sm font-medium text-gray-300">Simulator unavailable</div>
              <div className="text-xs text-gray-500 mt-1">Roster and player data could not be loaded.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
