import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import AppError from '../utils/app-error.ts';

const rateLimitHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later.'));
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  handler: rateLimitHandler,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  handler: rateLimitHandler,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

const authAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const registrationId = String(req.body?.registrationId || '').trim();
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    if (email) return `email:${email}`;
    if (registrationId) return `registration:${registrationId}`;
    return `ip:${ipKeyGenerator(ip)}`;
  },
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

export { apiLimiter, authIpLimiter, authAccountLimiter };
