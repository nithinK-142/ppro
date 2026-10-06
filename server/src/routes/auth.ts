import express from 'express';
import { register, verifyEmail, resendVerification, login } from '../controllers/auth.ts';
import validate from '../middleware/validate.ts';
import { authIpLimiter, authAccountLimiter } from '../middleware/rate-limit.ts';
import { registerSchema, verifySchema, loginSchema } from '../validation/auth.ts';

const router = express.Router();
router.use(authIpLimiter, authAccountLimiter);
router.post('/register', validate({ body: registerSchema }), register);
router.post('/verify-email', validate({ body: verifySchema }), verifyEmail);
router.post('/resend-verification', validate({ body: verifySchema.pick({ email: true }) }), resendVerification);
router.post('/login', validate({ body: loginSchema }), login);

export default router;
