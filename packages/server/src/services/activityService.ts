import type { ActivityEntry } from '@dp/shared';
import { db } from './repo.js';
import { uuid } from '../lib/ids.js';
import { contextLogger } from '../lib/requestContext.js';

export interface RecordActivityInput {
  ticket_id?: string | null;
  project_id?: string | null;
  actor_id?: string | null;
  action: string;
  field?: string | null;
  from_value?: string | null;
  to_value?: string | null;
  at?: number;
}

export function recordActivity(input: RecordActivityInput): ActivityEntry {
  const entry: ActivityEntry = {
    id: uuid(),
    ticket_id: input.ticket_id ?? null,
    project_id: input.project_id ?? null,
    actor_id: input.actor_id ?? null,
    action: input.action,
    field: input.field ?? null,
    from_value: input.from_value ?? null,
    to_value: input.to_value ?? null,
    created_at: input.at ?? Date.now(),
  };
  db()
    .prepare(
      `INSERT INTO activity (id, ticket_id, project_id, actor_id, action, field, from_value, to_value, created_at)
       VALUES (@id, @ticket_id, @project_id, @actor_id, @action, @field, @from_value, @to_value, @created_at)`,
    )
    .run(entry);
  contextLogger().info(
    {
      event: 'mutation',
      entity: entry.ticket_id ? 'ticket' : 'project',
      entity_id: entry.ticket_id ?? entry.project_id,
      action: entry.action,
      field: entry.field,
      actor_id: entry.actor_id,
    },
    `mutation ${entry.action}`,
  );
  return entry;
}

export function recordStatusHistory(
  ticketId: string,
  fromStatus: string | null,
  toStatus: string,
  actorId: string | null,
  at: number = Date.now(),
): void {
  db()
    .prepare(
      `INSERT INTO status_history (id, ticket_id, from_status, to_status, actor_id, changed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(uuid(), ticketId, fromStatus, toStatus, actorId, at);
}

export interface ActivityFeedOptions {
  project_id?: string;
  ticket_id?: string;
  actor_id?: string;
  limit: number;
  before?: number;
}

export function activityFeed(options: ActivityFeedOptions): ActivityEntry[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (options.project_id) {
    clauses.push('(a.project_id = ? OR t.project_id = ?)');
    params.push(options.project_id, options.project_id);
  }
  if (options.ticket_id) {
    clauses.push('a.ticket_id = ?');
    params.push(options.ticket_id);
  }
  if (options.actor_id) {
    clauses.push('a.actor_id = ?');
    params.push(options.actor_id);
  }
  if (options.before !== undefined) {
    clauses.push('a.created_at < ?');
    params.push(options.before);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  params.push(options.limit);
  return db()
    .prepare<unknown[], ActivityEntry & { ticket_key: string | null; actor_name: string | null }>(
      `SELECT a.*, t.key AS ticket_key, u.name AS actor_name
         FROM activity a
         LEFT JOIN tickets t ON t.id = a.ticket_id
         LEFT JOIN users u ON u.id = a.actor_id
         ${where}
        ORDER BY a.created_at DESC
        LIMIT ?`,
    )
    .all(...params);
}
