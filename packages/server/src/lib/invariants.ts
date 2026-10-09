import { contextLogger } from './requestContext.js';

export interface InvariantReport {
  name: string;
  ok: boolean;
  context: Record<string, unknown>;
}

const counters = new Map<string, number>();

export function invariantCounts(): Record<string, number> {
  return Object.fromEntries(counters);
}

function bump(name: string): number {
  const next = (counters.get(name) ?? 0) + 1;
  counters.set(name, next);
  return next;
}

export function check(
  name: string,
  condition: boolean,
  context: Record<string, unknown> = {},
): boolean {
  if (condition) return true;
  const occurrences = bump(name);
  contextLogger().error(
    { invariant: name, occurrences, ...context },
    `invariant violated: ${name}`,
  );
  return false;
}

export function warnIf(
  name: string,
  condition: boolean,
  context: Record<string, unknown> = {},
): boolean {
  if (!condition) return false;
  const occurrences = bump(name);
  contextLogger().warn({ check: name, occurrences, ...context }, `anomaly detected: ${name}`);
  return true;
}

export function expectFinite(
  name: string,
  value: unknown,
  context: Record<string, unknown> = {},
): boolean {
  const ok = typeof value === 'number' && Number.isFinite(value);
  return check(name, ok, { ...context, value });
}

export function expectNonNegative(
  name: string,
  value: number,
  context: Record<string, unknown> = {},
): boolean {
  return check(name, Number.isFinite(value) && value >= 0, { ...context, value });
}

export function expectSameSize(
  name: string,
  expected: number,
  actual: number,
  context: Record<string, unknown> = {},
): boolean {
  return check(name, expected === actual, { ...context, expected, actual });
}
