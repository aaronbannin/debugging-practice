import { BOARD_COLUMNS, type BoardView, type Page, type Project, type Ticket, type User } from '@dp/shared';

interface Options {
  base: string;
  durationSeconds: number;
  rps: number;
  seed: number;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    base: process.env.DP_API ?? 'http://localhost:4000',
    durationSeconds: 90,
    rps: 6,
    seed: Date.now() % 100000,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (arg === '--base' && value) opts.base = value;
    if ((arg === '--duration' || arg === '-d') && value) opts.durationSeconds = Number(value);
    if (arg === '--rps' && value) opts.rps = Number(value);
    if (arg === '--seed' && value) opts.seed = Number(value);
  }
  return opts;
}

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

const opts = parseArgs(process.argv.slice(2));
const rand = mulberry32(opts.seed);
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const int = (min: number, max: number): number => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number): boolean => rand() < p;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const stats = {
  requests: 0,
  ok: 0,
  clientError: 0,
  serverError: 0,
  byAction: new Map<string, { ok: number; failed: number }>(),
};

function record(action: string, ok: boolean): void {
  const entry = stats.byAction.get(action) ?? { ok: 0, failed: 0 };
  if (ok) entry.ok += 1;
  else entry.failed += 1;
  stats.byAction.set(action, entry);
}

