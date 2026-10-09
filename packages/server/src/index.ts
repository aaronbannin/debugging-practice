import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { closeDb } from './db/index.js';

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

const server = app.listen(port, () => {
  logger.info({ port, env: process.env.NODE_ENV ?? 'development' }, `api listening on :${port}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(
      { event: 'listen_failed', port, code: err.code },
      `port ${port} is already in use — another server (often a stray "npm run dev") is still running`,
    );
  } else {
    logger.error({ event: 'listen_failed', port, err: { message: err.message, stack: err.stack } }, err.message);
  }
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 1000).unref();
});

let shuttingDown = false;

const shutdown = (signal: string) => {
  if (shuttingDown) {
    process.exit(0);
  }
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');

  const done = () => {
    closeDb();
    process.exit(0);
  };

  const forced = setTimeout(() => {
    logger.warn({ signal }, 'shutdown timed out, exiting anyway');
    done();
  }, 2000);
  forced.unref();

  server.closeAllConnections?.();
  server.close(done);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  logger.error(
    { event: 'uncaught_exception', err: { message: err.message, stack: err.stack } },
    err.message,
  );
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error({ event: 'unhandled_rejection', reason: String(reason) }, 'unhandled promise rejection');
});
