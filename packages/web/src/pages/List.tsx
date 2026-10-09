import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  SORTABLE_FIELDS,
  STATUSES,
  STATUS_LABELS,
  type Priority,
  type SortableField,
  type Status,
} from '@dp/shared';
import { api } from '../api/client';
import { useAppState } from '../hooks/useAppState';
import { Avatar, EmptyState, ErrorNote, PriorityTag, Spinner, StatusPill } from '../components/ui';

export function ListPage() {
  const { projectId, actorId, users, userById } = useAppState();
  const queryClient = useQueryClient();

  const [q, setQ] = useState('');
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [assignee, setAssignee] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [sort, setSort] = useState<SortableField>('updated_at');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<unknown>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (projectId) p.set('project_id', projectId);
    if (q) p.set('q', q);
    if (statuses.length > 0) p.set('status', statuses.join(','));
    if (priorities.length > 0) p.set('priority', priorities.join(','));
    if (assignee) p.set('assignee_id', assignee);
    if (overdueOnly) p.set('overdue', 'true');
    if (unassignedOnly) p.set('unassigned', 'true');
    p.set('sort', sort);
    p.set('dir', dir);
    p.set('page', String(page));
    p.set('page_size', String(pageSize));
    return p;
  }, [projectId, q, statuses, priorities, assignee, overdueOnly, unassignedOnly, sort, dir, page, pageSize]);

  const listQuery = useQuery({
    queryKey: ['tickets', params.toString()],
    queryFn: () => api.tickets(params),
    enabled: Boolean(projectId),
    placeholderData: (previous) => previous,
  });

  const bulkAssign = useMutation({
    mutationFn: (assigneeId: string | null) =>
      api.bulkAssign({ ticket_ids: [...selection], assignee_id: assigneeId, actor_id: actorId }),
    onError: setActionError,
    onSuccess: () => {
      setActionError(null);
      setSelection(new Set());
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const bulkLabel = useMutation({
    mutationFn: (label: string) =>
      api.bulkLabel({ ticket_ids: [...selection], add: [label], remove: [], actor_id: actorId }),
    onError: setActionError,
    onSuccess: () => {
      setActionError(null);
      setSelection(new Set());
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const data = listQuery.data;

  return (
    <div className="list-page">
      <div className="filters">
        <input
          type="search"
          placeholder="Search title, key, description"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
        />
        <div className="chip-row">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={`chip ${statuses.includes(status) ? 'active' : ''}`}
              onClick={() => {
                setStatuses((prev) => toggle(prev, status));
                setPage(1);
              }}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        <div className="chip-row">
          {PRIORITIES.map((priority) => (
            <button
              key={priority}
              type="button"
              className={`chip ${priorities.includes(priority) ? 'active' : ''}`}
              onClick={() => {
                setPriorities((prev) => toggle(prev, priority));
                setPage(1);
              }}
            >
              {PRIORITY_LABELS[priority]}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <select
            value={assignee}
            onChange={(event) => {
              setAssignee(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All assignees</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <label>
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(event) => {
                setOverdueOnly(event.target.checked);
                setPage(1);
              }}
            />
            Overdue only
          </label>
          <label>
            <input
              type="checkbox"
              checked={unassignedOnly}
              onChange={(event) => {
                setUnassignedOnly(event.target.checked);
                setPage(1);
              }}
            />
            Unassigned only
          </label>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortableField)}>
            {SORTABLE_FIELDS.map((field) => (
              <option key={field} value={field}>
                Sort by {field.replace('_', ' ')}
              </option>
            ))}
          </select>
          <select value={dir} onChange={(event) => setDir(event.target.value as 'asc' | 'desc')}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
          <a className="export-link" href={`/api/export/tickets.csv?${params.toString()}`}>
            Export CSV
          </a>
        </div>
      </div>

      {selection.size > 0 ? (
        <div className="bulk-bar">
          <span>{selection.size} selected</span>
          <select
            defaultValue=""
            onChange={(event) => {
              const value = event.target.value;
              if (!value) return;
              bulkAssign.mutate(value === '__none__' ? null : value);
              event.target.value = '';
            }}
          >
            <option value="">Assign to…</option>
            <option value="__none__">Unassign</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <select
            defaultValue=""
            onChange={(event) => {
              if (!event.target.value) return;
              bulkLabel.mutate(event.target.value);
              event.target.value = '';
            }}
          >
            <option value="">Add label…</option>
            {['backend', 'frontend', 'infra', 'security', 'perf', 'tech-debt'].map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setSelection(new Set())}>
            Clear
          </button>
        </div>
      ) : null}

      {actionError ? <ErrorNote error={actionError} /> : null}
      {listQuery.error ? <ErrorNote error={listQuery.error} /> : null}
      {listQuery.isLoading ? <Spinner label="Loading tickets" /> : null}

      {data ? (
        <>
          <table className="ticket-table">
            <thead>
              <tr>
                <th />
                <th>Key</th>
                <th>Title</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Due</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selection.has(ticket.id)}
                      onChange={() =>
                        setSelection((prev) => {
                          const next = new Set(prev);
                          if (next.has(ticket.id)) next.delete(ticket.id);
                          else next.add(ticket.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td>
                    <Link to={`/tickets/${ticket.id}`}>{ticket.key}</Link>
                  </td>
                  <td className="title-cell">{ticket.title}</td>
                  <td>
                    <StatusPill status={ticket.status} />
                  </td>
                  <td>
                    <PriorityTag priority={ticket.priority} />
                  </td>
                  <td>
                    <Avatar user={userById(ticket.assignee_id)} size={22} />
                  </td>
                  <td>{ticket.due_at ? new Date(ticket.due_at).toLocaleDateString() : '—'}</td>
                  <td>{new Date(ticket.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.items.length === 0 ? <EmptyState message="No tickets match these filters" /> : null}

          <div className="pager">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {data.page} of {Math.max(data.page_count, 1)} · {data.total} tickets
            </span>
            <button
              type="button"
              disabled={page >= data.page_count}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
