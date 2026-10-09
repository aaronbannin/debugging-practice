import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { logger } from './logger.js';
import { AppError } from './errors.js';
import { runWithContext } from './requestContext.js';

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.header('x-request-id') ?? randomUUID()).slice(0, 64);
  const log = logger.child({ request_id: requestId, method: req.method, path: req.path });
  res.setHeader('x-request-id', requestId);
  (req as Request & { requestId: string }).requestId = requestId;
  runWithContext({ requestId, method: req.method, path: req.path, log }, () => next());
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const started = process.hrtime.bigint();
  const requestId = (req as Request & { requestId?: string }).requestId;
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const payload = {
      event: 'http_request',
      request_id: requestId,
      method: req.method,
      path: req.path,
      route: req.route?.path,
      status: res.statusCode,
      duration_ms: Number(durationMs.toFixed(2)),
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
    };
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`;
    if (res.statusCode >= 500) logger.error(payload, message);
    else if (res.statusCode >= 400) logger.warn(payload, message);
    else logger.info(payload, message);
  });
  next();
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'route_not_found',
      message: `no route for ${req.method} ${req.path}`,
      request_id: (req as Request & { requestId?: string }).requestId,
    },
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req as Request & { requestId?: string }).requestId;
  const log = logger.child({ request_id: requestId, method: req.method, path: req.path });

  if (err instanceof ZodError) {
    log.warn({ event: 'validation_failed', issues: err.issues }, 'request validation failed');
    res.status(400).json({
      error: {
        code: 'validation_failed',
        message: 'request body or query failed validation',
        details: err.issues,
        request_id: requestId,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    const payload = {
      event: 'app_error',
      code: err.code,
      status: err.status,
      details: err.details,
    };
    if (err.status >= 500) log.error({ ...payload, stack: err.stack }, err.message);
    else log.warn(payload, err.message);
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details, request_id: requestId },
    });
    return;
  }

  const error = err instanceof Error ? err : new Error(String(err));
  log.error(
    {
      event: 'unhandled_error',
      err: { name: error.name, message: error.message, stack: error.stack },
      body: req.body,
      query: req.query,
    },
    `unhandled error: ${error.message}`,
  );
  res.status(500).json({
    error: { code: 'internal_error', message: error.message, request_id: requestId },
  });
}

export function asyncRoute<T extends (req: Request, res: Response, next: NextFunction) => unknown>(
  handler: T,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = handler(req, res, next);
      if (result instanceof Promise) result.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

export function param(req: Request, name: string): string {
  const value = (req.params as Record<string, string | string[] | undefined>)[name];
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}
