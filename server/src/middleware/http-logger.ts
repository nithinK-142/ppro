import { pinoHttp } from 'pino-http';
import logger from '../logging/logger.ts';

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as typeof req & { requestId: string }).requestId,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customProps: (req) => ({ requestId: (req as typeof req & { requestId: string }).requestId }),
  quietReqLogger: true
});

export default httpLogger;
