const app = require('./app');
const env = require('./config/env');
const { closeDatabase } = require('./db');
const logger = require('./logging/logger');

require('./db/seed');

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'api listening');
});

let shuttingDown = false;

function shutdown(signal) {
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
