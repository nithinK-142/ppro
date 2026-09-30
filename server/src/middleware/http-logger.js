const pinoHttp = require('pino-http');
const logger = require('../logging/logger');

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.requestId,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customProps: (req) => ({
    requestId: req.requestId
  }),
  quietReqLogger: true
});

module.exports = httpLogger;
