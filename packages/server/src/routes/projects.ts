import { Router } from 'express';
import { BOARD_COLUMNS } from '@dp/shared';
import { findProject, listProjects } from '../services/repo.js';
import { countInStatus, wipLimitFor } from '../services/transitions.js';
import { asyncRoute, param } from '../lib/middleware.js';
import { notFound } from '../lib/errors.js';

export const projectsRouter = Router();

projectsRouter.get(
  '/',
  asyncRoute((_req, res) => {
    res.json(listProjects());
  }),
);

projectsRouter.get(
  '/:id',
  asyncRoute((req, res) => {
    const project = findProject(param(req, 'id'));
    if (!project) throw notFound('project', param(req, 'id'));
    res.json({
      ...project,
      wip: BOARD_COLUMNS.map((status) => ({
        status,
        limit: wipLimitFor(project.id, status),
        current: countInStatus(project.id, status),
      })),
    });
  }),
);
