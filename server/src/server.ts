import app from './app.ts';
import env from './config/env.ts';
import { closeDatabase } from './config/db.ts';
import logger from './utils/logger.ts';

const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info({ port: env.PORT }, 'api listening');
});

let shuttingDown = false;

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  server.close(() => {
    clearTimeout(forceExit);
    closeDatabase();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
