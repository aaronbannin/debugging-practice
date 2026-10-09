import { useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { BoardPage } from './pages/Board';
import { ListPage } from './pages/List';
import { TicketDetailPage } from './pages/TicketDetail';
import { DashboardPage } from './pages/Dashboard';
import { ActivityPage } from './pages/Activity';
import { NewTicketDialog } from './components/NewTicketDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAppState } from './hooks/useAppState';
import { Avatar, Spinner } from './components/ui';

export function App() {
  const { projects, projectId, setProjectId, users, actorId, setActorId, actor, loading } =
    useAppState();
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">TaskFlow</div>
        <nav>
          <NavLink to="/">Board</NavLink>
          <NavLink to="/list">List</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/activity">Activity</NavLink>
        </nav>
        <div className="header-right">
          <select value={projectId ?? ''} onChange={(event) => setProjectId(event.target.value)}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.key} — {project.name}
              </option>
            ))}
          </select>
          <select value={actorId ?? ''} onChange={(event) => setActorId(event.target.value)}>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <Avatar user={actor} />
          <button type="button" className="primary" onClick={() => setShowNew(true)}>
            New ticket
          </button>
        </div>
      </header>

      <main>
        {loading ? (
          <Spinner label="Starting up" />
        ) : (
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<BoardPage />} />
              <Route path="/list" element={<ListPage />} />
              <Route path="/tickets/:id" element={<TicketDetailPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/activity" element={<ActivityPage />} />
            </Routes>
          </ErrorBoundary>
        )}
      </main>

      {showNew ? <NewTicketDialog onClose={() => setShowNew(false)} /> : null}
    </div>
  );
}
