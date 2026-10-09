export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const notFound = (what: string, id: string) =>
  new AppError(404, 'not_found', `${what} ${id} was not found`);

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'bad_request', message, details);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, 'conflict', message, details);

export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, 'unprocessable', message, details);

export class InvariantError extends Error {
  readonly invariant: string;
  readonly context: Record<string, unknown>;

  constructor(invariant: string, message: string, context: Record<string, unknown>) {
    super(message);
    this.name = 'InvariantError';
    this.invariant = invariant;
    this.context = context;
  }
}
