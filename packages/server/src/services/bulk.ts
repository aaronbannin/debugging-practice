import type { BulkAssignInput, BulkLabelInput, BulkStatusInput, Status } from '@dp/shared';
import { db, findTicketRow, findUser, labelsFor } from './repo.js';
import { recordActivity, recordStatusHistory } from './activityService.js';
import { assertWipCapacity, isTransitionAllowed, timestampsForTransition } from './transitions.js';
import { appendRank } from './ranking.js';
import { notFound } from '../lib/errors.js';
import { expectSameSize, warnIf } from '../lib/invariants.js';
import { contextLogger } from '../lib/requestContext.js';

export interface BulkResult {
  requested: number;
  updated: number;
  skipped: Array<{ ticket_id: string; reason: string }>;
}

export function bulkStatus(input: BulkStatusInput): BulkResult {
  const now = Date.now();
  const skipped: BulkResult['skipped'] = [];
  const targets: Array<{ id: string; from: Status; project_id: string }> = [];

  for (const ticketId of input.ticket_ids) {
    const row = findTicketRow(ticketId);
    if (!row) {
      skipped.push({ ticket_id: ticketId, reason: 'not_found' });
      continue;
    }
    const from = row.status as Status;
    if (from === input.to) {
      skipped.push({ ticket_id: ticketId, reason: 'already_in_status' });
      continue;
    }
    if (!isTransitionAllowed(from, input.to)) {
      skipped.push({ ticket_id: ticketId, reason: `illegal_transition_${from}_to_${input.to}` });
      continue;
    }
    targets.push({ id: row.id, from, project_id: row.project_id });
  }

  const byProject = new Map<string, number>();
  for (const target of targets) {
    byProject.set(target.project_id, (byProject.get(target.project_id) ?? 0) + 1);
  }
  for (const [projectId, count] of byProject) {
    assertWipCapacity(projectId, input.to, count);
  }

  const update = db().prepare(
    `UPDATE tickets
        SET status = @status, rank = @rank, started_at = @started_at, completed_at = @completed_at,
            updated_at = @updated_at, version = version + 1
      WHERE id = @id`,
  );

  const run = db().transaction((items: typeof targets) => {
    for (const target of items) {
      const row = findTicketRow(target.id);
      if (!row) continue;
      const timestamps = timestampsForTransition(
        target.from,
        input.to,
        { started_at: row.started_at, completed_at: row.completed_at },
        now,
      );
      update.run({
        id: target.id,
        status: input.to,
        rank: appendRank(target.project_id, input.to),
        started_at: timestamps.started_at,
        completed_at: timestamps.completed_at,
        updated_at: now,
      });
      recordStatusHistory(target.id, target.from, input.to, input.actor_id, now);
      recordActivity({
        ticket_id: target.id,
        project_id: target.project_id,
        actor_id: input.actor_id,
        action: 'status_changed',
        field: 'status',
        from_value: target.from,
        to_value: input.to,
        at: now,
      });
    }
  });

  run(targets);

  const result: BulkResult = {
    requested: input.ticket_ids.length,
    updated: targets.length,
    skipped,
  };

  expectSameSize('bulk_status_accounted', result.requested, result.updated + result.skipped.length, {
    to: input.to,
    actor_id: input.actor_id,
  });

  contextLogger().info(
    { event: 'bulk_status', ...result, to: input.to },
    `bulk status change applied to ${result.updated} tickets`,
  );

  return result;
}

export function bulkAssign(input: BulkAssignInput): BulkResult {
  if (input.assignee_id) {
    const user = findUser(input.assignee_id);
    if (!user) throw notFound('user', input.assignee_id);
  }

  const now = Date.now();
  const skipped: BulkResult['skipped'] = [];
  let updated = 0;

  const update = db().prepare(
    'UPDATE tickets SET assignee_id = ?, updated_at = ?, version = version + 1 WHERE id = ?',
  );

  const run = db().transaction((ids: string[]) => {
    for (const ticketId of ids) {
      const row = findTicketRow(ticketId);
      if (!row) {
        skipped.push({ ticket_id: ticketId, reason: 'not_found' });
        continue;
      }
      if (row.assignee_id === input.assignee_id) {
        skipped.push({ ticket_id: ticketId, reason: 'already_assigned' });
        continue;
      }
      update.run(input.assignee_id, now, row.id);
      recordActivity({
        ticket_id: row.id,
        project_id: row.project_id,
        actor_id: input.actor_id,
        action: 'ticket_updated',
        field: 'assignee_id',
        from_value: row.assignee_id,
        to_value: input.assignee_id,
        at: now,
      });
      updated += 1;
    }
  });

  run(input.ticket_ids);

  const result: BulkResult = { requested: input.ticket_ids.length, updated, skipped };
  contextLogger().info({ event: 'bulk_assign', ...result }, `bulk assign applied to ${updated} tickets`);
  return result;
}

export function bulkLabel(input: BulkLabelInput): BulkResult {
  const now = Date.now();
  const skipped: BulkResult['skipped'] = [];
  let updated = 0;

  const add = db().prepare('INSERT OR IGNORE INTO ticket_labels (ticket_id, label) VALUES (?, ?)');
  const remove = db().prepare('DELETE FROM ticket_labels WHERE ticket_id = ? AND label = ?');
  const touch = db().prepare('UPDATE tickets SET updated_at = ?, version = version + 1 WHERE id = ?');

  const run = db().transaction((ids: string[]) => {
    const existing = labelsFor(ids);
    for (const ticketId of ids) {
      const row = findTicketRow(ticketId);
      if (!row) {
        skipped.push({ ticket_id: ticketId, reason: 'not_found' });
        continue;
      }
      const current = new Set(existing.get(row.id) ?? []);
      let changed = false;
      for (const label of input.add) {
        const normalized = label.toLowerCase();
        if (current.has(normalized)) continue;
        add.run(row.id, normalized);
        current.add(normalized);
        changed = true;
      }
      for (const label of input.remove) {
        const normalized = label.toLowerCase();
        if (!current.has(normalized)) continue;
        remove.run(row.id, normalized);
        current.delete(normalized);
        changed = true;
      }
      if (!changed) {
        skipped.push({ ticket_id: ticketId, reason: 'no_label_change' });
        continue;
      }
      touch.run(now, row.id);
      recordActivity({
        ticket_id: row.id,
        project_id: row.project_id,
        actor_id: input.actor_id,
        action: 'labels_updated',
        field: 'labels',
        to_value: [...current].sort().join(','),
        at: now,
      });
      updated += 1;
    }
  });

  run(input.ticket_ids);

  warnIf('bulk_label_noop', updated === 0 && input.ticket_ids.length > 0, {
    requested: input.ticket_ids.length,
    add: input.add,
    remove: input.remove,
  });

  const result: BulkResult = { requested: input.ticket_ids.length, updated, skipped };
  contextLogger().info({ event: 'bulk_label', ...result }, `bulk label applied to ${updated} tickets`);
  return result;
}
