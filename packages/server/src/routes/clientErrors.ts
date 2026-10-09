import { Router } from 'express';
import { clientErrorSchema } from '@dp/shared';
import { asyncRoute } from '../lib/middleware.js';
import { contextLogger } from '../lib/requestContext.js';

export const clientErrorsRouter = Router();

clientErrorsRouter.post(
  '/',
  asyncRoute((req, res) => {
    const input = clientErrorSchema.parse(req.body);
    contextLogger().error(
      {
        event: 'client_error',
        component: input.component ?? null,
        url: input.url ?? null,
        stack: input.stack ?? null,
      },
      `client error: ${input.message}`,
    );
    res.status(202).json({ received: true });
  }),
);
