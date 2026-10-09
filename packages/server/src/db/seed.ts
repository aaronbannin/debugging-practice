import { MS_PER_DAY, MS_PER_HOUR, initialRank, type Priority, type Status } from '@dp/shared';
import { getDb, closeDb, resetDb } from './index.js';
import { logger } from '../lib/logger.js';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20240917);

const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const int = (min: number, max: number): number => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number): boolean => rand() < p;

const NOW = Math.floor(Date.now() / MS_PER_HOUR) * MS_PER_HOUR;
const START_OF_TODAY = Math.floor(NOW / MS_PER_DAY) * MS_PER_DAY;
const ELAPSED_TODAY = NOW - START_OF_TODAY;

function earlierToday(): number | null {
  if (ELAPSED_TODAY < 2 * MS_PER_HOUR) return null;
  return START_OF_TODAY + Math.floor(ELAPSED_TODAY * (0.1 + 0.8 * rand()));
}

const USERS = [
  { name: 'Ada Okafor', email: 'ada@taskflow.dev', color: '#6366f1' },
  { name: 'Ben Ortiz', email: 'ben@taskflow.dev', color: '#0ea5e9' },
  { name: 'Chen Wei', email: 'chen@taskflow.dev', color: '#10b981' },
  { name: 'Dara Singh', email: 'dara@taskflow.dev', color: '#f59e0b' },
  { name: 'Elif Kaya', email: 'elif@taskflow.dev', color: '#ef4444' },
  { name: 'Fabio Rossi', email: 'fabio@taskflow.dev', color: '#a855f7' },
];

const PROJECTS = [
  { key: 'OPS', name: 'Platform Operations', description: 'Reliability, on-call, and infrastructure work.' },
  { key: 'WEB', name: 'Customer Web', description: 'The customer-facing web application.' },
  { key: 'DATA', name: 'Data Platform', description: 'Pipelines, warehouse, and reporting.' },
];

const LABELS = [
  'backend', 'frontend', 'infra', 'security', 'perf', 'ux', 'tech-debt',
  'customer', 'oncall', 'migration', 'flaky', 'docs',
];

const TITLE_VERBS = ['Fix', 'Investigate', 'Refactor', 'Add', 'Remove', 'Harden', 'Migrate', 'Document', 'Benchmark', 'Roll out'];
const TITLE_SUBJECTS = [
  'session expiry handling', 'retry backoff in the ingest worker', 'the nightly rollup job',
  'pagination on the search endpoint', 'webhook signature verification', 'the stale cache warmer',
  'connection pool sizing', 'the CSV export encoding', 'duplicate notification emails',
  'the audit trail writer', 'timezone handling in reports', 'the rate limiter buckets',
  'flaky integration suite', 'slow dashboard queries', 'orphaned attachment cleanup',
  'the feature flag rollout', 'index coverage on tickets', 'the onboarding checklist',
  'partial failures in bulk edit', 'metric cardinality explosion',
];

const COMMENT_BODIES = [
  'Reproduced on staging, attaching the request id.',
  'I think this is related to the change we shipped last week.',
  'Bumping priority, a customer hit this again this morning.',
  'Fix is up for review, kept it small on purpose.',
  'Could not reproduce locally, might be environment specific.',
  'Added a regression test before touching the logic.',
  'This is blocked until the migration lands.',
  'Rolled back, the error rate spiked right after deploy.',
  'Confirmed fixed in production, closing this out.',
  'Splitting the remaining work into a subtask.',
];

const STATUS_PLAN: Array<{ status: Status; count: number }> = [
  { status: 'backlog', count: 6 },
  { status: 'todo', count: 5 },
  { status: 'in_progress', count: 4 },
  { status: 'in_review', count: 2 },
  { status: 'blocked', count: 2 },
  { status: 'done', count: 8 },
  { status: 'cancelled', count: 1 },
];

const PATH_TO: Record<Status, Status[]> = {
  backlog: [],
  todo: ['todo'],
  in_progress: ['todo', 'in_progress'],
  in_review: ['todo', 'in_progress', 'in_review'],
  blocked: ['todo', 'in_progress', 'blocked'],
  done: ['todo', 'in_progress', 'in_review', 'done'],
  cancelled: ['todo', 'cancelled'],
};

function id(prefix: string, n: number): string {
  return `${prefix}_${String(n).padStart(4, '0')}`;
}

