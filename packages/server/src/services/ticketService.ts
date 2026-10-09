import {
  DUE_SOON_DAYS,
  type CreateTicketInput,
  type ListQuery,
  type MoveInput,
  type Page,
  type Status,
  type Ticket,
  type TransitionInput,
  type UpdateTicketInput,
} from '@dp/shared';
import { db, findProject, findTicket, findTicketRow, hydrate, nextTicketKey, setLabels, type TicketRow } from './repo.js';
import { recordActivity, recordStatusHistory } from './activityService.js';
import { assertTransitionAllowed, assertWipCapacity, timestampsForTransition } from './transitions.js';
import { appendRank, computeRank } from './ranking.js';
import { overdueCutoff } from './sla.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { buildPage, offsetFor } from '../lib/pagination.js';
import { check, warnIf } from '../lib/invariants.js';
import { contextLogger } from '../lib/requestContext.js';
import { uuid } from '../lib/ids.js';

const SORT_EXPRESSIONS: Record<string, string> = {
  created_at: 't.created_at',
  updated_at: 't.updated_at',
  due_at: 't.due_at',
  priority: "CASE t.priority WHEN 'p0' THEN 0 WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END",
  status: "CASE t.status WHEN 'backlog' THEN 0 WHEN 'todo' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'in_review' THEN 3 WHEN 'blocked' THEN 4 WHEN 'done' THEN 5 ELSE 6 END",
  key: 't.key',
  title: 't.title',
  estimate: 't.estimate',
};

export function getTicket(idOrKey: string): Ticket {
  const ticket = findTicket(idOrKey);
  if (!ticket) throw notFound('ticket', idOrKey);
  return ticket;
}

export function createTicket(input: CreateTicketInput): Ticket {
  const project = findProject(input.project_id);
  if (!project) throw notFound('project', input.project_id);

  const now = Date.now();
  const status: Status = input.status ?? 'backlog';
  const id = uuid();
  const key = nextTicketKey(project.id, project.key);
  const rank = appendRank(project.id, status);

  const timestamps = timestampsForTransition('backlog', status, { started_at: null, completed_at: null }, now);

  db()
    .prepare(
      `INSERT INTO tickets (id, key, project_id, title, description, status, priority, assignee_id,
                            reporter_id, estimate, due_at, parent_id, rank, version, created_at,
                            updated_at, started_at, completed_at)
       VALUES (@id, @key, @project_id, @title, @description, @status, @priority, @assignee_id,
               @reporter_id, @estimate, @due_at, @parent_id, @rank, 0, @created_at,
               @updated_at, @started_at, @completed_at)`,
    )
    .run({
      id,
      key,
      project_id: project.id,
      title: input.title,
      description: input.description ?? null,
      status,
      priority: input.priority,
      assignee_id: input.assignee_id ?? null,
      reporter_id: input.reporter_id,
      estimate: input.estimate ?? null,
      due_at: input.due_at ?? null,
      parent_id: input.parent_id ?? null,
      rank,
      created_at: now,
      updated_at: now,
      started_at: timestamps.started_at,
      completed_at: timestamps.completed_at,
    });

  setLabels(id, input.labels);
  recordStatusHistory(id, null, status, input.reporter_id, now);
  recordActivity({
    ticket_id: id,
    project_id: project.id,
    actor_id: input.reporter_id,
    action: 'ticket_created',
    to_value: key,
    at: now,
  });

  return getTicket(id);
}

