import type { RequestHandler } from 'express';

const captureRoute: RequestHandler = (req, res, next) => {
  const routePath = req.route?.path;
  const selectedPath = Array.isArray(routePath) ? routePath[0] : routePath;
  if (typeof selectedPath === 'string') {
    res.locals.observabilityRoute = `${req.baseUrl}${selectedPath}`.replace(/\/{2,}/g, '/');
  }
  next();
};

export default captureRoute;
