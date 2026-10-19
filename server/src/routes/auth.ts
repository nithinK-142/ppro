import express from 'express';
import { authIpLimiter, authAccountLimiter } from '../middleware/rate-limit.ts';
import validate from '../middleware/validate.ts';
import { register, verifyEmail, resendVerification, login, refreshSession, logout } from '../controllers/auth.ts';
import { registerSchema, verifySchema, resendSchema, loginSchema, refreshTokenSchema } from '../validation/auth.ts';
import captureRoute from '../middleware/route-context.ts';

const router = express.Router();
router.post('/register', captureRoute, authIpLimiter, authAccountLimiter, validate(registerSchema), register);
router.post('/verify-email', captureRoute, authIpLimiter, authAccountLimiter, validate(verifySchema), verifyEmail);
router.post('/resend-verification', captureRoute, authIpLimiter, authAccountLimiter, validate(resendSchema), resendVerification);
router.post('/login', captureRoute, authIpLimiter, authAccountLimiter, validate(loginSchema), login);
router.post('/refresh', captureRoute, authIpLimiter, validate(refreshTokenSchema), refreshSession);
router.post('/logout', captureRoute, authIpLimiter, validate(refreshTokenSchema), logout);

export default router;
