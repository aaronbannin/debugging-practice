import { Router } from 'express';
import { getBoard } from '../services/boardService.js';
import { asyncRoute } from '../lib/middleware.js';
import { badRequest } from '../lib/errors.js';

export const boardRouter = Router();

boardRouter.get(
  '/',
  asyncRoute((req, res) => {
    const projectId = req.query.project_id ? String(req.query.project_id) : '';
    if (!projectId) throw badRequest('project_id query parameter is required');
    res.json(
      getBoard({
        project_id: projectId,
        assignee_id: req.query.assignee_id ? String(req.query.assignee_id) : undefined,
        label: req.query.label ? String(req.query.label) : undefined,
        q: req.query.q ? String(req.query.q) : undefined,
      }),
    );
  }),
);
