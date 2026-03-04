'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useFranchiseOutlook, type FranchiseOutlookData } from '@/hooks/useFranchiseOutlook';
import { useTradeSimulator } from '@/hooks/useTradeSimulator';
import { TradeSimulatorPanel } from '@/components/TradeSimulatorPanel';
import { useDashboardData } from '@/hooks/useLeagueData';
import { useSessionUser } from '@/hooks/useSessionUser';
import { ShareButton } from '@/components/ShareButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FranchiseOutlookResult, FranchiseOutlookRawContext } from '@/types/sleeper';

// ── Inner component — only rendered after data loads so hooks run unconditionally ──

interface SimulateContentProps {
  leagueId: string;
  userId: string;
  data: FranchiseOutlookData;
}

function SimulateContent({ leagueId: _leagueId, userId, data }: SimulateContentProps) {
  const beforeOutlook: FranchiseOutlookResult | null = data.outlookMap.get(userId) ?? null;
  const rawContext: FranchiseOutlookRawContext = data.rawContext;

  const simulator = useTradeSimulator(userId, rawContext, beforeOutlook);

  return <TradeSimulatorPanel simulator={simulator} mode="fullpage" />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SimulatePage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const sessionUser = useSessionUser();
  const { computed } = useDashboardData(leagueId);
  const franchiseOutlook = useFranchiseOutlook(leagueId);

  // Default userId: session user if in standings, else first in standings
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

  // Manager list for the perspective selector
  const managers = useMemo(() => {
    if (!computed) return [];
    return computed.standings
      .filter((s) => !!s.userId)
      .map((s) => ({ userId: s.userId, displayName: s.displayName }));
  }, [computed]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Trade Simulator</h2>
          <p className="text-sm text-gray-400 mt-1">
            Test hypothetical trades and see how they&apos;d affect your franchise outlook.
          </p>
        </div>
        <ShareButton className="mt-1" />
      </div>

      {/* Manager perspective selector */}
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

      {/* Content */}
      {franchiseOutlook.isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-brand-cyan mr-2" size={24} />
          <span className="text-gray-400 text-sm">Computing franchise outlook…</span>
        </div>
      ) : franchiseOutlook.data && effectiveUserId ? (
        <SimulateContent
          leagueId={leagueId}
          userId={effectiveUserId}
          data={franchiseOutlook.data}
        />
      ) : (
        <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center">
          <div className="text-2xl mb-3">⚗️</div>
          <div className="text-sm font-medium text-gray-300">Simulator unavailable</div>
          <div className="text-xs text-gray-500 mt-1">
            Roster and player data could not be loaded.
          </div>
        </div>
      )}
    </div>
  );
}
