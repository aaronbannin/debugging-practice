import { Router } from 'express';
import { activityFeed } from '../services/activityService.js';
import { findProject } from '../services/repo.js';
import { asyncRoute } from '../lib/middleware.js';
import { notFound } from '../lib/errors.js';

export const activityRouter = Router();

activityRouter.get(
  '/',
  asyncRoute((req, res) => {
    let projectId: string | undefined;
    if (req.query.project_id) {
      const project = findProject(String(req.query.project_id));
      if (!project) throw notFound('project', String(req.query.project_id));
      projectId = project.id;
    }
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : 50;
    const beforeRaw = Number(req.query.before);
    res.json(
      activityFeed({
        project_id: projectId,
        ticket_id: req.query.ticket_id ? String(req.query.ticket_id) : undefined,
        actor_id: req.query.actor_id ? String(req.query.actor_id) : undefined,
        before: Number.isFinite(beforeRaw) && req.query.before ? beforeRaw : undefined,
        limit,
      }),
    );
  }),
);
