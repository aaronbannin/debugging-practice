import { Router } from 'express';
import { createCommentSchema } from '@dp/shared';
import { addComment, deleteComment, getComments } from '../services/commentService.js';
import { asyncRoute, param } from '../lib/middleware.js';
import { setActor } from '../lib/requestContext.js';
import { badRequest } from '../lib/errors.js';

export const commentsRouter = Router({ mergeParams: true });

commentsRouter.get(
  '/:id/comments',
  asyncRoute((req, res) => {
    res.json(getComments(param(req, 'id')));
  }),
);

commentsRouter.post(
  '/:id/comments',
  asyncRoute((req, res) => {
    const input = createCommentSchema.parse(req.body);
    setActor(input.author_id);
    res.status(201).json(addComment(param(req, 'id'), input.author_id, input.body));
  }),
);

commentsRouter.delete(
  '/comments/:commentId',
  asyncRoute((req, res) => {
    const actorId = String(req.query.actor_id ?? '');
    if (!actorId) throw badRequest('actor_id query parameter is required');
    setActor(actorId);
    deleteComment(param(req, 'commentId'), actorId);
    res.status(204).end();
  }),
);
