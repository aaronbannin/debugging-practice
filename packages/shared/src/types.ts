import type { Priority, Status } from './constants.js';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_color: string;
  created_at: number;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string | null;
  created_at: number;
}

export interface Ticket {
  id: string;
  key: string;
  project_id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
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
  labels: string[];
}

export interface Comment {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  created_at: number;
}

export interface ActivityEntry {
  id: string;
  ticket_id: string | null;
  project_id: string | null;
  actor_id: string | null;
  action: string;
  field: string | null;
  from_value: string | null;
  to_value: string | null;
  created_at: number;
}

export interface StatusHistoryEntry {
  id: string;
  ticket_id: string;
  from_status: Status | null;
  to_status: Status;
  actor_id: string | null;
  changed_at: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  page_count: number;
}

export interface BoardColumn {
  status: Status;
  tickets: Ticket[];
  wip_limit: number | null;
  over_limit: boolean;
}

export interface BoardView {
  project_id: string;
  columns: BoardColumn[];
}

export interface DashboardStats {
  project_id: string | null;
  generated_at: number;
  counts_by_status: Record<string, number>;
  total_tickets: number;
  open_tickets: number;
  avg_cycle_time_hours: number | null;
  median_cycle_time_hours: number | null;
  throughput: Array<{ day: string; completed: number }>;
  overdue: number;
  due_soon: number;
  unassigned: number;
  stale_in_progress: number;
  by_assignee: Array<{ user_id: string; name: string; open: number; done: number }>;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
    request_id?: string;
  };
}
