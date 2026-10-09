import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ALLOWED_TRANSITIONS,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  humanDuration,
  type Priority,
  type Status,
} from '@dp/shared';
import { api } from '../api/client';
import { useAppState } from '../hooks/useAppState';
import { Avatar, ErrorNote, Field, Spinner, StatusPill } from '../components/ui';

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const { actorId, users, userById } = useAppState();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<unknown>(null);
  const [commentBody, setCommentBody] = useState('');
  const [draft, setDraft] = useState<{ title: string; description: string; priority: Priority; estimate: string; due: string; labels: string }>({
    title: '',
    description: '',
    priority: 'p2',
    estimate: '',
    due: '',
    labels: '',
  });

  const ticketQuery = useQuery({ queryKey: ['ticket', id], queryFn: () => api.ticket(id) });
  const commentsQuery = useQuery({ queryKey: ['comments', id], queryFn: () => api.comments(id) });
  const activityQuery = useQuery({
    queryKey: ['ticket-activity', id],
    queryFn: () => api.activity(new URLSearchParams({ ticket_id: id, limit: '40' })),
  });

  const ticket = ticketQuery.data;

  useEffect(() => {
    if (!ticket) return;
    setDraft({
      title: ticket.title,
      description: ticket.description ?? '',
      priority: ticket.priority,
      estimate: ticket.estimate === null ? '' : String(ticket.estimate),
      due: ticket.due_at ? new Date(ticket.due_at).toISOString().slice(0, 10) : '',
      labels: ticket.labels.join(', '),
    });
  }, [ticket?.id, ticket?.version]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    void queryClient.invalidateQueries({ queryKey: ['comments', id] });
    void queryClient.invalidateQueries({ queryKey: ['ticket-activity', id] });
    void queryClient.invalidateQueries({ queryKey: ['board'] });
    void queryClient.invalidateQueries({ queryKey: ['tickets'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!ticket) throw new Error('ticket not loaded');
      return api.updateTicket(ticket.id, {
        title: draft.title,
        description: draft.description === '' ? null : draft.description,
        priority: draft.priority,
        estimate: draft.estimate === '' ? null : Number(draft.estimate),
        due_at: draft.due === '' ? null : Date.parse(`${draft.due}T12:00:00.000Z`),
        labels: draft.labels
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
        version: ticket.version,
        actor_id: actorId,
      });
    },
    onError: setActionError,
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
  });

  const assignMutation = useMutation({
    mutationFn: (assigneeId: string | null) => {
      if (!ticket) throw new Error('ticket not loaded');
      return api.updateTicket(ticket.id, {
        assignee_id: assigneeId,
        version: ticket.version,
        actor_id: actorId,
      });
    },
    onError: setActionError,
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
  });

  const transitionMutation = useMutation({
    mutationFn: (to: Status) => api.transition(id, { to, actor_id: actorId }),
    onError: setActionError,
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => api.addComment(id, { author_id: actorId, body: commentBody }),
    onError: setActionError,
    onSuccess: () => {
      setActionError(null);
      setCommentBody('');
      invalidate();
    },
  });

  if (ticketQuery.isLoading) return <Spinner label="Loading ticket" />;
  if (ticketQuery.error) return <ErrorNote error={ticketQuery.error} />;
  if (!ticket) return <ErrorNote error={new Error('ticket not found')} />;

  const cycle =
    ticket.started_at && ticket.completed_at
      ? humanDuration(ticket.completed_at - ticket.started_at)
      : ticket.started_at
        ? `${humanDuration(Date.now() - ticket.started_at)} so far`
        : '—';

  return (
    <div className="detail-page">
      <div className="detail-main">
        <div className="detail-header">
          <span className="ticket-key">{ticket.key}</span>
          <StatusPill status={ticket.status} />
          <span className="muted">v{ticket.version}</span>
        </div>

        {actionError ? <ErrorNote error={actionError} /> : null}

        <Field label="Title">
          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </Field>
        <Field label="Description">
          <textarea
            rows={6}
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </Field>
        <div className="detail-grid">
          <Field label="Priority">
            <select
              value={draft.priority}
              onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estimate">
            <input
              type="number"
              min={0}
              value={draft.estimate}
              onChange={(event) => setDraft({ ...draft, estimate: event.target.value })}
            />
          </Field>
          <Field label="Due date">
            <input
              type="date"
              value={draft.due}
              onChange={(event) => setDraft({ ...draft, due: event.target.value })}
            />
          </Field>
          <Field label="Labels (comma separated)">
            <input
              value={draft.labels}
              onChange={(event) => setDraft({ ...draft, labels: event.target.value })}
            />
          </Field>
        </div>
        <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          Save changes
        </button>

        <section className="comments">
          <h3>Comments</h3>
          {commentsQuery.data?.map((comment) => (
            <article key={comment.id} className="comment">
              <Avatar user={userById(comment.author_id)} size={24} />
              <div>
                <div className="comment-meta">
                  <strong>{userById(comment.author_id)?.name ?? 'Unknown'}</strong>
                  <span className="muted">{new Date(comment.created_at).toLocaleString()}</span>
                </div>
                <p>{comment.body}</p>
              </div>
            </article>
          ))}
          <textarea
            rows={3}
            placeholder="Leave a comment"
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
          />
          <button
            type="button"
            disabled={!commentBody.trim() || commentMutation.isPending}
            onClick={() => commentMutation.mutate()}
          >
            Comment
          </button>
        </section>
      </div>

      <aside className="detail-side">
        <Field label="Assignee">
          <select
            value={ticket.assignee_id ?? ''}
            onChange={(event) => assignMutation.mutate(event.target.value || null)}
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="transitions">
          <h4>Move to</h4>
          {ALLOWED_TRANSITIONS[ticket.status].map((status) => (
            <button key={status} type="button" onClick={() => transitionMutation.mutate(status)}>
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>

        <dl className="meta-list">
          <dt>Reporter</dt>
          <dd>{userById(ticket.reporter_id)?.name ?? ticket.reporter_id}</dd>
          <dt>Created</dt>
          <dd>{new Date(ticket.created_at).toLocaleString()}</dd>
          <dt>Updated</dt>
          <dd>{new Date(ticket.updated_at).toLocaleString()}</dd>
          <dt>Started</dt>
          <dd>{ticket.started_at ? new Date(ticket.started_at).toLocaleString() : '—'}</dd>
          <dt>Completed</dt>
          <dd>{ticket.completed_at ? new Date(ticket.completed_at).toLocaleString() : '—'}</dd>
          <dt>Cycle time</dt>
          <dd>{cycle}</dd>
          <dt>Parent</dt>
          <dd>{ticket.parent_id ? <Link to={`/tickets/${ticket.parent_id}`}>{ticket.parent_id}</Link> : '—'}</dd>
        </dl>

        <section className="activity-side">
          <h4>History</h4>
          <ul>
            {activityQuery.data?.map((entry) => (
              <li key={entry.id}>
                <span className="muted">{new Date(entry.created_at).toLocaleString()}</span>{' '}
                {entry.actor_name ?? 'someone'} — {entry.action}
                {entry.field ? ` (${entry.field}: ${entry.from_value ?? '∅'} → ${entry.to_value ?? '∅'})` : ''}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
