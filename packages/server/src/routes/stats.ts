import { Router } from 'express';
import { statsQuerySchema } from '@dp/shared';
import { dashboard } from '../services/statsService.js';
import { dueSoonTickets } from '../services/ticketService.js';
import { findProject } from '../services/repo.js';
import { invariantCounts } from '../lib/invariants.js';
import { asyncRoute } from '../lib/middleware.js';
import { notFound } from '../lib/errors.js';

export const statsRouter = Router();

statsRouter.get(
  '/dashboard',
  asyncRoute((req, res) => {
    res.json(dashboard(statsQuerySchema.parse(req.query)));
  }),
);

statsRouter.get(
  '/due-soon',
  asyncRoute((req, res) => {
    let projectId: string | undefined;
    if (req.query.project_id) {
      const project = findProject(String(req.query.project_id));
      if (!project) throw notFound('project', String(req.query.project_id));
      projectId = project.id;
    }
    res.json(dueSoonTickets(projectId, Date.now()));
  }),
);

statsRouter.get(
  '/health',
  asyncRoute((_req, res) => {
    res.json({ ok: true, invariants: invariantCounts(), uptime_s: Math.round(process.uptime()) });
  }),
);
