# TaskFlow

A small but complete task-management app — Express API plus a React SPA,
sharing types and validation through a `shared` workspace package.

It is here to be debugged. Use it like a normal app, read the logs, and
find out where it disagrees with itself.

## Requirements

- Node 20 or newer (built and tested on Node 22)
- npm 10 or newer

No external services. Data lives in a local SQLite file.

## Getting started

```bash
npm install
npm run seed
npm run dev
```

- API: <http://localhost:4000>
- Web: <http://localhost:5173>

The Vite dev server proxies `/api` to the API, so open the web URL and
everything just works.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API and web dev server together |
| `npm run dev:server` / `npm run dev:web` | just one of them |
| `npm run seed` | populate a fresh database (deterministic) |
| `npm run reset` | delete the database and reseed |
| `npm run simulate` | drive the API like a roomful of users |
| `npm run logs` | tail `logs/app.log`, pretty-printed |
| `npm test` | Vitest suite over the shared pure utilities |
| `npm run typecheck` | `tsc --noEmit` across all three packages |
| `npm run build` | production build of the web app |
| `npm run hint <1-5> <1-3>` | graduated hint for one defect (all levels include repro steps) |
| `npm run solutions` | the full answer key |

## What the app does

**Projects, users, tickets, comments, activity.** Three seeded projects
with their own ticket keys (`OPS-142`), six users, ~84 tickets carrying
sixty days of backdated status history, comments and audit entries.

**Tickets** have a title, description, status, priority, assignee,
reporter, labels, estimate, due date, an optional parent/subtask link, a
board rank, and a `version` for optimistic concurrency. Saving with a
stale `version` gets you a 409.

**Status machine.** Seven statuses with an explicit transition table
(`ALLOWED_TRANSITIONS` in the shared package) and per-column WIP limits.
Illegal moves are rejected with 422, over-limit moves with 409.

**Board** (`/`) — drag cards within a column to reorder, or across
columns to change status. Ordering uses fractional ranks, so a reorder
writes one row rather than renumbering the column. Select cards with the
checkboxes for a bulk status change.

**List** (`/list`) — full-text search over title, key and description;
filter by status, priority, assignee, label, overdue and unassigned;
sort by any of eight fields in either direction; paginate at 10/25/50/100
per page. Bulk assign and bulk label from the selection bar. "Export CSV"
hands the same query to the export endpoint.

**Ticket detail** (`/tickets/:id`) — edit fields, move through the status
machine, reassign, comment, and read the per-ticket history.

**Dashboard** (`/dashboard`) — counts by status, average and median cycle
time, throughput over a configurable window, overdue / due-soon /
unassigned / stale-in-progress buckets, and per-person workload.

**Activity** (`/activity`) — the audit feed, filterable by person,
polling every ten seconds.

## Logging

Logging is the point, so it gets real attention.

Everything goes to `logs/app.log` as newline-delimited JSON and to the
console pretty-printed. Tail it with:

```bash
npm run logs
```

What lands there:

- **Every request** — method, path, status, duration, and a correlation
  id that is also returned in the `x-request-id` response header. 5xx
  logs at `error`, 4xx at `warn`, everything else at `info`.
- **Every mutation** — entity, action, field, actor.
- **Every unhandled error** — stack trace with the request context,
  body and query attached.
- **Invariant checks.** The service layer is sprinkled with assertions
  about things that should always be true — the way an app reports to
  Sentry. When one fails it logs at `error` (`invariant violated: …`) or
  `warn` (`anomaly detected: …`) with the relevant numbers attached, and
  the request carries on. `GET /api/stats/health` returns a running tally
  of which ones have tripped.
- **Client-side errors.** The React error boundary and the global
  `error` / `unhandledrejection` handlers POST to `/api/client-errors`,
  which logs them server-side.

Useful one-liners:

```bash
grep -E '"level":"(warn|error)"' logs/app.log | tail -40
grep '"invariant"' logs/app.log | tail -20
grep '<request-id>' logs/app.log
curl -s localhost:4000/api/stats/health | python3 -m json.tool
```

## Generating traffic

```bash
npm run simulate                                # ~90s at ~6 actions/s
npm run simulate -- --duration 300 --rps 12     # longer and busier
npm run simulate -- --seed 42                   # reproducible run
```

It creates tickets, transitions them, reassigns, comments, reorders
cards, runs bulk edits, paginates, exports, and loads the dashboard and
the activity feed — against the same API the browser uses. It prints a
per-action summary at the end; the interesting detail is in
`logs/app.log`.

Some 4xx responses during a run are expected: the simulator deliberately
attempts illegal status transitions and over-limit moves, and the API
correctly rejects them.

## Layout

```
packages/shared/   types, zod schemas, status machine, date + rank utils
packages/server/   express app
  src/routes/      http layer
  src/services/    domain logic
  src/lib/         logger, errors, invariants, request context, pagination
  src/db/          schema.sql, seed
  test/            vitest suite
packages/web/      react + vite spa
tools/             traffic simulator, hint + solutions scripts
logs/              app.log (gitignored)
hints/             encrypted hints
```

The API surface, if you want to poke at it directly:

```
GET    /api/projects            GET  /api/projects/:id
GET    /api/users               GET  /api/users/:id
GET    /api/board?project_id=
GET    /api/tickets             POST /api/tickets
GET    /api/tickets/:id         PATCH /api/tickets/:id    DELETE /api/tickets/:id
POST   /api/tickets/:id/transition
POST   /api/tickets/:id/move
GET    /api/tickets/:id/comments   POST /api/tickets/:id/comments
POST   /api/bulk/status | /api/bulk/assign | /api/bulk/label
GET    /api/activity
GET    /api/stats/dashboard     GET /api/stats/due-soon    GET /api/stats/health
GET    /api/export/tickets.csv
POST   /api/client-errors
```

## If you get stuck

The answer key and the hints are encrypted so you cannot spoil yourself
by accident. The passphrase is `debug-me`.

```bash
npm run hint            # usage, and nothing else
npm run hint 3 1        # defect 3, symptom + how to reproduce it
npm run hint 3 2        # defect 3, which subsystem to look at
npm run hint 3 3        # defect 3, root cause and file
npm run solutions       # everything, all five
```

Every level includes step-by-step reproduction instructions — the exact
clicks, or a `curl` you can paste — so you can watch the defect happen
before you go looking for it. Level 1 stops there and says nothing about
the cause.

Each hint is a separately encrypted blob, so getting unstuck on one
never reveals anything about the others. `npm run solutions` is the
deliberate, obvious escape hatch.

Override the passphrase with `DP_PASSPHRASE` if you re-encrypt anything.

## Notes

`npm test` and `npm run typecheck` both pass as shipped. That is ordinary
repo hygiene and says nothing about whether the app is correct.
