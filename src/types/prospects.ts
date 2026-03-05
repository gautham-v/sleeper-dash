/**
 * Shared prospect evaluation types.
 * Re-exported here so sleeper.ts (pure type layer) can reference CompPlayer
 * without importing directly from the utility layer.
 */
export type { CompResults, OutcomeDistribution, CompPlayer } from '@/utils/prospectEvaluator';
