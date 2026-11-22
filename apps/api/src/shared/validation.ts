import type { ZodError } from 'zod';
import { ValidationError } from './errors';

/** Converts a ZodError into our ValidationError with one message per field. */
export function toValidationError(error: ZodError, message = 'Request is invalid'): ValidationError {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return new ValidationError(message, fields);
}
