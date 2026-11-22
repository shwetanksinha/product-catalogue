import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import type { ApiErrorBody } from '@catalogue/shared';
import { AppError, ValidationError } from './shared/errors';
import type { CatalogueService } from './modules/catalogue/CatalogueService';
import { catalogueRoutes } from './modules/catalogue/routes';
import type { EnquiryService } from './modules/enquiry/EnquiryService';
import { enquiryRoutes } from './modules/enquiry/routes';

export interface AppServices {
  catalogue: CatalogueService;
  enquiry: EnquiryService;
}

export interface BuildAppOptions {
  /** Omit to disable logging (e.g. in tests). */
  logger?: FastifyBaseLogger;
  trustProxy?: boolean;
}

function errorBody(code: ApiErrorBody['error']['code'], message: string, fields?: Record<string, string>): ApiErrorBody {
  return { error: { code, message, ...(fields ? { fields } : {}) } };
}

/** Builds the HTTP app from already-constructed services, so tests can inject fakes. */
export async function buildApp(services: AppServices, options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    ...(options.logger ? { loggerInstance: options.logger } : { logger: false }),
    trustProxy: options.trustProxy ?? false,
    bodyLimit: 16 * 1024,
  });

  // No CORS plugin on purpose: the web app reaches the API same-origin via a proxy (Vite in dev,
  // nginx in Docker), so cross-origin browser calls stay blocked by default.
  await app.register(helmet);

  // Handlers must be set before routes are registered: plugin contexts inherit them at registration.
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send(errorBody('NOT_FOUND', `Route ${req.method} ${req.url} not found`));
  });

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ValidationError) {
      return reply.code(error.statusCode).send(errorBody(error.code, error.message, error.fields));
    }
    if (error instanceof AppError) {
      if (error.statusCode >= 500) req.log.error({ err: error, cause: error.cause }, error.message);
      return reply.code(error.statusCode).send(errorBody(error.code, error.message));
    }
    // Fastify's own client errors (malformed JSON, body too large, wrong content type...).
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send(errorBody('VALIDATION_ERROR', (error as Error).message));
    }
    req.log.error({ err: error }, 'Unhandled error');
    return reply.code(500).send(errorBody('INTERNAL_ERROR', 'Something went wrong'));
  });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(
    async (api) => {
      await api.register(catalogueRoutes(services.catalogue));
      await api.register(enquiryRoutes(services.enquiry));
    },
    { prefix: '/api' },
  );

  return app;
}
