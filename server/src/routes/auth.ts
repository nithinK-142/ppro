import express from 'express';
import { authIpLimiter, authAccountLimiter } from '../middleware/rate-limit.ts';
import validate from '../middleware/validate.ts';
import { register, verifyEmail, resendVerification, login } from '../controllers/auth.ts';
import { registerSchema, verifySchema, loginSchema } from '../validation/auth.ts';

const router = express.Router();
router.use(authIpLimiter, authAccountLimiter);
router.post('/register', validate(registerSchema), register);
router.post('/verify-email', validate(verifySchema), verifyEmail);
router.post('/resend-verification', validate(verifySchema.pick({ email: true })), resendVerification);
router.post('/login', validate(loginSchema), login);

export default router;
