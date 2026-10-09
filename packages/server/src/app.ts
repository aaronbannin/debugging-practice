import express from 'express';
import cors from 'cors';
import { getDb } from './db/index.js';
import {
  errorHandler,
  notFoundHandler,
  requestContextMiddleware,
  requestLogger,
} from './lib/middleware.js';
import { ticketsRouter } from './routes/tickets.js';
import { commentsRouter } from './routes/comments.js';
import { projectsRouter } from './routes/projects.js';
import { usersRouter } from './routes/users.js';
import { boardRouter } from './routes/board.js';
import { statsRouter } from './routes/stats.js';
import { activityRouter } from './routes/activity.js';
import { bulkRouter } from './routes/bulkRoutes.js';
import { exportRouter } from './routes/exportRoutes.js';
import { clientErrorsRouter } from './routes/clientErrors.js';

export function createApp() {
  getDb();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(requestContextMiddleware);
  app.use(requestLogger);

  app.use('/api/tickets', ticketsRouter);
  app.use('/api/tickets', commentsRouter);
  app.use('/api', commentsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/board', boardRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/activity', activityRouter);
  app.use('/api/bulk', bulkRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/client-errors', clientErrorsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
