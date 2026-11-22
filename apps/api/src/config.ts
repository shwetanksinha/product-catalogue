import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

const envSchema = z
  .object({
    // Loopback by default so a dev server is not exposed to the network; Docker sets 0.0.0.0.
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    TRUST_PROXY: booleanString.default(false),

    FAKESTORE_BASE_URL: z.url().default('https://fakestoreapi.com'),
    UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(300),

    FEATURED_PRODUCTS_FILE: z.string().min(1).default('config/featured-products.json'),
    CATEGORY_TOP_RATED_LIMIT: z.coerce.number().int().min(1).max(20).default(3),

    EMAIL_PROVIDER: z.enum(['smtp', 'console']).default('console'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_SECURE: booleanString.default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().min(1).default('Product Catalogue <no-reply@catalogue.local>'),
    SALES_INBOX_EMAIL: z.email().default('sales@catalogue.local'),
    PUBLIC_WEB_URL: z.url().default('http://localhost:8080'),
  })
  .refine((env) => env.EMAIL_PROVIDER !== 'smtp' || !!env.SMTP_HOST, {
    message: 'SMTP_HOST is required when EMAIL_PROVIDER=smtp',
    path: ['SMTP_HOST'],
  });

export interface AppConfig {
  host: string;
  port: number;
  logLevel: string;
  trustProxy: boolean;
  fakeStore: { baseUrl: string; timeoutMs: number };
  cacheTtlSeconds: number;
  featuredProductsFile: string;
  categoryTopRatedLimit: number;
  email: {
    provider: 'smtp' | 'console';
    smtp: { host: string; port: number; secure: boolean; user?: string; pass?: string };
    from: string;
    salesInbox: string;
  };
  publicWebUrl: string;
}

/** Parses and validates environment variables once at startup so misconfiguration fails fast. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // Treat empty strings (e.g. `SMTP_USER=` in an env file) as unset.
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${details}`);
  }
  const e = result.data;
  return {
    host: e.HOST,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    trustProxy: e.TRUST_PROXY,
    fakeStore: { baseUrl: e.FAKESTORE_BASE_URL.replace(/\/+$/, ''), timeoutMs: e.UPSTREAM_TIMEOUT_MS },
    cacheTtlSeconds: e.CACHE_TTL_SECONDS,
    featuredProductsFile: e.FEATURED_PRODUCTS_FILE,
    categoryTopRatedLimit: e.CATEGORY_TOP_RATED_LIMIT,
    email: {
      provider: e.EMAIL_PROVIDER,
      smtp: {
        host: e.SMTP_HOST ?? '',
        port: e.SMTP_PORT,
        secure: e.SMTP_SECURE,
        ...(e.SMTP_USER ? { user: e.SMTP_USER } : {}),
        ...(e.SMTP_PASS ? { pass: e.SMTP_PASS } : {}),
      },
      from: e.MAIL_FROM,
      salesInbox: e.SALES_INBOX_EMAIL,
    },
    publicWebUrl: e.PUBLIC_WEB_URL.replace(/\/+$/, ''),
  };
}
