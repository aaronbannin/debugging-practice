export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

export function toIso(value: Date | number | string): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  return new Date(value).toISOString();
}

export function toEpoch(value: Date | number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function startOfUtcDay(value: Date | number): number {
  const ms = value instanceof Date ? value.getTime() : value;
  return Math.floor(ms / MS_PER_DAY) * MS_PER_DAY;
}

export function addDays(value: Date | number, days: number): number {
  const ms = value instanceof Date ? value.getTime() : value;
  return ms + days * MS_PER_DAY;
}

export function dayKey(value: Date | number): string {
  const ms = value instanceof Date ? value.getTime() : value;
  return new Date(startOfUtcDay(ms)).toISOString().slice(0, 10);
}

export function lastNDayKeys(n: number, now: number): string[] {
  const keys: string[] = [];
  const today = startOfUtcDay(now);
  for (let i = n; i >= 1; i -= 1) {
    keys.push(dayKey(addDays(today, -i)));
  }
  return keys;
}

export function durationHours(fromMs: number, toMs: number): number {
  return (toMs - fromMs) / MS_PER_HOUR;
}

export function humanDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const days = Math.floor(ms / MS_PER_DAY);
  const hours = Math.floor((ms % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function isOverdue(dueAt: number | null, now: number): boolean {
  if (dueAt === null) return false;
  return dueAt < now;
}

export function isDueSoon(dueAt: number | null, now: number, withinDays: number): boolean {
  if (dueAt === null) return false;
  if (dueAt < now) return false;
  return dueAt <= addDays(now, withinDays);
}
