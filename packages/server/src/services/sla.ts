import {
  MS_PER_DAY,
  MS_PER_HOUR,
  STALE_IN_PROGRESS_DAYS,
  durationHours,
  startOfUtcDay,
  type Ticket,
} from '@dp/shared';
import { db } from './repo.js';
import { warnIf } from '../lib/invariants.js';

export function overdueCutoff(now: number): number {
  return startOfUtcDay(now);
}

export interface CycleSample {
  ticket_id: string;
  hours: number;
}

export function cycleTimeHours(ticket: Pick<Ticket, 'id' | 'started_at' | 'completed_at'>): number | null {
  if (ticket.started_at === null || ticket.completed_at === null) return null;
  const hours = durationHours(ticket.started_at, ticket.completed_at);
  warnIf('negative_cycle_time', hours < 0, {
    ticket_id: ticket.id,
    started_at: ticket.started_at,
    completed_at: ticket.completed_at,
    hours,
  });
  return hours;
}

export function collectCycleSamples(projectId: string | undefined, since: number): CycleSample[] {
  const params: unknown[] = [since];
  let projectClause = '';
  if (projectId) {
    projectClause = ' AND project_id = ?';
    params.push(projectId);
  }
  const rows = db()
    .prepare<unknown[], { id: string; started_at: number | null; completed_at: number | null }>(
      `SELECT id, started_at, completed_at FROM tickets
        WHERE status = 'done' AND completed_at IS NOT NULL AND completed_at >= ?${projectClause}`,
    )
    .all(...params);

  const samples: CycleSample[] = [];
  for (const row of rows) {
    const hours = cycleTimeHours(row);
    if (hours === null) continue;
    samples.push({ ticket_id: row.id, hours });
  }
  return samples;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export function staleInProgress(projectId: string | undefined, now: number): number {
  const cutoff = now - STALE_IN_PROGRESS_DAYS * MS_PER_DAY;
  const params: unknown[] = [cutoff];
  let projectClause = '';
  if (projectId) {
    projectClause = ' AND project_id = ?';
    params.push(projectId);
  }
  const row = db()
    .prepare<unknown[], { n: number }>(
      `SELECT COUNT(*) AS n FROM tickets
        WHERE status = 'in_progress' AND started_at IS NOT NULL AND started_at < ?${projectClause}`,
    )
    .get(...params);
  return row?.n ?? 0;
}

export function slaBreachHours(ticket: Pick<Ticket, 'priority' | 'created_at'>, now: number): number {
  const budgets: Record<string, number> = { p0: 8, p1: 48, p2: 168, p3: 720 };
  const budget = budgets[ticket.priority] ?? 720;
  const elapsed = (now - ticket.created_at) / MS_PER_HOUR;
  return elapsed - budget;
}
