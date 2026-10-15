import type { RequestHandler } from 'express';
import { finishSpan, runInSpanContext, startHttpSpan, traceIdOf } from '../observability/tracing.ts';

const httpTracing: RequestHandler = (req, res, next) => {
  if (req.path === '/metrics') {
    next();
    return;
  }

  const span = startHttpSpan(req.method);
  if (!span) {
    next();
    return;
  }

  const traceId = traceIdOf(span);
  if (traceId) res.setHeader('X-Trace-Id', traceId);

  let finished = false;
  res.once('finish', () => {
    finished = true;
    const route = typeof res.locals.observabilityRoute === 'string' ? res.locals.observabilityRoute : 'unmatched';
    if (span) span.name = `${req.method} ${route}`;
    finishSpan(span, {
      'http.route': route,
      'http.response.status_code': res.statusCode
    }, res.statusCode >= 500);
  });
  res.once('close', () => {
    if (finished) return;
    const route = typeof res.locals.observabilityRoute === 'string' ? res.locals.observabilityRoute : 'unmatched';
    if (span) span.name = `${req.method} ${route}`;
    finishSpan(span, { 'http.route': route, 'http.response.status_code': 499 }, true);
  });

  runInSpanContext(span, next);
};

export default httpTracing;
