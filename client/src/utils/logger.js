const levelOrder = {
  silent: 99,
  error: 40,
  warn: 30,
  info: 20,
  debug: 10
};

const configuredLevel = String(
  process.env.EXPO_PUBLIC_LOG_LEVEL || (__DEV__ ? 'debug' : 'error')
).toLowerCase();
const threshold = levelOrder[configuredLevel] ?? levelOrder.error;

function write(level, event, fields = {}) {
  if ((levelOrder[level] ?? 99) < threshold) return;

  const payload = {
    time: new Date().toISOString(),
    level,
    event,
    ...fields
  };

  const output = JSON.stringify(payload);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

export const logger = {
  debug: (event, fields) => write('debug', event, fields),
  info: (event, fields) => write('info', event, fields),
  warn: (event, fields) => write('warn', event, fields),
  error: (event, fields) => write('error', event, fields)
};
