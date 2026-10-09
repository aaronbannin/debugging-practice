export const RANK_STEP = 1024;
export const RANK_MIN_GAP = 0.0001;

export function initialRank(index: number): number {
  return (index + 1) * RANK_STEP;
}

export function rankBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return RANK_STEP;
  if (before === null) return (after as number) - RANK_STEP;
  if (after === null) return before + RANK_STEP;
  return Math.round((before + after) / 2);
}

export function needsRebalance(before: number | null, after: number | null): boolean {
  if (before === null || after === null) return false;
  return Math.abs(after - before) < RANK_MIN_GAP;
}

export function rebalance(count: number): number[] {
  const ranks: number[] = [];
  for (let i = 0; i < count; i += 1) ranks.push(initialRank(i));
  return ranks;
}

export function compareRank(a: number, b: number): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
