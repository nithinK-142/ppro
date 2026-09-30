const express = require('express');
const { register, verifyEmail, resendVerification, login } = require('../controllers/auth');
const validate = require('../middleware/validate');
const { authIpLimiter, authAccountLimiter } = require('../middleware/rate-limit');
const { registerSchema, verifySchema, loginSchema } = require('../validation/auth');

const router = express.Router();
router.use(authIpLimiter, authAccountLimiter);
router.post('/register', validate({ body: registerSchema }), register);
router.post('/verify-email', validate({ body: verifySchema }), verifyEmail);
router.post('/resend-verification', validate({ body: verifySchema.pick({ email: true }) }), resendVerification);
router.post('/login', validate({ body: loginSchema }), login);

module.exports = router;
