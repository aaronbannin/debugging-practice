import {
  DUE_SOON_DAYS,
  MS_PER_DAY,
  STATUSES,
  TERMINAL_STATUSES,
  addDays,
  dayKey,
  lastNDayKeys,
  startOfUtcDay,
  type DashboardStats,
  type StatsQuery,
} from '@dp/shared';
import { db, findProject } from './repo.js';
import { listTickets } from './ticketService.js';
import { collectCycleSamples, mean, median, staleInProgress } from './sla.js';
import { notFound } from '../lib/errors.js';
import { check, expectNonNegative, warnIf } from '../lib/invariants.js';
import { contextLogger } from '../lib/requestContext.js';

function projectScope(projectId: string | undefined): { clause: string; params: unknown[] } {
  if (!projectId) return { clause: '', params: [] };
  return { clause: ' AND project_id = ?', params: [projectId] };
}

export function countsByStatus(projectId: string | undefined): Record<string, number> {
  const scope = projectScope(projectId);
  const rows = db()
    .prepare<unknown[], { status: string; n: number }>(
      `SELECT status, COUNT(*) AS n FROM tickets WHERE 1 = 1${scope.clause} GROUP BY status`,
    )
    .all(...scope.params);
  const counts: Record<string, number> = {};
  for (const status of STATUSES) counts[status] = 0;
  for (const row of rows) counts[row.status] = row.n;
  return counts;
}

export function throughput(
  projectId: string | undefined,
  days: number,
  now: number,
): Array<{ day: string; completed: number }> {
  const windowStart = startOfUtcDay(addDays(now, -(days - 1)));
  const scope = projectScope(projectId);
  const rows = db()
    .prepare<unknown[], { completed_at: number }>(
      `SELECT completed_at FROM tickets
        WHERE status = 'done' AND completed_at IS NOT NULL AND completed_at >= ?${scope.clause}`,
    )
    .all(windowStart, ...scope.params);

  const buckets = new Map<string, number>();
  for (const key of lastNDayKeys(days, now)) buckets.set(key, 0);

  let dropped = 0;
  for (const row of rows) {
    const key = dayKey(row.completed_at);
    if (!buckets.has(key)) {
      dropped += 1;
      continue;
    }
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  warnIf('throughput_bucket_dropped', dropped > 0, {
    dropped,
    days,
    window_start: windowStart,
    rows: rows.length,
  });

  return [...buckets.entries()].map(([day, completed]) => ({ day, completed }));
}

export function overdueCount(projectId: string | undefined, now: number): number {
  const scope = projectScope(projectId);
  const row = db()
    .prepare<unknown[], { n: number }>(
      `SELECT COUNT(*) AS n FROM tickets
        WHERE due_at IS NOT NULL AND due_at < ? AND status NOT IN ('done', 'cancelled')${scope.clause}`,
    )
    .get(now, ...scope.params);
  return row?.n ?? 0;
}

export function dueSoonCount(projectId: string | undefined, now: number): number {
  const scope = projectScope(projectId);
  const row = db()
    .prepare<unknown[], { n: number }>(
      `SELECT COUNT(*) AS n FROM tickets
        WHERE due_at IS NOT NULL AND due_at >= ? AND due_at <= ? AND status NOT IN ('done', 'cancelled')${scope.clause}`,
    )
    .get(now, now + DUE_SOON_DAYS * MS_PER_DAY, ...scope.params);
  return row?.n ?? 0;
}

export function unassignedCount(projectId: string | undefined): number {
  const scope = projectScope(projectId);
  const row = db()
    .prepare<unknown[], { n: number }>(
      `SELECT COUNT(*) AS n FROM tickets
        WHERE assignee_id IS NULL AND status NOT IN ('done', 'cancelled')${scope.clause}`,
    )
    .get(...scope.params);
  return row?.n ?? 0;
}

export function workloadByAssignee(
  projectId: string | undefined,
): Array<{ user_id: string; name: string; open: number; done: number }> {
  const scope = projectScope(projectId);
  const rows = db()
    .prepare<unknown[], { user_id: string; name: string; open: number; done: number }>(
      `SELECT u.id AS user_id,
              u.name AS name,
              SUM(CASE WHEN t.status NOT IN ('done', 'cancelled') THEN 1 ELSE 0 END) AS open,
              SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done
         FROM users u
         LEFT JOIN tickets t ON t.assignee_id = u.id${scope.clause.replace(' AND project_id = ?', ' AND t.project_id = ?')}
        GROUP BY u.id, u.name
        ORDER BY open DESC, u.name ASC`,
    )
    .all(...scope.params);
  return rows.map((row) => ({
    user_id: row.user_id,
    name: row.name,
    open: row.open ?? 0,
    done: row.done ?? 0,
  }));
}

export function dashboard(query: StatsQuery): DashboardStats {
  const now = Date.now();
  let projectId: string | undefined;
  if (query.project_id) {
    const project = findProject(query.project_id);
    if (!project) throw notFound('project', query.project_id);
    projectId = project.id;
  }

  const counts = countsByStatus(projectId);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const open = Object.entries(counts)
    .filter(([status]) => !TERMINAL_STATUSES.includes(status as never))
    .reduce((sum, [, n]) => sum + n, 0);

  const since = addDays(now, -90);
  const samples = collectCycleSamples(projectId, since).map((s) => s.hours);
  const avg = mean(samples);
  const med = median(samples);

  const stats: DashboardStats = {
    project_id: projectId ?? null,
    generated_at: now,
    counts_by_status: counts,
    total_tickets: total,
    open_tickets: open,
    avg_cycle_time_hours: avg,
    median_cycle_time_hours: med,
    throughput: throughput(projectId, query.days, now),
    overdue: overdueCount(projectId, now),
    due_soon: dueSoonCount(projectId, now),
    unassigned: unassignedCount(projectId),
    stale_in_progress: staleInProgress(projectId, now),
    by_assignee: workloadByAssignee(projectId),
  };

  check('open_not_greater_than_total', stats.open_tickets <= stats.total_tickets, {
    open: stats.open_tickets,
    total: stats.total_tickets,
    project_id: projectId ?? null,
  });

  if (avg !== null) {
    expectNonNegative('avg_cycle_time_non_negative', avg, {
      project_id: projectId ?? null,
      sample_size: samples.length,
    });
  }

  const overdueListed = listTickets({
    project_id: projectId,
    overdue: true,
    sort: 'due_at',
    dir: 'asc',
    page: 1,
    page_size: 1,
  } as Parameters<typeof listTickets>[0]).total;

  check('overdue_count_matches_filter', stats.overdue === overdueListed, {
    dashboard_overdue: stats.overdue,
    filtered_overdue: overdueListed,
    project_id: projectId ?? null,
  });

  const throughputTotal = stats.throughput.reduce((sum, bucket) => sum + bucket.completed, 0);
  check(
    'throughput_within_done_count',
    throughputTotal <= counts.done,
    {
      throughput_total: throughputTotal,
      done_count: counts.done,
      days: query.days,
      project_id: projectId ?? null,
    },
  );

  contextLogger().debug(
    { event: 'dashboard', total, open, samples: samples.length, days: query.days },
    'computed dashboard stats',
  );

  return stats;
}
