import { ApiError } from '../api/client';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p role="status" className="status">
      {label}
    </p>
  );
}

export function ErrorState({ error, notFoundMessage }: { error: unknown; notFoundMessage?: string }) {
  const notFound = error instanceof ApiError && error.status === 404;
  const message = notFound
    ? (notFoundMessage ?? 'We could not find what you were looking for.')
    : error instanceof ApiError
      ? error.message
      : 'Something went wrong. Please try again.';
  return (
    <div role="alert" className="status status--error">
      {message}
    </div>
  );
}
