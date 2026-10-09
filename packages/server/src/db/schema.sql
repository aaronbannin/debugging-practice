PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  avatar_color  TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  key          TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS project_counters (
  project_id   TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  next_number  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wip_limits (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  max_count   INTEGER NOT NULL,
  PRIMARY KEY (project_id, status)
);

CREATE TABLE IF NOT EXISTS tickets (
  id            TEXT PRIMARY KEY,
  key           TEXT NOT NULL UNIQUE,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL,
  priority      TEXT NOT NULL,
  assignee_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  reporter_id   TEXT NOT NULL REFERENCES users(id),
  estimate      INTEGER,
  due_at        INTEGER,
  parent_id     TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  rank          REAL NOT NULL,
  version       INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  started_at    INTEGER,
  completed_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tickets_project_status ON tickets(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_rank ON tickets(project_id, status, rank);
CREATE INDEX IF NOT EXISTS idx_tickets_updated ON tickets(updated_at);

CREATE TABLE IF NOT EXISTS ticket_labels (
  ticket_id  TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  PRIMARY KEY (ticket_id, label)
);

CREATE INDEX IF NOT EXISTS idx_ticket_labels_label ON ticket_labels(label);

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_ticket ON comments(ticket_id, created_at);

CREATE TABLE IF NOT EXISTS status_history (
  id           TEXT PRIMARY KEY,
  ticket_id    TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_status  TEXT,
  to_status    TEXT NOT NULL,
  actor_id     TEXT REFERENCES users(id),
  changed_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_status_history_ticket ON status_history(ticket_id, changed_at);

CREATE TABLE IF NOT EXISTS activity (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
  actor_id    TEXT REFERENCES users(id),
  action      TEXT NOT NULL,
  field       TEXT,
  from_value  TEXT,
  to_value    TEXT,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_ticket ON activity(ticket_id, created_at DESC);
