const app = require('./app');
const env = require('./config/env');
const { closeDatabase } = require('./db');

require('./db/seed');

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal}: shutting down`);

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
