import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import env from './config/env.ts';
import requestId from './middleware/request-id.ts';
import httpLogger from './middleware/http-logger.ts';
import { apiLimiter } from './middleware/rate-limit.ts';
import errorHandler from './middleware/error-handler.ts';
import AppError from './utils/app-error.ts';
import healthRoutes from './routes/health.ts';
import authRoutes from './routes/auth.ts';
import profileRoutes from './routes/profile.ts';
import taskRoutes from './routes/tasks.ts';

const app = express();
app.disable('x-powered-by');
if (env.TRUST_PROXY) app.set('trust proxy', 1);

app.use(requestId);
app.use(httpLogger);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN === '*' ? true : env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '20kb' }));

app.use('/health', healthRoutes);
app.use('/api/v1', apiLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/tasks', taskRoutes);

app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Route not found')));
app.use(errorHandler);

export default app;
