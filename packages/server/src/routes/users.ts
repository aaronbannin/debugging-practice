import { Router } from 'express';
import { findUser, listUsers } from '../services/repo.js';
import { asyncRoute, param } from '../lib/middleware.js';
import { notFound } from '../lib/errors.js';

export const usersRouter = Router();

usersRouter.get(
  '/',
  asyncRoute((_req, res) => {
    res.json(listUsers());
  }),
);

usersRouter.get(
  '/:id',
  asyncRoute((req, res) => {
    const user = findUser(param(req, 'id'));
    if (!user) throw notFound('user', param(req, 'id'));
    res.json(user);
  }),
);
