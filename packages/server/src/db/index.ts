import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { dataDir, dbFile, schemaFile } from '../lib/paths.js';
import { logger } from '../lib/logger.js';

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (instance) return instance;
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  const schema = fs.readFileSync(schemaFile, 'utf8');
  db.exec(schema);
  instance = db;
  logger.info({ dbFile }, 'database ready');
  return db;
}

export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}

export function resetDb(): void {
  const db = getDb();
  db.exec(`
    DELETE FROM activity;
    DELETE FROM status_history;
    DELETE FROM comments;
    DELETE FROM ticket_labels;
    DELETE FROM tickets;
    DELETE FROM wip_limits;
    DELETE FROM project_counters;
    DELETE FROM projects;
    DELETE FROM users;
  `);
}