async function call<T>(
  action: string,
  path: string,
  init?: RequestInit & { raw?: boolean },
): Promise<T | null> {
  stats.requests += 1;
  try {
    const response = await fetch(`${opts.base}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (response.status >= 500) stats.serverError += 1;
    else if (response.status >= 400) stats.clientError += 1;
    else stats.ok += 1;
    record(action, response.ok);
    const text = response.status === 204 ? '' : await response.text();
    if (!response.ok || init?.raw || text === '') return null;
    return JSON.parse(text) as T;
  } catch {
    stats.serverError += 1;
    record(action, false);
    return null;
  }
}

const TITLES = [
  'Retry storm after deploy', 'Slow query on the tickets index', 'Duplicate webhook deliveries',
  'Cache warmer misses cold keys', 'Export truncates long descriptions', 'Pager noise from healthcheck',
  'Backfill job stalls at 80%', 'Session cookie not refreshed', 'Rate limiter rejects valid traffic',
  'Report totals drift overnight',
];
const LABELS = ['backend', 'frontend', 'infra', 'security', 'perf', 'tech-debt', 'oncall', 'flaky'];
const COMMENTS = [
  'Taking a look now.', 'Handing this over, out of time today.', 'Added more detail to the description.',
  'This looks like a duplicate.', 'Confirmed on staging.', 'Needs a decision before we start.',
];

let users: User[] = [];
let projects: Project[] = [];

async function actCreate(): Promise<void> {
  const project = pick(projects);
  const dueRoll = rand();
  const now = Date.now();
  const startOfDay = Math.floor(now / 86_400_000) * 86_400_000;
  let due: number | null = null;
  if (dueRoll < 0.25) due = startOfDay + Math.floor((now - startOfDay) * rand());
  else if (dueRoll < 0.6) due = now + int(1, 21) * 86_400_000;
  await call<Ticket>('create_ticket', '/api/tickets', {
    method: 'POST',
    body: JSON.stringify({
      project_id: project.id,
      title: `${pick(TITLES)} (${int(100, 999)})`,
      description: chance(0.6) ? pick(COMMENTS) : null,
      priority: pick(['p0', 'p1', 'p2', 'p2', 'p3']),
      assignee_id: chance(0.7) ? pick(users).id : null,
      reporter_id: pick(users).id,
      estimate: chance(0.5) ? pick([1, 2, 3, 5, 8]) : null,
      due_at: due,
      labels: chance(0.7) ? [pick(LABELS)] : [],
    }),
  });
}

async function actBrowseList(): Promise<void> {
  const project = pick(projects);
  const params = new URLSearchParams({ project_id: project.id });
  params.set('page_size', String(pick([10, 10, 25, 50])));
  params.set('page', String(int(1, 3)));
  params.set('sort', pick(['updated_at', 'created_at', 'priority', 'due_at', 'key']));
  params.set('dir', pick(['asc', 'desc']));
  if (chance(0.25)) params.set('q', pick(['retry', 'cache', 'index', 'report']));
  if (chance(0.2)) params.set('overdue', 'true');
  if (chance(0.2)) params.set('label', pick(LABELS));
  await call<Page<Ticket>>('list_tickets', `/api/tickets?${params.toString()}`);
}

async function actDashboard(): Promise<void> {
  const project = pick(projects);
  await call('dashboard', `/api/stats/dashboard?project_id=${project.id}&days=${pick([7, 7, 14, 30])}`);
}

async function actActivity(): Promise<void> {
  const project = pick(projects);
  await call('activity', `/api/activity?project_id=${project.id}&limit=${pick([25, 50])}`);
}

async function actExport(): Promise<void> {
  const project = pick(projects);
  await call('export_csv', `/api/export/tickets.csv?project_id=${project.id}`, { raw: true });
}

async function loadBoard(projectId: string): Promise<BoardView | null> {
  return call<BoardView>('board', `/api/board?project_id=${projectId}`);
}

async function actTransition(): Promise<void> {
  const project = pick(projects);
  const board = await loadBoard(project.id);
  if (!board) return;
  const populated = board.columns.filter((column) => column.tickets.length > 0);
  if (populated.length === 0) return;
  const column = pick(populated);
  const ticket = pick(column.tickets);
  const targets = board.columns
    .map((c) => c.status)
    .filter((status) => status !== ticket.status);
  await call<Ticket>('transition', `/api/tickets/${ticket.id}/transition`, {
    method: 'POST',
    body: JSON.stringify({ to: pick(targets), actor_id: pick(users).id }),
  });
}

async function actReorder(): Promise<void> {
  const project = pick(projects);
  const board = await loadBoard(project.id);
  if (!board) return;
  const candidates = board.columns.filter((column) => column.tickets.length >= 3);
  if (candidates.length === 0) return;
  const busiest = candidates.reduce((a, b) => (b.tickets.length > a.tickets.length ? b : a));
  const column = chance(0.7) ? busiest : pick(candidates);
  const tickets = column.tickets;

  const mover = pick(tickets.slice(Math.min(2, tickets.length - 1)));
  const remaining = tickets.filter((t) => t.id !== mover.id);
  if (remaining.length < 2) return;

  const slot = chance(0.75) ? 1 : int(1, Math.max(1, remaining.length - 1));
  const before = remaining[slot - 1] ?? null;
  const after = remaining[slot] ?? null;

  await call<Ticket>('reorder', `/api/tickets/${mover.id}/move`, {
    method: 'POST',
    body: JSON.stringify({
      status: column.status,
      before_id: before?.id ?? null,
      after_id: after?.id ?? null,
      actor_id: pick(users).id,
    }),
  });
}

async function actComment(): Promise<void> {
  const project = pick(projects);
  const page = await call<Page<Ticket>>(
    'list_tickets',
    `/api/tickets?project_id=${project.id}&page_size=25`,
  );
  if (!page || page.items.length === 0) return;
  const ticket = pick(page.items);
  await call('comment', `/api/tickets/${ticket.id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ author_id: pick(users).id, body: pick(COMMENTS) }),
  });
}

