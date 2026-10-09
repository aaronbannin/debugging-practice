import type { Database } from 'better-sqlite3';
import type { Comment, Project, Ticket, User } from '@dp/shared';
import { getDb } from '../db/index.js';

export interface TicketRow {
  id: string;
  key: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  reporter_id: string;
  estimate: number | null;
  due_at: number | null;
  parent_id: string | null;
  rank: number;
  version: number;
  created_at: number;
  updated_at: number;
  started_at: number | null;
  completed_at: number | null;
}

export function db(): Database {
  return getDb();
}

export function labelsFor(ticketIds: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (ticketIds.length === 0) return out;
  const placeholders = ticketIds.map(() => '?').join(',');
  const rows = db()
    .prepare<string[], { ticket_id: string; label: string }>(
      `SELECT ticket_id, label FROM ticket_labels WHERE ticket_id IN (${placeholders}) ORDER BY label`,
    )
    .all(...ticketIds);
  for (const id of ticketIds) out.set(id, []);
  for (const row of rows) {
    const list = out.get(row.ticket_id);
    if (list) list.push(row.label);
  }
  return out;
}

export function hydrate(rows: TicketRow[]): Ticket[] {
  const labels = labelsFor(rows.map((r) => r.id));
  return rows.map((row) => ({
    ...row,
    status: row.status as Ticket['status'],
    priority: row.priority as Ticket['priority'],
    labels: labels.get(row.id) ?? [],
  }));
}

export function findTicketRow(id: string): TicketRow | undefined {
  return db()
    .prepare<[string, string], TicketRow>('SELECT * FROM tickets WHERE id = ? OR key = ?')
    .get(id, id);
}

export function findTicket(id: string): Ticket | undefined {
  const row = findTicketRow(id);
  if (!row) return undefined;
  return hydrate([row])[0];
}

export function findTicketsByIds(ids: string[]): Ticket[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = db()
    .prepare<string[], TicketRow>(`SELECT * FROM tickets WHERE id IN (${placeholders})`)
    .all(...ids);
  return hydrate(rows);
}

export function findProject(id: string): Project | undefined {
  return db()
    .prepare<[string, string], Project>('SELECT * FROM projects WHERE id = ? OR key = ?')
    .get(id, id);
}

export function listProjects(): Project[] {
  return db().prepare<[], Project>('SELECT * FROM projects ORDER BY key').all();
}

export function findUser(id: string): User | undefined {
  return db().prepare<[string], User>('SELECT * FROM users WHERE id = ?').get(id);
}

export function listUsers(): User[] {
  return db().prepare<[], User>('SELECT * FROM users ORDER BY name').all();
}

export function listComments(ticketId: string): Comment[] {
  return db()
    .prepare<[string], Comment>(
      'SELECT * FROM comments WHERE ticket_id = ? ORDER BY created_at ASC',
    )
    .all(ticketId);
}

export function setLabels(ticketId: string, labels: string[]): void {
  const conn = db();
  conn.prepare('DELETE FROM ticket_labels WHERE ticket_id = ?').run(ticketId);
  const insert = conn.prepare('INSERT OR IGNORE INTO ticket_labels (ticket_id, label) VALUES (?, ?)');
  for (const label of labels) insert.run(ticketId, label.toLowerCase());
}

export function nextTicketKey(projectId: string, projectKey: string): string {
  const conn = db();
  const row = conn
    .prepare<[string], { next_number: number }>(
      'SELECT next_number FROM project_counters WHERE project_id = ?',
    )
    .get(projectId);
  const next = row?.next_number ?? 1;
  conn
    .prepare('INSERT INTO project_counters (project_id, next_number) VALUES (?, ?) ON CONFLICT(project_id) DO UPDATE SET next_number = ?')
    .run(projectId, next + 1, next + 1);
  return `${projectKey}-${next}`;
}
