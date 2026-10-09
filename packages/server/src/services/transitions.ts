import {
  ALLOWED_TRANSITIONS,
  DEFAULT_WIP_LIMITS,
  TERMINAL_STATUSES,
  WORK_STARTED_STATUSES,
  type Status,
} from '@dp/shared';
import { db } from './repo.js';
import { conflict, unprocessable } from '../lib/errors.js';
import { warnIf } from '../lib/invariants.js';

export function isTransitionAllowed(from: Status, to: Status): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransitionAllowed(from: Status, to: Status): void {
  if (!isTransitionAllowed(from, to)) {
    throw unprocessable(`cannot move a ticket from ${from} to ${to}`, {
      from,
      to,
      allowed: ALLOWED_TRANSITIONS[from],
    });
  }
}

export function wipLimitFor(projectId: string, status: Status): number | null {
  const row = db()
    .prepare<[string, string], { max_count: number }>(
      'SELECT max_count FROM wip_limits WHERE project_id = ? AND status = ?',
    )
    .get(projectId, status);
  if (row) return row.max_count;
  return DEFAULT_WIP_LIMITS[status] ?? null;
}

export function countInStatus(projectId: string, status: Status): number {
  const row = db()
    .prepare<[string, string], { n: number }>(
      'SELECT COUNT(*) AS n FROM tickets WHERE project_id = ? AND status = ?',
    )
    .get(projectId, status);
  return row?.n ?? 0;
}

export function assertWipCapacity(projectId: string, status: Status, movingIn: number): void {
  const limit = wipLimitFor(projectId, status);
  if (limit === null) return;
  const current = countInStatus(projectId, status);
  if (current + movingIn > limit) {
    throw conflict(`WIP limit reached for ${status} (${current}/${limit})`, {
      status,
      limit,
      current,
      moving_in: movingIn,
    });
  }
}

export interface TimestampPatch {
  started_at: number | null;
  completed_at: number | null;
}

export function timestampsForTransition(
  from: Status,
  to: Status,
  current: TimestampPatch,
  now: number,
): TimestampPatch {
  let startedAt = current.started_at;
  let completedAt = current.completed_at;

  if (WORK_STARTED_STATUSES.includes(to) && startedAt === null) {
    startedAt = now;
  }

  if (to === 'done') {
    completedAt = now;
    if (startedAt === null) startedAt = now;
  } else if (TERMINAL_STATUSES.includes(from) && !TERMINAL_STATUSES.includes(to)) {
    completedAt = null;
  }

  if (to === 'cancelled') {
    completedAt = now;
  }

  if (to === 'backlog') {
    startedAt = null;
    completedAt = null;
  }

  warnIf('cycle_time_negative', startedAt !== null && completedAt !== null && completedAt < startedAt, {
    started_at: startedAt,
    completed_at: completedAt,
    from,
    to,
  });

  return { started_at: startedAt, completed_at: completedAt };
}