async function actReassign(): Promise<void> {
  const project = pick(projects);
  const page = await call<Page<Ticket>>(
    'list_tickets',
    `/api/tickets?project_id=${project.id}&page_size=25`,
  );
  if (!page || page.items.length === 0) return;
  const ticket = pick(page.items);
  await call('update_ticket', `/api/tickets/${ticket.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      assignee_id: chance(0.85) ? pick(users).id : null,
      version: ticket.version,
      actor_id: pick(users).id,
    }),
  });
}

async function actBulk(): Promise<void> {
  const project = pick(projects);
  const page = await call<Page<Ticket>>(
    'list_tickets',
    `/api/tickets?project_id=${project.id}&page_size=25`,
  );
  if (!page || page.items.length < 3) return;
  const ids = page.items.slice(0, int(2, 5)).map((t) => t.id);
  const roll = rand();
  if (roll < 0.4) {
    await call('bulk_assign', '/api/bulk/assign', {
      method: 'POST',
      body: JSON.stringify({ ticket_ids: ids, assignee_id: pick(users).id, actor_id: pick(users).id }),
    });
  } else if (roll < 0.8) {
    await call('bulk_label', '/api/bulk/label', {
      method: 'POST',
      body: JSON.stringify({ ticket_ids: ids, add: [pick(LABELS)], remove: [], actor_id: pick(users).id }),
    });
  } else {
    await call('bulk_status', '/api/bulk/status', {
      method: 'POST',
      body: JSON.stringify({ ticket_ids: ids, to: pick(BOARD_COLUMNS), actor_id: pick(users).id }),
    });
  }
}

const ACTIONS: Array<{ weight: number; run: () => Promise<void> }> = [
  { weight: 16, run: actReorder },
  { weight: 10, run: actBrowseList },
  { weight: 9, run: actTransition },
  { weight: 7, run: actDashboard },
  { weight: 6, run: actComment },
  { weight: 5, run: actReassign },
  { weight: 4, run: actCreate },
  { weight: 4, run: actActivity },
  { weight: 3, run: actBulk },
  { weight: 1, run: actExport },
];

const TOTAL_WEIGHT = ACTIONS.reduce((sum, action) => sum + action.weight, 0);

function nextAction(): () => Promise<void> {
  let roll = rand() * TOTAL_WEIGHT;
  for (const action of ACTIONS) {
    roll -= action.weight;
    if (roll <= 0) return action.run;
  }
  return ACTIONS[0].run;
}

async function main(): Promise<void> {
  const loadedUsers = await call<User[]>('bootstrap', '/api/users');
  const loadedProjects = await call<Project[]>('bootstrap', '/api/projects');
  if (!loadedUsers || !loadedProjects || loadedProjects.length === 0) {
    console.error(`could not reach the API at ${opts.base} — is "npm run dev" running?`);
    process.exit(1);
  }
  users = loadedUsers;
  projects = loadedProjects;

  const endAt = Date.now() + opts.durationSeconds * 1000;
  const interval = 1000 / Math.max(opts.rps, 0.1);

  console.log(
    `simulating ~${opts.rps} actions/s against ${opts.base} for ${opts.durationSeconds}s (seed ${opts.seed})`,
  );

  let tick = 0;
  while (Date.now() < endAt) {
    const started = Date.now();
    await nextAction()();
    tick += 1;
    if (tick % 25 === 0) {
      process.stdout.write(
        `\r  ${tick} actions · ${stats.requests} requests · ${stats.clientError} 4xx · ${stats.serverError} 5xx   `,
      );
    }
    const elapsed = Date.now() - started;
    if (elapsed < interval) await sleep(interval - elapsed);
  }

  process.stdout.write('\n');
  console.log('--- simulation summary ---');
  console.log(`actions        ${tick}`);
  console.log(`requests       ${stats.requests}`);
  console.log(`2xx            ${stats.ok}`);
  console.log(`4xx            ${stats.clientError}`);
  console.log(`5xx            ${stats.serverError}`);
  console.log('');
  console.log('per action:');
  for (const [action, counts] of [...stats.byAction.entries()].sort()) {
    console.log(`  ${action.padEnd(16)} ok=${String(counts.ok).padEnd(5)} failed=${counts.failed}`);
  }
  console.log('');
  console.log('server-side detail is in logs/app.log');
}

void main();
