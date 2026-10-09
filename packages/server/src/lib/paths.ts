import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
export const serverRoot = fileURLToPath(new URL('../../', import.meta.url));
export const logDir = path.join(repoRoot, 'logs');
export const logFile = path.join(logDir, 'app.log');
export const dataDir = path.join(serverRoot, 'data');
export const dbFile = process.env.DP_DB_FILE ?? path.join(dataDir, 'app.db');
export const schemaFile = path.join(serverRoot, 'src', 'db', 'schema.sql');
