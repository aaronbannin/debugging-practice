import { toIso, type ListQuery, type Ticket } from '@dp/shared';
import { listTickets } from './ticketService.js';
import { listUsers } from './repo.js';
import { contextLogger } from '../lib/requestContext.js';

const COLUMNS = [
  'key',
  'title',
  'status',
  'priority',
  'assignee',
  'reporter',
  'estimate',
  'labels',
  'due_at',
  'created_at',
  'updated_at',
  'completed_at',
] as const;

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function ticketsToCsv(tickets: Ticket[]): string {
  const users = new Map(listUsers().map((u) => [u.id, u.name]));
  const lines: string[] = [COLUMNS.join(',')];
  for (const ticket of tickets) {
    lines.push(
      [
        ticket.key,
        ticket.title,
        ticket.status,
        ticket.priority,
        ticket.assignee_id ? users.get(ticket.assignee_id) ?? ticket.assignee_id : '',
        users.get(ticket.reporter_id) ?? ticket.reporter_id,
        ticket.estimate,
        ticket.labels.join(' '),
        ticket.due_at ? toIso(ticket.due_at) : '',
        toIso(ticket.created_at),
        toIso(ticket.updated_at),
        ticket.completed_at ? toIso(ticket.completed_at) : '',
      ]
        .map(escapeCell)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

export function exportTickets(query: ListQuery): string {
  const all: Ticket[] = [];
  let page = 1;
  for (;;) {
    const result = listTickets({ ...query, page, page_size: 100 });
    all.push(...result.items);
    if (page >= result.page_count || result.items.length === 0) break;
    page += 1;
    if (page > 200) break;
  }
  contextLogger().info({ event: 'csv_export', rows: all.length }, `exported ${all.length} tickets`);
  return ticketsToCsv(all);
}
