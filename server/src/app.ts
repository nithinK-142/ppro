import express from 'express';
import { createRequire } from 'node:module';
import cors from 'cors';
import env from './config/env.ts';
import requestId from './middleware/request-id.ts';
import httpLogger from './middleware/http-logger.ts';
import httpMetrics from './middleware/http-metrics.ts';
import httpTracing from './middleware/http-tracing.ts';
import { metricsHandler } from './observability/metrics.ts';
import { apiLimiter } from './middleware/rate-limit.ts';
import errorHandler from './middleware/error-handler.ts';
import AppError from './utils/app-error.ts';
import healthRoutes from './routes/health.ts';
import authRoutes from './routes/auth.ts';
import profileRoutes from './routes/profile.ts';
import taskRoutes from './routes/tasks.ts';

const require = createRequire(import.meta.url);
const helmet = require('helmet') as (
  options?: import('helmet').HelmetOptions
) => import('express').RequestHandler;

const app = express();
app.disable('x-powered-by');
if (env.TRUST_PROXY) app.set('trust proxy', 1);

app.use(requestId);
app.use(httpLogger);
app.use(httpMetrics);
app.use(httpTracing);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN === '*' ? true : env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '20kb' }));

app.get('/metrics', metricsHandler);
app.use('/health', healthRoutes);
app.use('/api/v1', apiLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/tasks', taskRoutes);

app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Route not found')));
app.use(errorHandler);

export default app;
