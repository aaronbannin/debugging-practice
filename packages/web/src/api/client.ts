import type {
  ActivityEntry,
  BoardView,
  Comment,
  DashboardStats,
  Page,
  Project,
  Status,
  Ticket,
  User,
} from '@dp/shared';

const BASE = '/api';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, details: unknown, requestId?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = payload?.error ?? {};
    throw new ApiRequestError(
      response.status,
      error.code ?? 'unknown',
      error.message ?? response.statusText,
      error.details,
      error.request_id,
    );
  }

  return payload as T;
}

export const api = {
  projects: () => request<Project[]>('/projects'),
  project: (id: string) => request<Project & { wip: Array<{ status: Status; limit: number | null; current: number }> }>(`/projects/${id}`),
  users: () => request<User[]>('/users'),

  board: (params: URLSearchParams) => request<BoardView>(`/board?${params.toString()}`),

  tickets: (params: URLSearchParams) => request<Page<Ticket>>(`/tickets?${params.toString()}`),
  ticket: (id: string) => request<Ticket>(`/tickets/${id}`),
  createTicket: (body: unknown) =>
    request<Ticket>('/tickets', { method: 'POST', body: JSON.stringify(body) }),
  updateTicket: (id: string, body: unknown) =>
    request<Ticket>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  transition: (id: string, body: unknown) =>
    request<Ticket>(`/tickets/${id}/transition`, { method: 'POST', body: JSON.stringify(body) }),
  move: (id: string, body: unknown) =>
    request<Ticket>(`/tickets/${id}/move`, { method: 'POST', body: JSON.stringify(body) }),
  deleteTicket: (id: string, actorId: string) =>
    request<void>(`/tickets/${id}?actor_id=${encodeURIComponent(actorId)}`, { method: 'DELETE' }),

  comments: (id: string) => request<Comment[]>(`/tickets/${id}/comments`),
  addComment: (id: string, body: unknown) =>
    request<Comment>(`/tickets/${id}/comments`, { method: 'POST', body: JSON.stringify(body) }),

  activity: (params: URLSearchParams) =>
    request<Array<ActivityEntry & { ticket_key: string | null; actor_name: string | null }>>(
      `/activity?${params.toString()}`,
    ),

  dashboard: (params: URLSearchParams) => request<DashboardStats>(`/stats/dashboard?${params.toString()}`),
  dueSoon: (params: URLSearchParams) => request<Ticket[]>(`/stats/due-soon?${params.toString()}`),

  bulkStatus: (body: unknown) => request<unknown>('/bulk/status', { method: 'POST', body: JSON.stringify(body) }),
  bulkAssign: (body: unknown) => request<unknown>('/bulk/assign', { method: 'POST', body: JSON.stringify(body) }),
  bulkLabel: (body: unknown) => request<unknown>('/bulk/label', { method: 'POST', body: JSON.stringify(body) }),

  reportClientError: (body: unknown) =>
    fetch(`${BASE}/client-errors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => undefined),
};
