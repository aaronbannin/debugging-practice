import { AsyncLocalStorage } from 'node:async_hooks';
import type { Logger } from './logger.js';
import { logger as rootLogger } from './logger.js';

export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  actorId?: string;
  log: Logger;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

export function contextLogger(): Logger {
  return storage.getStore()?.log ?? rootLogger;
}

export function setActor(actorId: string | null | undefined): void {
  const ctx = storage.getStore();
  if (ctx && actorId) ctx.actorId = actorId;
}
