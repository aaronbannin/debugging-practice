import { describe, expect, it } from 'vitest';
import {
  MS_PER_DAY,
  MS_PER_HOUR,
  addDays,
  dayKey,
  durationHours,
  humanDuration,
  isDueSoon,
  isOverdue,
  startOfUtcDay,
  toEpoch,
  toIso,
} from '@dp/shared';

const NOON = Date.UTC(2024, 4, 17, 12, 0, 0);

describe('toIso', () => {
  it('accepts dates, numbers and strings', () => {
    expect(toIso(new Date(NOON))).toBe('2024-05-17T12:00:00.000Z');
    expect(toIso(NOON)).toBe('2024-05-17T12:00:00.000Z');
    expect(toIso('2024-05-17T12:00:00.000Z')).toBe('2024-05-17T12:00:00.000Z');
  });
});

describe('toEpoch', () => {
  it('normalises supported inputs', () => {
    expect(toEpoch(NOON)).toBe(NOON);
    expect(toEpoch(new Date(NOON))).toBe(NOON);
    expect(toEpoch('2024-05-17T12:00:00.000Z')).toBe(NOON);
  });

  it('returns null for missing or unparseable values', () => {
    expect(toEpoch(null)).toBeNull();
    expect(toEpoch(undefined)).toBeNull();
    expect(toEpoch('not a date')).toBeNull();
  });
});

describe('startOfUtcDay', () => {
  it('truncates to midnight UTC', () => {
    expect(startOfUtcDay(NOON)).toBe(Date.UTC(2024, 4, 17));
    expect(startOfUtcDay(Date.UTC(2024, 4, 17))).toBe(Date.UTC(2024, 4, 17));
  });
});

describe('addDays', () => {
  it('moves forwards and backwards', () => {
    expect(addDays(NOON, 1)).toBe(NOON + MS_PER_DAY);
    expect(addDays(NOON, -3)).toBe(NOON - 3 * MS_PER_DAY);
    expect(addDays(new Date(NOON), 0)).toBe(NOON);
  });
});

describe('dayKey', () => {
  it('formats the UTC calendar day', () => {
    expect(dayKey(NOON)).toBe('2024-05-17');
    expect(dayKey(Date.UTC(2024, 4, 17, 23, 59, 59))).toBe('2024-05-17');
    expect(dayKey(Date.UTC(2024, 4, 18, 0, 0, 0))).toBe('2024-05-18');
  });
});

describe('durationHours', () => {
  it('reports elapsed hours as a float', () => {
    expect(durationHours(NOON, NOON + 3 * MS_PER_HOUR)).toBe(3);
    expect(durationHours(NOON, NOON + MS_PER_HOUR / 2)).toBe(0.5);
  });
});

describe('humanDuration', () => {
  it('renders coarse units', () => {
    expect(humanDuration(2 * MS_PER_DAY + 3 * MS_PER_HOUR)).toBe('2d 3h');
    expect(humanDuration(5 * MS_PER_HOUR + 30 * 60_000)).toBe('5h 30m');
    expect(humanDuration(45 * 60_000)).toBe('45m');
  });

  it('guards against nonsense input', () => {
    expect(humanDuration(-1)).toBe('—');
    expect(humanDuration(Number.NaN)).toBe('—');
  });
});

describe('due date predicates', () => {
  it('detects overdue tickets', () => {
    expect(isOverdue(NOON - 1, NOON)).toBe(true);
    expect(isOverdue(NOON + 1, NOON)).toBe(false);
    expect(isOverdue(null, NOON)).toBe(false);
  });

  it('detects tickets due inside the window', () => {
    expect(isDueSoon(NOON + MS_PER_DAY, NOON, 3)).toBe(true);
    expect(isDueSoon(NOON + 4 * MS_PER_DAY, NOON, 3)).toBe(false);
    expect(isDueSoon(NOON - MS_PER_DAY, NOON, 3)).toBe(false);
    expect(isDueSoon(null, NOON, 3)).toBe(false);
  });
});
