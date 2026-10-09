import { describe, expect, it } from 'vitest';
import {
  RANK_STEP,
  compareRank,
  initialRank,
  needsRebalance,
  rankBetween,
  rebalance,
} from '@dp/shared';

describe('initialRank', () => {
  it('spaces positions by a fixed step', () => {
    expect(initialRank(0)).toBe(RANK_STEP);
    expect(initialRank(1)).toBe(2 * RANK_STEP);
    expect(initialRank(4)).toBe(5 * RANK_STEP);
  });
});

describe('rankBetween', () => {
  it('returns the first slot for an empty column', () => {
    expect(rankBetween(null, null)).toBe(RANK_STEP);
  });

  it('prepends before the current head', () => {
    expect(rankBetween(null, 2048)).toBe(1024);
  });

  it('appends after the current tail', () => {
    expect(rankBetween(3072, null)).toBe(4096);
  });

  it('places a ticket between two neighbours', () => {
    expect(rankBetween(1024, 2048)).toBe(1536);
    expect(rankBetween(1024, 1536)).toBe(1280);
    expect(rankBetween(2048, 3072)).toBe(2560);
  });

  it('keeps the result strictly inside the interval', () => {
    const value = rankBetween(1024, 2048);
    expect(value).toBeGreaterThan(1024);
    expect(value).toBeLessThan(2048);
  });
});

describe('needsRebalance', () => {
  it('is false when either neighbour is missing', () => {
    expect(needsRebalance(null, 1024)).toBe(false);
    expect(needsRebalance(1024, null)).toBe(false);
  });

  it('is false while there is room between neighbours', () => {
    expect(needsRebalance(1024, 2048)).toBe(false);
  });

  it('is true once neighbours are effectively adjacent', () => {
    expect(needsRebalance(1024, 1024.000_05)).toBe(true);
  });
});

describe('rebalance', () => {
  it('produces an evenly spaced ascending sequence', () => {
    expect(rebalance(3)).toEqual([RANK_STEP, 2 * RANK_STEP, 3 * RANK_STEP]);
    expect(rebalance(0)).toEqual([]);
  });
});

describe('compareRank', () => {
  it('orders ascending', () => {
    expect([3, 1, 2].sort(compareRank)).toEqual([1, 2, 3]);
    expect(compareRank(5, 5)).toBe(0);
  });
});
