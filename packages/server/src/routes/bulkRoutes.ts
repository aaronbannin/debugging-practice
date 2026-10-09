import { Router } from 'express';
import { bulkAssignSchema, bulkLabelSchema, bulkStatusSchema } from '@dp/shared';
import { bulkAssign, bulkLabel, bulkStatus } from '../services/bulk.js';
import { asyncRoute } from '../lib/middleware.js';
import { setActor } from '../lib/requestContext.js';

export const bulkRouter = Router();

bulkRouter.post(
  '/status',
  asyncRoute((req, res) => {
    const input = bulkStatusSchema.parse(req.body);
    setActor(input.actor_id);
    res.json(bulkStatus(input));
  }),
);

bulkRouter.post(
  '/assign',
  asyncRoute((req, res) => {
    const input = bulkAssignSchema.parse(req.body);
    setActor(input.actor_id);
    res.json(bulkAssign(input));
  }),
);

bulkRouter.post(
  '/label',
  asyncRoute((req, res) => {
    const input = bulkLabelSchema.parse(req.body);
    setActor(input.actor_id);
    res.json(bulkLabel(input));
  }),
);
