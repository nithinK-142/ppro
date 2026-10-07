type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';
type LogFields = Record<string, unknown>;

const levelOrder: Record<LogLevel, number> = {
  silent: 99,
  error: 40,
  warn: 30,
  info: 20,
  debug: 10
};

const configuredLevel = String(
  process.env.EXPO_PUBLIC_LOG_LEVEL || (__DEV__ ? 'debug' : 'error')
).toLowerCase();
const threshold = Object.hasOwn(levelOrder, configuredLevel)
  ? levelOrder[configuredLevel as LogLevel]
  : levelOrder.error;

function write(level: Exclude<LogLevel, 'silent'>, event: string, fields: LogFields = {}) {
  if (levelOrder[level] < threshold) return;

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
  debug: (event: string, fields?: LogFields) => write('debug', event, fields),
  info: (event: string, fields?: LogFields) => write('info', event, fields),
  warn: (event: string, fields?: LogFields) => write('warn', event, fields),
  error: (event: string, fields?: LogFields) => write('error', event, fields)
};
