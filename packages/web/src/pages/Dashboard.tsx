import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { STATUSES, STATUS_LABELS, humanDuration, MS_PER_HOUR } from '@dp/shared';
import { api } from '../api/client';
import { useAppState } from '../hooks/useAppState';
import { EmptyState, ErrorNote, Spinner, StatusPill } from '../components/ui';

export function DashboardPage() {
  const { projectId, userById } = useAppState();
  const [days, setDays] = useState(7);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (projectId) p.set('project_id', projectId);
    p.set('days', String(days));
    return p;
  }, [projectId, days]);

  const statsQuery = useQuery({
    queryKey: ['dashboard', params.toString()],
    queryFn: () => api.dashboard(params),
    enabled: Boolean(projectId),
  });

  const dueSoonQuery = useQuery({
    queryKey: ['due-soon', projectId],
    queryFn: () => api.dueSoon(new URLSearchParams(projectId ? { project_id: projectId } : {})),
    enabled: Boolean(projectId),
  });

  if (statsQuery.isLoading) return <Spinner label="Crunching numbers" />;
  if (statsQuery.error) return <ErrorNote error={statsQuery.error} />;
  const stats = statsQuery.data;
  if (!stats) return <EmptyState message="No stats" />;

  const maxThroughput = Math.max(1, ...stats.throughput.map((bucket) => bucket.completed));

  return (
    <div className="dashboard-page">
      <div className="toolbar">
        <label>
          Window
          <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
            {[7, 14, 30, 60].map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Total tickets</span>
          <span className="stat-value">{stats.total_tickets}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Open</span>
          <span className="stat-value">{stats.open_tickets}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg cycle time</span>
          <span className="stat-value">
            {stats.avg_cycle_time_hours === null
              ? '—'
              : humanDuration(stats.avg_cycle_time_hours * MS_PER_HOUR)}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Median cycle time</span>
          <span className="stat-value">
            {stats.median_cycle_time_hours === null
              ? '—'
              : humanDuration(stats.median_cycle_time_hours * MS_PER_HOUR)}
          </span>
        </div>
        <div className="stat-card warn">
          <span className="stat-label">Overdue</span>
          <span className="stat-value">{stats.overdue}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Due soon</span>
          <span className="stat-value">{stats.due_soon}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Unassigned</span>
          <span className="stat-value">{stats.unassigned}</span>
        </div>
        <div className="stat-card warn">
          <span className="stat-label">Stale in progress</span>
          <span className="stat-value">{stats.stale_in_progress}</span>
        </div>
      </div>

      <section className="panel">
        <h3>Throughput</h3>
        <div className="bars">
          {stats.throughput.map((bucket) => (
            <div key={bucket.day} className="bar-col" title={`${bucket.day}: ${bucket.completed}`}>
              <div
                className="bar"
                style={{ height: `${(bucket.completed / maxThroughput) * 100}%` }}
              />
              <span className="bar-label">{bucket.day.slice(5)}</span>
              <span className="bar-value">{bucket.completed}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Status breakdown</h3>
        <ul className="status-breakdown">
          {STATUSES.map((status) => (
            <li key={status}>
              <StatusPill status={status} />
              <span>{stats.counts_by_status[status] ?? 0}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>Workload</h3>
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Open</th>
              <th>Done</th>
            </tr>
          </thead>
          <tbody>
            {stats.by_assignee.map((row) => (
              <tr key={row.user_id}>
                <td>{userById(row.user_id)?.name ?? row.name}</td>
                <td>{row.open}</td>
                <td>{row.done}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h3>Due soon</h3>
        {dueSoonQuery.data && dueSoonQuery.data.length > 0 ? (
          <ul className="due-list">
            {dueSoonQuery.data.map((ticket) => (
              <li key={ticket.id}>
                <Link to={`/tickets/${ticket.id}`}>{ticket.key}</Link>
                <span className="title-cell">{ticket.title}</span>
                <StatusPill status={ticket.status} />
                <span>{ticket.due_at ? new Date(ticket.due_at).toLocaleDateString() : ''}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Nothing due in the next few days" />
        )}
      </section>
    </div>
  );
}
