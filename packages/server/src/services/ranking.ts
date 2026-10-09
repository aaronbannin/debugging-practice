import { RANK_STEP, initialRank, needsRebalance, rankBetween, type Status } from '@dp/shared';
import { db } from './repo.js';
import { contextLogger } from '../lib/requestContext.js';
import { check } from '../lib/invariants.js';

export interface RankedTicket {
  id: string;
  rank: number;
}

export function columnTickets(projectId: string, status: Status): RankedTicket[] {
  return db()
    .prepare<[string, string], RankedTicket>(
      'SELECT id, rank FROM tickets WHERE project_id = ? AND status = ? ORDER BY rank ASC, created_at ASC',
    )
    .all(projectId, status);
}

export function appendRank(projectId: string, status: Status): number {
  const row = db()
    .prepare<[string, string], { max_rank: number | null }>(
      'SELECT MAX(rank) AS max_rank FROM tickets WHERE project_id = ? AND status = ?',
    )
    .get(projectId, status);
  const max = row?.max_rank ?? null;
  return max === null ? RANK_STEP : max + RANK_STEP;
}

function rankOf(projectId: string, status: Status, ticketId: string | null | undefined): number | null {
  if (!ticketId) return null;
  const row = db()
    .prepare<[string, string, string], { rank: number }>(
      'SELECT rank FROM tickets WHERE id = ? AND project_id = ? AND status = ?',
    )
    .get(ticketId, projectId, status);
  return row ? row.rank : null;
}

export function rebalanceColumn(projectId: string, status: Status): number {
  const tickets = columnTickets(projectId, status);
  const update = db().prepare('UPDATE tickets SET rank = ? WHERE id = ?');
  tickets.forEach((ticket, index) => {
    update.run(initialRank(index), ticket.id);
  });
  contextLogger().warn(
    { event: 'rank_rebalance', project_id: projectId, status, count: tickets.length },
    'rebalanced board column ranks',
  );
  return tickets.length;
}

export function computeRank(
  projectId: string,
  status: Status,
  beforeId: string | null | undefined,
  afterId: string | null | undefined,
): number {
  const beforeRank = rankOf(projectId, status, beforeId);
  const afterRank = rankOf(projectId, status, afterId);

  if (needsRebalance(beforeRank, afterRank)) {
    rebalanceColumn(projectId, status);
    const retryBefore = rankOf(projectId, status, beforeId);
    const retryAfter = rankOf(projectId, status, afterId);
    return rankBetween(retryBefore, retryAfter);
  }

  if (beforeRank === null && afterRank === null) {
    return appendRank(projectId, status);
  }

  const next = rankBetween(beforeRank, afterRank);
  check('rank_is_finite', Number.isFinite(next), {
    project_id: projectId,
    status,
    before_id: beforeId ?? null,
    after_id: afterId ?? null,
    before_rank: beforeRank,
    after_rank: afterRank,
  });
  return next;
}

export function assertColumnOrdering(projectId: string, status: Status): boolean {
  const tickets = columnTickets(projectId, status);
  const seen = new Set<number>();
  let duplicates = 0;
  for (const ticket of tickets) {
    if (seen.has(ticket.rank)) duplicates += 1;
    seen.add(ticket.rank);
  }
  return check('board_ranks_unique', duplicates === 0, {
    project_id: projectId,
    status,
    duplicates,
    column_size: tickets.length,
  });
}
