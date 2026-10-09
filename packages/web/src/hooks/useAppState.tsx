import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Project, User } from '@dp/shared';
import { api } from '../api/client';

interface AppState {
  projects: Project[];
  users: User[];
  projectId: string | null;
  setProjectId: (id: string) => void;
  actorId: string | null;
  setActorId: (id: string) => void;
  actor: User | null;
  userById: (id: string | null) => User | null;
  loading: boolean;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: api.projects });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: api.users });

  const [projectId, setProjectId] = useState<string | null>(
    () => localStorage.getItem('dp.project') ?? null,
  );
  const [actorId, setActorId] = useState<string | null>(
    () => localStorage.getItem('dp.actor') ?? null,
  );

  const projects = projectsQuery.data ?? [];
  const users = usersQuery.data ?? [];

  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0].id);
  }, [projectId, projects]);

  useEffect(() => {
    if (!actorId && users.length > 0) setActorId(users[0].id);
  }, [actorId, users]);

  useEffect(() => {
    if (projectId) localStorage.setItem('dp.project', projectId);
  }, [projectId]);

  useEffect(() => {
    if (actorId) localStorage.setItem('dp.actor', actorId);
  }, [actorId]);

  const value = useMemo<AppState>(() => {
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      projects,
      users,
      projectId,
      setProjectId,
      actorId,
      setActorId,
      actor: actorId ? byId.get(actorId) ?? null : null,
      userById: (id: string | null) => (id ? byId.get(id) ?? null : null),
      loading: projectsQuery.isLoading || usersQuery.isLoading,
    };
  }, [projects, users, projectId, actorId, projectsQuery.isLoading, usersQuery.isLoading]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
