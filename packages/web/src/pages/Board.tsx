import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STATUS_LABELS, type Status, type Ticket } from '@dp/shared';
import { api } from '../api/client';
import { useAppState } from '../hooks/useAppState';
import { TicketCard } from '../components/TicketCard';
import { EmptyState, ErrorNote, Spinner } from '../components/ui';

interface DropTarget {
  status: Status;
  beforeId: string | null;
  afterId: string | null;
}

export function BoardPage() {
  const { projectId, actorId, userById, users } = useAppState();
  const queryClient = useQueryClient();
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [search, setSearch] = useState('');
  const dragging = useRef<Ticket | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<unknown>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (projectId) p.set('project_id', projectId);
    if (assigneeFilter) p.set('assignee_id', assigneeFilter);
    if (search) p.set('q', search);
    return p;
  }, [projectId, assigneeFilter, search]);

  const boardQuery = useQuery({
    queryKey: ['board', params.toString()],
    queryFn: () => api.board(params),
    enabled: Boolean(projectId),
  });

  const moveMutation = useMutation({
    mutationFn: ({ ticket, target }: { ticket: Ticket; target: DropTarget }) =>
      api.move(ticket.id, {
        status: target.status,
        before_id: target.beforeId,
        after_id: target.afterId,
        actor_id: actorId,
      }),
    onError: (error) => setActionError(error),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['board'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (status: Status) =>
      api.bulkStatus({ ticket_ids: [...selection], to: status, actor_id: actorId }),
    onError: (error) => setActionError(error),
    onSuccess: () => {
      setActionError(null);
      setSelection(new Set());
      void queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });

  if (!projectId) return <Spinner label="Choosing a project" />;
  if (boardQuery.isLoading) return <Spinner label="Loading board" />;
  if (boardQuery.error) return <ErrorNote error={boardQuery.error} />;

  const board = boardQuery.data;
  if (!board) return <EmptyState message="No board data" />;

  const dropOnCard = (status: Status, column: Ticket[], target: Ticket) => {
    const source = dragging.current;
    if (!source) return;
    const remaining = column.filter((t) => t.id !== source.id);
    const index = remaining.findIndex((t) => t.id === target.id);
    const before = index > 0 ? remaining[index - 1] : null;
    moveMutation.mutate({
      ticket: source,
      target: { status, beforeId: before?.id ?? null, afterId: target.id },
    });
    dragging.current = null;
  };

  const dropOnColumn = (status: Status, column: Ticket[]) => {
    const source = dragging.current;
    if (!source) return;
    const remaining = column.filter((t) => t.id !== source.id);
    const last = remaining[remaining.length - 1] ?? null;
    moveMutation.mutate({
      ticket: source,
      target: { status, beforeId: last?.id ?? null, afterId: null },
    });
    dragging.current = null;
  };

  const toggleSelect = (ticket: Ticket) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(ticket.id)) next.delete(ticket.id);
      else next.add(ticket.id);
      return next;
    });
  };

  return (
    <div className="board-page">
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search this board"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
          <option value="">All assignees</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        {selection.size > 0 ? (
          <div className="bulk-bar">
            <span>{selection.size} selected</span>
            <select
              defaultValue=""
              onChange={(event) => {
                if (!event.target.value) return;
                bulkMutation.mutate(event.target.value as Status);
                event.target.value = '';
              }}
            >
              <option value="">Bulk move to…</option>
              {board.columns.map((column) => (
                <option key={column.status} value={column.status}>
                  {STATUS_LABELS[column.status]}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setSelection(new Set())}>
              Clear
            </button>
          </div>
        ) : null}
      </div>

      {actionError ? <ErrorNote error={actionError} /> : null}

      <div className="board">
        {board.columns.map((column) => (
          <section
            key={column.status}
            className={`board-column ${column.over_limit ? 'over-limit' : ''}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dropOnColumn(column.status, column.tickets)}
          >
            <header>
              <h3>{STATUS_LABELS[column.status]}</h3>
              <span className="count">
                {column.tickets.length}
                {column.wip_limit !== null ? ` / ${column.wip_limit}` : ''}
              </span>
            </header>
            <div className="column-body">
              {column.tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onDrop={(event) => {
                    event.stopPropagation();
                    dropOnCard(column.status, column.tickets, ticket);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                >
                  <TicketCard
                    ticket={ticket}
                    assignee={userById(ticket.assignee_id)}
                    draggable
                    onDragStart={(t) => {
                      dragging.current = t;
                    }}
                    selected={selection.has(ticket.id)}
                    onToggleSelect={toggleSelect}
                  />
                </div>
              ))}
              {column.tickets.length === 0 ? <EmptyState message="Nothing here" /> : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
