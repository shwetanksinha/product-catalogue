import type { ApiErrorCode } from '@catalogue/shared';

/** Base class for errors that map cleanly onto an HTTP response. */
export class AppError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly statusCode: number,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', 404, message);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super('VALIDATION_ERROR', 400, message);
  }
}

/** The product data source failed or returned something we could not understand. */
export class UpstreamError extends AppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('UPSTREAM_UNAVAILABLE', 502, message, options);
  }
}

export class EmailDeliveryError extends AppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('EMAIL_DELIVERY_FAILED', 502, message, options);
  }
}
