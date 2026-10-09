import { Router } from 'express';
import {
  createTicketSchema,
  listQuerySchema,
  moveSchema,
  transitionSchema,
  updateTicketSchema,
} from '@dp/shared';
import {
  createTicket,
  deleteTicket,
  getTicket,
  listTickets,
  moveTicket,
  transitionTicket,
  updateTicket,
} from '../services/ticketService.js';
import { asyncRoute, param } from '../lib/middleware.js';
import { setActor } from '../lib/requestContext.js';
import { badRequest } from '../lib/errors.js';

export const ticketsRouter = Router();

ticketsRouter.get(
  '/',
  asyncRoute((req, res) => {
    const query = listQuerySchema.parse(req.query);
    res.json(listTickets(query));
  }),
);

ticketsRouter.post(
  '/',
  asyncRoute((req, res) => {
    const input = createTicketSchema.parse(req.body);
    setActor(input.reporter_id);
    res.status(201).json(createTicket(input));
  }),
);

ticketsRouter.get(
  '/:id',
  asyncRoute((req, res) => {
    res.json(getTicket(param(req, 'id')));
  }),
);

ticketsRouter.patch(
  '/:id',
  asyncRoute((req, res) => {
    const input = updateTicketSchema.parse(req.body);
    setActor(input.actor_id);
    res.json(updateTicket(param(req, 'id'), input));
  }),
);

ticketsRouter.post(
  '/:id/transition',
  asyncRoute((req, res) => {
    const input = transitionSchema.parse(req.body);
    setActor(input.actor_id);
    res.json(transitionTicket(param(req, 'id'), input));
  }),
);

ticketsRouter.post(
  '/:id/move',
  asyncRoute((req, res) => {
    const input = moveSchema.parse(req.body);
    setActor(input.actor_id);
    if (input.before_id && input.before_id === input.after_id) {
      throw badRequest('before_id and after_id must differ');
    }
    res.json(moveTicket(param(req, 'id'), input));
  }),
);

ticketsRouter.delete(
  '/:id',
  asyncRoute((req, res) => {
    const actorId = String(req.query.actor_id ?? '');
    if (!actorId) throw badRequest('actor_id query parameter is required');
    setActor(actorId);
    deleteTicket(param(req, 'id'), actorId);
    res.status(204).end();
  }),
);
