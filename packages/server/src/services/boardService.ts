import { BOARD_COLUMNS, type BoardColumn, type BoardView, type Status } from '@dp/shared';
import { db, findProject, hydrate, type TicketRow } from './repo.js';
import { wipLimitFor } from './transitions.js';
import { assertColumnOrdering } from './ranking.js';
import { notFound } from '../lib/errors.js';
import { warnIf } from '../lib/invariants.js';
import { contextLogger } from '../lib/requestContext.js';

export interface BoardOptions {
  project_id: string;
  assignee_id?: string;
  label?: string;
  q?: string;
}

export function getBoard(options: BoardOptions): BoardView {
  const project = findProject(options.project_id);
  if (!project) throw notFound('project', options.project_id);

  const clauses: string[] = ['t.project_id = ?', 't.status = ?'];
  const extraParams: unknown[] = [];
  let joins = '';

  if (options.assignee_id) {
    clauses.push('t.assignee_id = ?');
    extraParams.push(options.assignee_id);
  }
  if (options.label) {
    joins += ' JOIN ticket_labels tl ON tl.ticket_id = t.id';
    clauses.push('tl.label = ?');
    extraParams.push(options.label.toLowerCase());
  }
  if (options.q) {
    clauses.push('(t.title LIKE ? OR t.key LIKE ?)');
    extraParams.push(`%${options.q}%`, `%${options.q}%`);
  }

  const statement = db().prepare<unknown[], TicketRow>(
    `SELECT t.* FROM tickets t${joins}
      WHERE ${clauses.join(' AND ')}
      ORDER BY t.rank ASC, t.created_at ASC`,
  );

  const columns: BoardColumn[] = BOARD_COLUMNS.map((status: Status) => {
    const rows = statement.all(project.id, status, ...extraParams);
    const tickets = hydrate(rows);
    assertColumnOrdering(project.id, status);
    const limit = wipLimitFor(project.id, status);
    const overLimit = limit !== null && tickets.length > limit;

    warnIf('wip_limit_exceeded', overLimit, {
      project_id: project.id,
      status,
      limit,
      actual: tickets.length,
    });

    return { status, tickets, wip_limit: limit, over_limit: overLimit };
  });

  const total = columns.reduce((sum, column) => sum + column.tickets.length, 0);
  contextLogger().debug(
    { event: 'board_view', project_id: project.id, columns: columns.length, tickets: total },
    'built board view',
  );

  return { project_id: project.id, columns };
}
