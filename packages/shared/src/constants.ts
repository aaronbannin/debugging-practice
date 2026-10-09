export const STATUSES = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'blocked',
  'done',
  'cancelled',
] as const;

export type Status = (typeof STATUSES)[number];

export const BOARD_COLUMNS: Status[] = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'blocked',
  'done',
];

export const STATUS_LABELS: Record<Status, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  blocked: 'Blocked',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  backlog: ['todo', 'cancelled'],
  todo: ['backlog', 'in_progress', 'blocked', 'cancelled'],
  in_progress: ['in_review', 'blocked', 'todo', 'done', 'cancelled'],
  in_review: ['in_progress', 'done', 'blocked', 'cancelled'],
  blocked: ['todo', 'in_progress', 'in_review', 'cancelled'],
  done: ['in_progress'],
  cancelled: ['backlog'],
};

export const ACTIVE_STATUSES: Status[] = ['todo', 'in_progress', 'in_review', 'blocked'];
export const TERMINAL_STATUSES: Status[] = ['done', 'cancelled'];

export const WORK_STARTED_STATUSES: Status[] = ['in_progress', 'in_review'];

export const PRIORITIES = ['p0', 'p1', 'p2', 'p3'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  p0: 'Critical',
  p1: 'High',
  p2: 'Medium',
  p3: 'Low',
};

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  p0: 0,
  p1: 1,
  p2: 2,
  p3: 3,
};

export const DEFAULT_WIP_LIMITS: Partial<Record<Status, number>> = {
  in_progress: 6,
  in_review: 4,
};

export const SORTABLE_FIELDS = [
  'created_at',
  'updated_at',
  'due_at',
  'priority',
  'status',
  'key',
  'title',
  'estimate',
] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];

export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MAX = 100;

export const DUE_SOON_DAYS = 3;
export const STALE_IN_PROGRESS_DAYS = 10;
