const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const requestId = require('./middleware/request-id');
const { apiLimiter } = require('./middleware/rate-limit');
const errorHandler = require('./middleware/error-handler');
const AppError = require('./errors/app-error');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const taskRoutes = require('./routes/tasks');

const app = express();
app.disable('x-powered-by');
if (env.TRUST_PROXY) app.set('trust proxy', 1);

app.use(requestId);
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

module.exports = app;
