const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db, transaction } = require('../db');
const env = require('../config/env');
const AppError = require('../errors/app-error');
const { generateOtp, hashOtp, otpMatches, otpExpired, resendAvailable } = require('../utils/otp');
const { sendOtp } = require('../utils/mailer');
const { waitUntil } = require('@vercel/functions');

function createToken(userId) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

function otpWindow() {
  const sentAt = new Date();
  const expiresAt = new Date(sentAt.getTime() + env.OTP_EXPIRES_MINUTES * 60_000);
  return { sentAt, expiresAt };
}

async function register(req, res) {
  const { email, password } = req.body;
  const existing = await db.get('SELECT id, email_verified_at FROM users WHERE email = $1', [email]);

  if (existing) {
    throw new AppError(409, 'EMAIL_EXISTS', existing.email_verified_at ? 'An account already exists for this email' : 'An account is already registered. Verify the email or request a new code.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const code = generateOtp();
  const { sentAt, expiresAt } = otpWindow();

  const userId = await transaction(async (tx) => {
    const result = await tx.get(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email, passwordHash]
    );
    await tx.run(
      'INSERT INTO email_otps (user_id, code_hash, expires_at, attempts, sent_at) VALUES ($1, $2, $3, 0, $4)',
      [result.id, hashOtp(code), expiresAt.toISOString(), sentAt.toISOString()]
    );
    return result.id;
  });

  req.log.info({ event: 'auth.registered', userId }, 'user registered');

  waitUntil(sendOtp(email, code)
    .then(() => {
      req.log.info({ event: 'auth.otp_sent', userId }, 'verification code sent');
    })
    .catch((err) => {
      req.log.error({
        err,
        event: 'auth.otp_send_failed',
        userId
      }, 'failed to send verification code');
    }));

  return res.status(201).json({
    data: { userId, email, verificationRequired: true }
  });
}

async function verifyEmail(req, res) {
  const { email, otp } = req.body;
  const user = await db.get('SELECT id, email_verified_at FROM users WHERE email = $1', [email]);
  if (!user) throw new AppError(400, 'INVALID_OTP', 'The verification code is invalid or expired');
  if (user.email_verified_at) return res.json({ data: { verified: true } });

  const record = await db.get('SELECT code_hash, expires_at, attempts FROM email_otps WHERE user_id = $1', [user.id]);
  if (!record || record.attempts >= env.OTP_MAX_ATTEMPTS || otpExpired(record.expires_at)) {
    throw new AppError(400, 'INVALID_OTP', 'The verification code is invalid or expired');
  }

  if (!otpMatches(otp, record.code_hash)) {
    const attempts = record.attempts + 1;
    await db.run('UPDATE email_otps SET attempts = $1 WHERE user_id = $2', [attempts, user.id]);
    throw new AppError(400, 'INVALID_OTP', attempts >= env.OTP_MAX_ATTEMPTS ? 'Too many incorrect attempts. Request a new code.' : 'The verification code is incorrect');
  }

  await transaction(async (tx) => {
    await tx.run('UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    await tx.run('DELETE FROM email_otps WHERE user_id = $1', [user.id]);
  });

  req.log.info({ event: 'auth.email_verified', userId: user.id }, 'email verified');
  return res.json({ data: { verified: true } });
}

async function resendVerification(req, res) {
  const { email } = req.body;
  const user = await db.get('SELECT id, email_verified_at FROM users WHERE email = $1', [email]);
  if (!user) throw new AppError(404, 'EMAIL_NOT_FOUND', 'No account exists for this email');
  if (user.email_verified_at) return res.json({ data: { verified: true } });

  const current = await db.get('SELECT sent_at FROM email_otps WHERE user_id = $1', [user.id]);
  const wait = current ? resendAvailable(current.sent_at) : 0;
  if (wait > 0) throw new AppError(429, 'OTP_COOLDOWN', `Try again in ${wait} seconds`, { retryAfterSeconds: wait });

  const code = generateOtp();
  const { sentAt, expiresAt } = otpWindow();
  await db.run(
    'INSERT INTO email_otps (user_id, code_hash, expires_at, attempts, sent_at) VALUES ($1, $2, $3, 0, $4) ON CONFLICT(user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, sent_at = EXCLUDED.sent_at',
    [user.id, hashOtp(code), expiresAt.toISOString(), sentAt.toISOString()]
  );

  waitUntil(sendOtp(email, code)
    .then(() => {
      req.log.info({ event: 'auth.otp_resent', userId: user.id }, 'verification code sent');
    })
    .catch((err) => {
      req.log.error({
        err,
        event: 'auth.otp_send_failed',
        userId: user.id
      }, 'failed to send verification code');
    }));

  return res.json({ data: { sent: true } });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await db.get('SELECT id, password_hash, email_verified_at FROM users WHERE email = $1', [email]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  if (!user.email_verified_at) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before logging in');
  }

  const [profile, selectedTasks] = await Promise.all([
    db.get('SELECT name, mobile, address, business_name AS "businessName", updated_at FROM profiles WHERE user_id = $1', [user.id]),
    db.all(`SELECT t.id, t.name, t.category, t.description
      FROM user_tasks ut JOIN tasks t ON t.id = ut.task_id
      WHERE ut.user_id = $1 ORDER BY t.category, t.name`, [user.id])
  ]);

  return res.json({
    data: {
      token: createToken(user.id),
      user: { id: user.id, email: user.email, emailVerifiedAt: user.email_verified_at },
      profile: profile || null,
      selectedTasks,
      setupComplete: Boolean(profile && selectedTasks.length)
    }
  });
}

module.exports = { register, verifyEmail, resendVerification, login };
