/** Shared color/label utilities for numeric metrics across draft and trade components. */

export function surplusColor(surplus: number): string {
  if (surplus > 1) return 'text-green-400';
  if (surplus < -1) return 'text-red-400';
  return 'text-gray-400';
}

export function surplusLabel(surplus: number): string {
  return (surplus >= 0 ? '+' : '') + surplus.toFixed(1);
}

export function valueColor(v: number): string {
  if (v > 0) return 'text-green-400';
  if (v < 0) return 'text-red-400';
  return 'text-gray-400';
}

export function valueLabel(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(1);
}

/** Position text colors (text- classes) for inline position labels in trade/draft views. */
export const POSITION_COLORS: Record<string, string> = {
  QB: 'text-red-400',
  RB: 'text-green-400',
  WR: 'text-blue-400',
  TE: 'text-yellow-400',
  K: 'text-gray-400',
  DEF: 'text-purple-400',
  DST: 'text-purple-400',
};