export function updateTicket(idOrKey: string, input: UpdateTicketInput): Ticket {
  const row = findTicketRow(idOrKey);
  if (!row) throw notFound('ticket', idOrKey);

  if (row.version !== input.version) {
    throw conflict('ticket was modified by someone else', {
      expected_version: input.version,
      actual_version: row.version,
      ticket_id: row.id,
    });
  }

  if (input.parent_id) {
    if (input.parent_id === row.id) throw badRequest('a ticket cannot be its own parent');
    const parent = findTicketRow(input.parent_id);
    if (!parent) throw notFound('parent ticket', input.parent_id);
    if (parent.parent_id === row.id) {
      throw badRequest('parent/subtask relationship would create a cycle', {
        ticket_id: row.id,
        parent_id: parent.id,
      });
    }
  }

  const now = Date.now();
  const fields: string[] = [];
  const params: Record<string, unknown> = { id: row.id, updated_at: now };
  const changes: Array<{ field: string; from: unknown; to: unknown }> = [];

  const assignIf = (field: keyof TicketRow, value: unknown) => {
    if (value === undefined) return;
    const current = row[field];
    if (current === value) return;
    fields.push(`${field} = @${field}`);
    params[field] = value;
    changes.push({ field, from: current, to: value });
  };

  assignIf('title', input.title);
  assignIf('description', input.description === undefined ? undefined : input.description ?? null);
  assignIf('priority', input.priority);
  assignIf('assignee_id', input.assignee_id === undefined ? undefined : input.assignee_id ?? null);
  assignIf('estimate', input.estimate === undefined ? undefined : input.estimate ?? null);
  assignIf('due_at', input.due_at === undefined ? undefined : input.due_at ?? null);
  assignIf('parent_id', input.parent_id === undefined ? undefined : input.parent_id ?? null);

  const labelsChanged =
    input.labels !== undefined &&
    JSON.stringify([...input.labels].sort()) !==
      JSON.stringify([...(findTicket(row.id)?.labels ?? [])].sort());

  if (fields.length === 0 && !labelsChanged) {
    return getTicket(row.id);
  }

  fields.push('updated_at = @updated_at');
  fields.push('version = version + 1');

  db().prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = @id`).run(params);

  if (input.labels !== undefined) {
    setLabels(row.id, input.labels);
  }

  for (const change of changes) {
    recordActivity({
      ticket_id: row.id,
      project_id: row.project_id,
      actor_id: input.actor_id,
      action: 'ticket_updated',
      field: change.field,
      from_value: change.from === null || change.from === undefined ? null : String(change.from),
      to_value: change.to === null || change.to === undefined ? null : String(change.to),
      at: now,
    });
  }

  if (labelsChanged) {
    recordActivity({
      ticket_id: row.id,
      project_id: row.project_id,
      actor_id: input.actor_id,
      action: 'labels_updated',
      field: 'labels',
      to_value: (input.labels ?? []).join(','),
      at: now,
    });
  }

  return getTicket(row.id);
}

export function transitionTicket(idOrKey: string, input: TransitionInput): Ticket {
  const row = findTicketRow(idOrKey);
  if (!row) throw notFound('ticket', idOrKey);

  const from = row.status as Status;
  const to = input.to;

  if (input.version !== undefined && input.version !== row.version) {
    throw conflict('ticket was modified by someone else', {
      expected_version: input.version,
      actual_version: row.version,
      ticket_id: row.id,
    });
  }

  if (from === to) return getTicket(row.id);

  assertTransitionAllowed(from, to);
  assertWipCapacity(row.project_id, to, 1);

  const now = Date.now();
  const timestamps = timestampsForTransition(
    from,
    to,
    { started_at: row.started_at, completed_at: row.completed_at },
    now,
  );
  const rank = appendRank(row.project_id, to);

  db()
    .prepare(
      `UPDATE tickets
          SET status = @status, rank = @rank, started_at = @started_at, completed_at = @completed_at,
              updated_at = @updated_at, version = version + 1
        WHERE id = @id`,
    )
    .run({
      id: row.id,
      status: to,
      rank,
      started_at: timestamps.started_at,
      completed_at: timestamps.completed_at,
      updated_at: now,
    });

  recordStatusHistory(row.id, from, to, input.actor_id, now);
  recordActivity({
    ticket_id: row.id,
    project_id: row.project_id,
    actor_id: input.actor_id,
    action: 'status_changed',
    field: 'status',
    from_value: from,
    to_value: to,
    at: now,
  });

  check(
    'completed_requires_start',
    !(to === 'done' && timestamps.started_at === null),
    { ticket_id: row.id, from, to },
  );

  return getTicket(row.id);
}

export function moveTicket(idOrKey: string, input: MoveInput): Ticket {
  const row = findTicketRow(idOrKey);
  if (!row) throw notFound('ticket', idOrKey);

  const from = row.status as Status;
  const to = input.status;
  const now = Date.now();

  if (from !== to) {
    assertTransitionAllowed(from, to);
    assertWipCapacity(row.project_id, to, 1);
  }

  const rank = computeRank(row.project_id, to, input.before_id, input.after_id);
  const timestamps =
    from === to
      ? { started_at: row.started_at, completed_at: row.completed_at }
      : timestampsForTransition(from, to, { started_at: row.started_at, completed_at: row.completed_at }, now);

  db()
    .prepare(
      `UPDATE tickets
          SET status = @status, rank = @rank, started_at = @started_at, completed_at = @completed_at,
              updated_at = @updated_at, version = version + 1
        WHERE id = @id`,
    )
    .run({
      id: row.id,
      status: to,
      rank,
      started_at: timestamps.started_at,
      completed_at: timestamps.completed_at,
      updated_at: now,
    });

  if (from !== to) {
    recordStatusHistory(row.id, from, to, input.actor_id, now);
    recordActivity({
      ticket_id: row.id,
      project_id: row.project_id,
      actor_id: input.actor_id,
      action: 'status_changed',
      field: 'status',
      from_value: from,
      to_value: to,
      at: now,
    });
  } else {
    recordActivity({
      ticket_id: row.id,
      project_id: row.project_id,
      actor_id: input.actor_id,
      action: 'ticket_reordered',
      field: 'rank',
      from_value: String(row.rank),
      to_value: String(rank),
      at: now,
    });
  }

  return getTicket(row.id);
}

export function deleteTicket(idOrKey: string, actorId: string): void {
  const row = findTicketRow(idOrKey);
  if (!row) throw notFound('ticket', idOrKey);
  db().prepare('DELETE FROM tickets WHERE id = ?').run(row.id);
  recordActivity({
    project_id: row.project_id,
    actor_id: actorId,
    action: 'ticket_deleted',
    to_value: row.key,
  });
}

interface QueryParts {
  where: string;
  params: unknown[];
  joins: string;
}

function buildFilters(query: ListQuery, now: number): QueryParts {
  const clauses: string[] = ['1 = 1'];
  const params: unknown[] = [];
  let joins = '';

  if (query.project_id) {
    clauses.push('t.project_id = (SELECT id FROM projects WHERE id = ? OR key = ?)');
    params.push(query.project_id, query.project_id);
  }

  if (query.q) {
    clauses.push('(t.title LIKE ? OR t.key LIKE ? OR IFNULL(t.description, \'\') LIKE ?)');
    const like = `%${query.q}%`;
    params.push(like, like, like);
  }

  if (query.status && query.status.length > 0) {
    clauses.push(`t.status IN (${query.status.map(() => '?').join(',')})`);
    params.push(...query.status);
  }

  if (query.priority && query.priority.length > 0) {
    clauses.push(`t.priority IN (${query.priority.map(() => '?').join(',')})`);
    params.push(...query.priority);
  }

  if (query.assignee_id && query.assignee_id.length > 0) {
    clauses.push(`t.assignee_id IN (${query.assignee_id.map(() => '?').join(',')})`);
    params.push(...query.assignee_id);
  }

  if (query.unassigned) {
    clauses.push('t.assignee_id IS NULL');
  }

  if (query.label && query.label.length > 0) {
    joins += ' JOIN ticket_labels tl ON tl.ticket_id = t.id';
    clauses.push(`tl.label IN (${query.label.map(() => '?').join(',')})`);
    params.push(...query.label.map((l) => l.toLowerCase()));
  }

  if (query.overdue) {
    clauses.push('t.due_at IS NOT NULL AND t.due_at < ? AND t.status NOT IN (\'done\', \'cancelled\')');
    params.push(overdueCutoff(now));
  }

  if (query.created_after !== undefined) {
    clauses.push('t.created_at >= ?');
    params.push(query.created_after);
  }

  if (query.created_before !== undefined) {
    clauses.push('t.created_at <= ?');
    params.push(query.created_before);
  }

  return { where: clauses.join(' AND '), params, joins };
}

export function listTickets(query: ListQuery): Page<Ticket> {
  const now = Date.now();
  const { where, params, joins } = buildFilters(query, now);
  const distinct = joins.includes('ticket_labels') ? 'DISTINCT' : '';

  const totalRow = db()
    .prepare<unknown[], { n: number }>(
      `SELECT COUNT(${distinct || ''} t.id) AS n FROM tickets t${joins} WHERE ${where}`,
    )
    .get(...params);
  const total = totalRow?.n ?? 0;

  const sortExpr = SORT_EXPRESSIONS[query.sort] ?? SORT_EXPRESSIONS.updated_at;
  const dir = query.dir === 'asc' ? 'ASC' : 'DESC';
  const offset = offsetFor(query.page, query.page_size);

  const rows = db()
    .prepare<unknown[], TicketRow>(
      `SELECT ${distinct} t.* FROM tickets t${joins}
        WHERE ${where}
        ORDER BY ${sortExpr} ${dir} NULLS LAST, t.id ASC
        LIMIT ? OFFSET ?`,
    )
    .all(...params, query.page_size, offset);

  const page = buildPage(hydrate(rows), total, query.page, query.page_size);

  warnIf(
    'pagination_overflow',
    page.page > page.page_count && page.total > 0,
    { page: page.page, page_count: page.page_count, total: page.total },
  );

  check(
    'page_size_respected',
    page.items.length <= query.page_size,
    { returned: page.items.length, page_size: query.page_size, sort: query.sort },
  );

  const expectedOnPage = Math.max(0, Math.min(query.page_size, total - (query.page - 1) * query.page_size));
  check('page_length_matches_total', page.items.length === expectedOnPage, {
    returned: page.items.length,
    expected: expectedOnPage,
    page: query.page,
    page_size: query.page_size,
    total,
  });

  contextLogger().debug(
    { event: 'ticket_list', total, returned: page.items.length, sort: query.sort, dir: query.dir, page: query.page },
    'listed tickets',
  );

  return page;
}

export function dueSoonTickets(projectId: string | undefined, now: number): Ticket[] {
  const params: unknown[] = [now, now + DUE_SOON_DAYS * 86_400_000];
  let projectClause = '';
  if (projectId) {
    projectClause = ' AND t.project_id = ?';
    params.push(projectId);
  }
  const rows = db()
    .prepare<unknown[], TicketRow>(
      `SELECT t.* FROM tickets t
        WHERE t.due_at IS NOT NULL AND t.due_at >= ? AND t.due_at <= ?
          AND t.status NOT IN ('done', 'cancelled')${projectClause}
        ORDER BY t.due_at ASC`,
    )
    .all(...params);
  return hydrate(rows);
}
