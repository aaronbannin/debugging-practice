import { Router } from 'express';
import { listQuerySchema } from '@dp/shared';
import { exportTickets } from '../services/exportService.js';
import { asyncRoute } from '../lib/middleware.js';

export const exportRouter = Router();

exportRouter.get(
  '/tickets.csv',
  asyncRoute((req, res) => {
    const query = listQuerySchema.parse(req.query);
    const csv = exportTickets(query);
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="tickets.csv"');
    res.send(csv);
  }),
);
