import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAppState } from '../hooks/useAppState';
import { EmptyState, ErrorNote, Spinner } from '../components/ui';

export function ActivityPage() {
  const { projectId, users } = useAppState();
  const [actor, setActor] = useState('');
  const [limit, setLimit] = useState(50);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (projectId) p.set('project_id', projectId);
    if (actor) p.set('actor_id', actor);
    p.set('limit', String(limit));
    return p;
  }, [projectId, actor, limit]);

  const feedQuery = useQuery({
    queryKey: ['activity', params.toString()],
    queryFn: () => api.activity(params),
    enabled: Boolean(projectId),
    refetchInterval: 10_000,
  });

  return (
    <div className="activity-page">
      <div className="toolbar">
        <select value={actor} onChange={(event) => setActor(event.target.value)}>
          <option value="">Everyone</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
          {[25, 50, 100, 200].map((n) => (
            <option key={n} value={n}>
              Show {n}
            </option>
          ))}
        </select>
      </div>

      {feedQuery.isLoading ? <Spinner label="Loading activity" /> : null}
      {feedQuery.error ? <ErrorNote error={feedQuery.error} /> : null}

      <ul className="feed">
        {feedQuery.data?.map((entry) => (
          <li key={entry.id}>
            <span className="muted">{new Date(entry.created_at).toLocaleString()}</span>
            <strong>{entry.actor_name ?? 'someone'}</strong>
            <span>{entry.action.replace(/_/g, ' ')}</span>
            {entry.ticket_id ? (
              <Link to={`/tickets/${entry.ticket_id}`}>{entry.ticket_key ?? entry.ticket_id}</Link>
            ) : null}
            {entry.field ? (
              <span className="muted">
                {entry.field}: {entry.from_value ?? '∅'} → {entry.to_value ?? '∅'}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {feedQuery.data && feedQuery.data.length === 0 ? (
        <EmptyState message="No activity yet" />
      ) : null}
    </div>
  );
}
