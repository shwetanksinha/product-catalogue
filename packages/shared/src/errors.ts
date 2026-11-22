export type ApiErrorCode =
  'VALIDATION_ERROR' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE' | 'EMAIL_DELIVERY_FAILED' | 'INTERNAL_ERROR';

/** Every non-2xx API response uses this envelope. */
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Field-level messages for VALIDATION_ERROR, keyed by field path */
    fields?: Record<string, string>;
  };
}
