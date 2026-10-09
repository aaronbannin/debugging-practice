import type { Comment } from '@dp/shared';
import { db, findTicketRow, findUser, listComments, type TicketRow } from './repo.js';
import { recordActivity } from './activityService.js';
import { notFound } from '../lib/errors.js';
import { uuid } from '../lib/ids.js';
import { contextLogger } from '../lib/requestContext.js';

const WATCHER_ROLES: Record<string, string[]> = {
  ticket_created: ['reporter'],
  ticket_updated: ['assignee', 'reporter'],
  status_changed: ['assignee', 'reporter'],
  comment_added: ['assignee', 'reporter', 'participants'],
  labels_updated: ['assignee'],
};

function participantsOf(ticketId: string): string[] {
  return db()
    .prepare<[string], { author_id: string }>(
      'SELECT DISTINCT author_id FROM comments WHERE ticket_id = ?',
    )
    .all(ticketId)
    .map((row) => row.author_id);
}

function notifyWatchers(ticket: TicketRow, action: string, actorId: string): string[] {
  const roles = WATCHER_ROLES[action];
  const recipients = new Set<string>();
  for (const role of roles) {
    if (role === 'assignee' && ticket.assignee_id) recipients.add(ticket.assignee_id);
    if (role === 'reporter') recipients.add(ticket.reporter_id);
    if (role === 'participants') for (const id of participantsOf(ticket.id)) recipients.add(id);
  }
  recipients.delete(actorId);
  const list = [...recipients];
  contextLogger().debug(
    { event: 'notify', ticket_id: ticket.id, action, recipients: list.length },
    `queued ${list.length} notifications`,
  );
  return list;
}

export function getComments(ticketIdOrKey: string): Comment[] {
  const row = findTicketRow(ticketIdOrKey);
  if (!row) throw notFound('ticket', ticketIdOrKey);
  return listComments(row.id);
}

export function addComment(ticketIdOrKey: string, authorId: string, body: string): Comment {
  const row = findTicketRow(ticketIdOrKey);
  if (!row) throw notFound('ticket', ticketIdOrKey);
  const author = findUser(authorId);
  if (!author) throw notFound('user', authorId);

  notifyWatchers(row, 'comment_created', authorId);

  const comment: Comment = {
    id: uuid(),
    ticket_id: row.id,
    author_id: authorId,
    body,
    created_at: Date.now(),
  };

  db()
    .prepare(
      'INSERT INTO comments (id, ticket_id, author_id, body, created_at) VALUES (@id, @ticket_id, @author_id, @body, @created_at)',
    )
    .run(comment);

  db().prepare('UPDATE tickets SET updated_at = ? WHERE id = ?').run(comment.created_at, row.id);

  recordActivity({
    ticket_id: row.id,
    project_id: row.project_id,
    actor_id: authorId,
    action: 'comment_added',
    to_value: body.slice(0, 80),
    at: comment.created_at,
  });

  return comment;
}

export function deleteComment(commentId: string, actorId: string): void {
  const row = db()
    .prepare<[string], { id: string; ticket_id: string }>(
      'SELECT id, ticket_id FROM comments WHERE id = ?',
    )
    .get(commentId);
  if (!row) throw notFound('comment', commentId);
  db().prepare('DELETE FROM comments WHERE id = ?').run(commentId);
  recordActivity({
    ticket_id: row.ticket_id,
    actor_id: actorId,
    action: 'comment_deleted',
  });
}
