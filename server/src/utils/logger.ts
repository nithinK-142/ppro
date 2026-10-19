import pino from 'pino';
import env from '../config/env.ts';

const logger = pino({
  level: env.OBSERVABILITY_ENABLED ? env.LOG_LEVEL : 'silent',
  base: {
    service: 'padosipro-api'
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie'
    ],
    censor: '[REDACTED]'
  }
});

export default logger;
