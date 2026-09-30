const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../errors/app-error');

function authenticate(req, _res, next) {
  const header = req.get('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (!payload.sub) throw new Error('Invalid subject');
    req.userId = Number(payload.sub);
    return next();
  } catch {
    return next(new AppError(401, 'INVALID_TOKEN', 'Authentication token is invalid or expired'));
  }
}

module.exports = authenticate;
