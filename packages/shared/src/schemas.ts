import { z } from 'zod';
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, PRIORITIES, SORTABLE_FIELDS, STATUSES } from './constants.js';

export const statusSchema = z.enum(STATUSES);
export const prioritySchema = z.enum(PRIORITIES);

export const labelSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9][a-z0-9-_]*$/i, 'labels must be alphanumeric with - or _');

export const createTicketSchema = z.object({
  project_id: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  description: z.string().max(10_000).nullish(),
  status: statusSchema.optional(),
  priority: prioritySchema.default('p2'),
  assignee_id: z.string().nullish(),
  reporter_id: z.string().min(1),
  estimate: z.number().int().min(0).max(100).nullish(),
  due_at: z.number().int().nullish(),
  parent_id: z.string().nullish(),
  labels: z.array(labelSchema).max(10).default([]),
});

export const updateTicketSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().max(10_000).nullish(),
  priority: prioritySchema.optional(),
  assignee_id: z.string().nullish(),
  estimate: z.number().int().min(0).max(100).nullish(),
  due_at: z.number().int().nullish(),
  parent_id: z.string().nullish(),
  labels: z.array(labelSchema).max(10).optional(),
  version: z.number().int().min(0),
  actor_id: z.string().min(1),
});

export const transitionSchema = z.object({
  to: statusSchema,
  actor_id: z.string().min(1),
  version: z.number().int().min(0).optional(),
  note: z.string().max(1000).nullish(),
});

export const moveSchema = z.object({
  status: statusSchema,
  before_id: z.string().nullish(),
  after_id: z.string().nullish(),
  actor_id: z.string().min(1),
});

export const createCommentSchema = z.object({
  author_id: z.string().min(1),
  body: z.string().trim().min(1).max(5000),
});

export const bulkStatusSchema = z.object({
  ticket_ids: z.array(z.string().min(1)).min(1).max(200),
  to: statusSchema,
  actor_id: z.string().min(1),
});

export const bulkAssignSchema = z.object({
  ticket_ids: z.array(z.string().min(1)).min(1).max(200),
  assignee_id: z.string().nullable(),
  actor_id: z.string().min(1),
});

export const bulkLabelSchema = z.object({
  ticket_ids: z.array(z.string().min(1)).min(1).max(200),
  add: z.array(labelSchema).max(10).default([]),
  remove: z.array(labelSchema).max(10).default([]),
  actor_id: z.string().min(1),
});

const csvList = (inner: z.ZodTypeAny) =>
  z.preprocess((v) => {
    if (v === undefined || v === null || v === '') return undefined;
    if (Array.isArray(v)) return v;
    return String(v)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, z.array(inner).optional());

const numeric = z.preprocess((v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}, z.number().optional());

export const listQuerySchema = z.object({
  project_id: z.string().optional(),
  q: z.string().trim().max(200).optional(),
  status: csvList(statusSchema),
  priority: csvList(prioritySchema),
  assignee_id: csvList(z.string()),
  label: csvList(z.string()),
  overdue: z.preprocess((v) => (v === undefined || v === '' ? undefined : v === 'true' || v === true), z.boolean().optional()),
  unassigned: z.preprocess((v) => (v === undefined || v === '' ? undefined : v === 'true' || v === true), z.boolean().optional()),
  created_after: numeric,
  created_before: numeric,
  sort: z.enum(SORTABLE_FIELDS).default('updated_at'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.preprocess((v) => {
    const n = Number(v ?? 1);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  }, z.number().int().min(1)),
  page_size: z.preprocess((v) => {
    const n = Number(v ?? PAGE_SIZE_DEFAULT);
    if (!Number.isFinite(n) || n < 1) return PAGE_SIZE_DEFAULT;
    return Math.min(Math.floor(n), PAGE_SIZE_MAX);
  }, z.number().int().min(1).max(PAGE_SIZE_MAX)),
});

export const statsQuerySchema = z.object({
  project_id: z.string().optional(),
  days: z.preprocess((v) => {
    const n = Number(v ?? 7);
    if (!Number.isFinite(n) || n < 1) return 7;
    return Math.min(Math.floor(n), 90);
  }, z.number().int().min(1).max(90)),
});

export const clientErrorSchema = z.object({
  message: z.string().max(2000),
  stack: z.string().max(10_000).nullish(),
  component: z.string().max(200).nullish(),
  url: z.string().max(2000).nullish(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;
export type MoveInput = z.infer<typeof moveSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type StatsQuery = z.infer<typeof statsQuerySchema>;
export type BulkStatusInput = z.infer<typeof bulkStatusSchema>;
export type BulkAssignInput = z.infer<typeof bulkAssignSchema>;
export type BulkLabelInput = z.infer<typeof bulkLabelSchema>;
