import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import env from '../config/env.ts';
import AppError from '../utils/app-error.ts';

const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.get('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === 'string' || !payload.sub) throw new Error('Invalid subject');
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) throw new Error('Invalid subject');
    req.userId = userId;
    next();
  } catch {
    next(new AppError(401, 'INVALID_TOKEN', 'Authentication token is invalid or expired'));
  }
};

export default authenticate;
