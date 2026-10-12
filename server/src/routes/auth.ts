import express from 'express';
import { authIpLimiter, authAccountLimiter } from '../middleware/rate-limit.ts';
import validate from '../middleware/validate.ts';
import { register, verifyEmail, resendVerification, login, refreshSession, logout } from '../controllers/auth.ts';
import { registerSchema, verifySchema, loginSchema, refreshTokenSchema } from '../validation/auth.ts';

const router = express.Router();
router.use(authIpLimiter);
router.post('/register', authAccountLimiter, validate(registerSchema), register);
router.post('/verify-email', authAccountLimiter, validate(verifySchema), verifyEmail);
router.post('/resend-verification', authAccountLimiter, validate(verifySchema.pick({ email: true })), resendVerification);
router.post('/login', authAccountLimiter, validate(loginSchema), login);
router.post('/refresh', validate(refreshTokenSchema), refreshSession);
router.post('/logout', validate(refreshTokenSchema), logout);

export default router;
