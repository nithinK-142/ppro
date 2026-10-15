import { performance } from 'node:perf_hooks';
import type { RequestHandler } from 'express';
import { beginRequest, endRequest, recordHttpRequest } from '../observability/metrics.ts';

const httpMetrics: RequestHandler = (req, res, next) => {
  if (req.path === '/metrics') {
    next();
    return;
  }

  const started = performance.now();
  beginRequest();
  let finished = false;
  const releaseRequest = () => {
    if (finished) return;
    finished = true;
    endRequest();
  };

  res.once('finish', () => {
    releaseRequest();
    const route = typeof res.locals.observabilityRoute === 'string' ? res.locals.observabilityRoute : 'unmatched';
    recordHttpRequest(req.method, route, res.statusCode, (performance.now() - started) / 1000);
  });
  res.once('close', releaseRequest);
  next();
};

export default httpMetrics;
