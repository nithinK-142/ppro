import app from './app.ts';
import env from './config/env.ts';
import { closeDatabase } from './config/db.ts';
import { seedTasks } from './config/seed.ts';
import logger from './utils/logger.ts';

async function start() {
  await seedTasks();

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info({ port: env.PORT }, 'api listening');
  });

  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');

    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();

    server.close(async () => {
      clearTimeout(forceExit);
      await closeDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void start().catch((error) => {
  logger.error({ err: error }, 'failed to start api');
  process.exit(1);
});
