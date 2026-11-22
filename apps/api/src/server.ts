import pino from 'pino';
import { buildApp } from './app';
import { loadConfig } from './config';
import { createServices } from './container';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = pino({ level: config.logLevel });
  const services = await createServices(config, logger);
  const app = await buildApp(services, { logger, trustProxy: config.trustProxy });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: config.host, port: config.port });
  app.log.info(
    { emailProvider: config.email.provider, productSource: config.fakeStore.baseUrl },
    'API ready',
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