function seed(): void {
  const db = getDb();
  resetDb();

  const insertUser = db.prepare(
    'INSERT INTO users (id, name, email, avatar_color, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  const insertProject = db.prepare(
    'INSERT INTO projects (id, key, name, description, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  const insertCounter = db.prepare(
    'INSERT INTO project_counters (project_id, next_number) VALUES (?, ?)',
  );
  const insertWip = db.prepare(
    'INSERT INTO wip_limits (project_id, status, max_count) VALUES (?, ?, ?)',
  );
  const insertTicket = db.prepare(
    `INSERT INTO tickets (id, key, project_id, title, description, status, priority, assignee_id,
                          reporter_id, estimate, due_at, parent_id, rank, version, created_at,
                          updated_at, started_at, completed_at)
     VALUES (@id, @key, @project_id, @title, @description, @status, @priority, @assignee_id,
             @reporter_id, @estimate, @due_at, @parent_id, @rank, @version, @created_at,
             @updated_at, @started_at, @completed_at)`,
  );
  const insertLabel = db.prepare(
    'INSERT OR IGNORE INTO ticket_labels (ticket_id, label) VALUES (?, ?)',
  );
  const insertComment = db.prepare(
    'INSERT INTO comments (id, ticket_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  const insertHistory = db.prepare(
    'INSERT INTO status_history (id, ticket_id, from_status, to_status, actor_id, changed_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const insertActivity = db.prepare(
    `INSERT INTO activity (id, ticket_id, project_id, actor_id, action, field, from_value, to_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const userIds: string[] = [];
  USERS.forEach((user, index) => {
    const uid = id('usr', index + 1);
    insertUser.run(uid, user.name, user.email, user.color, NOW - 400 * MS_PER_DAY);
    userIds.push(uid);
  });

  let historyCounter = 0;
  let activityCounter = 0;
  let commentCounter = 0;
  let ticketCounter = 0;

  PROJECTS.forEach((project, projectIndex) => {
    const pid = id('prj', projectIndex + 1);
    insertProject.run(pid, project.key, project.name, project.description, NOW - 300 * MS_PER_DAY);
    insertWip.run(pid, 'in_progress', 6);
    insertWip.run(pid, 'in_review', 4);

    let number = 0;
    const createdTickets: Array<{ id: string; status: Status; created_at: number }> = [];

    for (const plan of STATUS_PLAN) {
      for (let i = 0; i < plan.count; i += 1) {
        ticketCounter += 1;
        number += 1;
        const tid = id('tkt', ticketCounter);
        const key = `${project.key}-${number}`;
        const createdAt = NOW - int(2, 60) * MS_PER_DAY - int(0, 23) * MS_PER_HOUR;
        const reporterId = pick(userIds);
        const assigneeId = plan.status === 'backlog' && chance(0.6) ? null : chance(0.12) ? null : pick(userIds);
        const priority = pick(['p0', 'p1', 'p2', 'p2', 'p3', 'p1'] as const) as Priority;

        const path = PATH_TO[plan.status];
        let cursor = createdAt;
        let startedAt: number | null = null;
        let completedAt: number | null = null;
        let previous: Status = 'backlog';

        const pendingHistory: Array<[string | null, Status, string, number]> = [
          [null, 'backlog', reporterId, createdAt],
        ];

        for (const step of path) {
          cursor += int(2, 48) * MS_PER_HOUR;
          if (cursor > NOW) cursor = NOW - int(1, 12) * MS_PER_HOUR;
          if (step === 'in_progress' && startedAt === null) startedAt = cursor;
          if (step === 'in_review' && startedAt === null) startedAt = cursor;
          if (step === 'done' || step === 'cancelled') completedAt = cursor;
          pendingHistory.push([previous, step, pick(userIds), cursor]);
          previous = step;
        }

        if (plan.status === 'done') {
          const recent = chance(0.55);
          const today = chance(0.3) ? earlierToday() : null;
          const completed = today ?? (recent
            ? NOW - int(0, 6) * MS_PER_DAY - int(1, 20) * MS_PER_HOUR
            : NOW - int(8, 45) * MS_PER_DAY);
          const cycle = int(4, 240) * MS_PER_HOUR;
          completedAt = completed;
          startedAt = completed - cycle;
          if (startedAt < createdAt) startedAt = createdAt + MS_PER_HOUR;
          if (completedAt < startedAt) completedAt = startedAt + 4 * MS_PER_HOUR;
        }

        if (plan.status === 'in_progress' || plan.status === 'in_review' || plan.status === 'blocked') {
          if (startedAt === null) startedAt = createdAt + int(4, 72) * MS_PER_HOUR;
          if (chance(0.25)) startedAt = NOW - int(11, 30) * MS_PER_DAY;
          if (startedAt > NOW) startedAt = NOW - MS_PER_DAY;
        }

        let dueAt: number | null = null;
        if (chance(0.62)) {
          if (chance(0.25)) dueAt = NOW - int(1, 20) * MS_PER_DAY;
          else if (chance(0.25)) dueAt = earlierToday() ?? NOW - int(1, 20) * MS_PER_DAY;
          else if (chance(0.4)) dueAt = NOW + int(0, 3) * MS_PER_DAY + int(1, 20) * MS_PER_HOUR;
          else dueAt = NOW + int(4, 40) * MS_PER_DAY;
        }

        const updatedAt = Math.max(createdAt, completedAt ?? 0, startedAt ?? 0, cursor);

        insertTicket.run({
          id: tid,
          key,
          project_id: pid,
          title: `${pick(TITLE_VERBS)} ${pick(TITLE_SUBJECTS)}`,
          description: chance(0.75)
            ? `Reported by the ${pick(['on-call', 'support', 'QA', 'platform', 'growth'])} team. ${pick(COMMENT_BODIES)}`
            : null,
          status: plan.status,
          priority,
          assignee_id: assigneeId,
          reporter_id: reporterId,
          estimate: chance(0.65) ? pick([1, 2, 3, 5, 8, 13]) : null,
          due_at: dueAt,
          parent_id: null,
          rank: initialRank(createdTickets.filter((t) => t.status === plan.status).length),
          version: int(0, 4),
          created_at: createdAt,
          updated_at: Math.min(updatedAt, NOW),
          started_at: startedAt,
          completed_at: completedAt,
        });

        for (const [from, to, actor, at] of pendingHistory) {
          historyCounter += 1;
          insertHistory.run(id('sth', historyCounter), tid, from, to, actor, at);
          if (from !== null) {
            activityCounter += 1;
            insertActivity.run(
              id('act', activityCounter), tid, pid, actor, 'status_changed', 'status', from, to, at,
            );
          }
        }

        const labelCount = int(0, 3);
        const used = new Set<string>();
        for (let l = 0; l < labelCount; l += 1) {
          const label = pick(LABELS);
          if (used.has(label)) continue;
          used.add(label);
          insertLabel.run(tid, label);
        }

        const commentCount = int(0, 4);
        for (let c = 0; c < commentCount; c += 1) {
          commentCounter += 1;
          const at = Math.min(createdAt + int(1, 400) * MS_PER_HOUR, NOW - MS_PER_HOUR);
          insertComment.run(id('cmt', commentCounter), tid, pick(userIds), pick(COMMENT_BODIES), at);
          activityCounter += 1;
          insertActivity.run(
            id('act', activityCounter), tid, pid, pick(userIds), 'comment_added', null, null, null, at,
          );
        }

        activityCounter += 1;
        insertActivity.run(
          id('act', activityCounter), tid, pid, reporterId, 'ticket_created', null, null, key, createdAt,
        );

        createdTickets.push({ id: tid, status: plan.status, created_at: createdAt });
      }
    }

    insertCounter.run(pid, number + 1);

    const subtaskCandidates = createdTickets.filter(() => chance(0.15));
    const setParent = db.prepare('UPDATE tickets SET parent_id = ? WHERE id = ?');
    for (const candidate of subtaskCandidates) {
      const parent = pick(createdTickets);
      if (parent.id === candidate.id) continue;
      setParent.run(parent.id, candidate.id);
    }
  });

  const counts = db
    .prepare<[], { status: string; n: number }>('SELECT status, COUNT(*) AS n FROM tickets GROUP BY status')
    .all();

  logger.info(
    {
      users: USERS.length,
      projects: PROJECTS.length,
      tickets: ticketCounter,
      comments: commentCounter,
      activity: activityCounter,
      status_history: historyCounter,
      counts,
    },
    'seed complete',
  );
}

const run = getDb().transaction(seed);
run();
closeDb();
