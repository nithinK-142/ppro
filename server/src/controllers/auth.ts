import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { waitUntil } from '@vercel/functions';
import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { query, transaction } from '../config/db.ts';
import type { OtpRow, ProfileRow, ResendOtpRow, TaskRow, UserAuthRow, UserExistsRow, UserVerificationRow } from '../types/database.ts';
import type { DataResponse, LoginData, RegisterData, ResendData, VerificationData } from '../types/api.ts';
import env from '../config/env.ts';
import AppError from '../utils/app-error.ts';
import { generateOtp, hashOtp, otpMatches, otpExpired, resendAvailable } from '../utils/otp.ts';
import { sendOtp } from '../utils/mailer.ts';
import { loginSchema, registerSchema, verifySchema } from '../validation/auth.ts';

type RegisterInput = z.infer<typeof registerSchema>;
type VerifyInput = z.infer<typeof verifySchema>;
type LoginInput = z.infer<typeof loginSchema>;

type RouteParams = Record<string, string>;
type RegisterHandler = RequestHandler<RouteParams, DataResponse<RegisterData>, RegisterInput>;
type VerificationHandler = RequestHandler<RouteParams, DataResponse<VerificationData>, VerifyInput>;
type ResendHandler = RequestHandler<RouteParams, DataResponse<ResendData | VerificationData>, Pick<VerifyInput, 'email'>>;
type LoginHandler = RequestHandler<RouteParams, DataResponse<LoginData>, LoginInput>;

function createToken(userId: number) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

function otpWindow() {
  const sentAt = new Date();
  const expiresAt = new Date(sentAt.getTime() + env.OTP_EXPIRES_MINUTES * 60_000);
  return { sentAt, expiresAt };
}

const register: RegisterHandler = async (req, res) => {
  const { email, password } = req.body;
  const { rows: [existing] } = await query<UserExistsRow>(
    'SELECT id, email_verified_at FROM users WHERE email = $1',
    [email]
  );

  if (existing) {
    throw new AppError(409, 'EMAIL_EXISTS', existing.email_verified_at ? 'An account already exists for this email' : 'An account is already registered. Verify the email or request a new code.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const code = generateOtp();
  const { sentAt, expiresAt } = otpWindow();

  const userId = await transaction(async (query) => {
    const { rows: [user] } = await query<{ id: number }>(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email, passwordHash]
    );
    if (!user) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create account');

    await query(
      'INSERT INTO email_otps (user_id, code_hash, expires_at, attempts, sent_at) VALUES ($1, $2, $3, 0, $4)',
      [user.id, hashOtp(code), expiresAt.toISOString(), sentAt.toISOString()]
    );

    return user.id;
  });

  req.log.info({ event: 'auth.registered', userId }, 'user registered');

  waitUntil(
    sendOtp(email, code)
      .then(() => {
        req.log.info({ event: 'auth.otp_sent', userId }, 'verification code sent');
      })
      .catch((err) => {
        req.log.error({ err, event: 'auth.otp_send_failed', userId }, 'failed to send verification code');
      })
  );

  res.status(201).json({
    data: { userId, email, verificationRequired: true }
  });
};

const verifyEmail: VerificationHandler = async (req, res) => {
  const { email, otp } = req.body;
  const { rows: [user] } = await query<UserVerificationRow>(
    'SELECT id, email_verified_at FROM users WHERE email = $1',
    [email]
  );

  if (!user) throw new AppError(400, 'INVALID_OTP', 'The verification code is invalid or expired');
  if (user.email_verified_at) {
    res.json({ data: { verified: true } });
    return;
  }

  const { rows: [record] } = await query<OtpRow>(
    'SELECT code_hash, expires_at, attempts FROM email_otps WHERE user_id = $1',
    [user.id]
  );

  if (!record || record.attempts >= env.OTP_MAX_ATTEMPTS || otpExpired(record.expires_at)) {
    throw new AppError(400, 'INVALID_OTP', 'The verification code is invalid or expired');
  }

  if (!otpMatches(otp, record.code_hash)) {
    const attempts = record.attempts + 1;
    await query('UPDATE email_otps SET attempts = $1 WHERE user_id = $2', [attempts, user.id]);
    throw new AppError(400, 'INVALID_OTP', attempts >= env.OTP_MAX_ATTEMPTS ? 'Too many incorrect attempts. Request a new code.' : 'The verification code is incorrect');
  }

  await transaction(async (query) => {
    await query('UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    await query('DELETE FROM email_otps WHERE user_id = $1', [user.id]);
  });

  req.log.info({ event: 'auth.email_verified', userId: user.id }, 'email verified');
  res.json({ data: { verified: true } });
};

const resendVerification: ResendHandler = async (req, res) => {
  const { email } = req.body;
  const { rows: [user] } = await query<UserVerificationRow>(
    'SELECT id, email_verified_at FROM users WHERE email = $1',
    [email]
  );

  if (!user) throw new AppError(404, 'EMAIL_NOT_FOUND', 'No account exists for this email');
  if (user.email_verified_at) {
    res.json({ data: { verified: true } });
    return;
  }

  const { rows: [current] } = await query<ResendOtpRow>(
    'SELECT sent_at FROM email_otps WHERE user_id = $1',
    [user.id]
  );
  const wait = current ? resendAvailable(current.sent_at) : 0;
  if (wait > 0) throw new AppError(429, 'OTP_COOLDOWN', `Try again in ${wait} seconds`, { retryAfterSeconds: wait });

  const code = generateOtp();
  const { sentAt, expiresAt } = otpWindow();
  await query(
    'INSERT INTO email_otps (user_id, code_hash, expires_at, attempts, sent_at) VALUES ($1, $2, $3, 0, $4) ON CONFLICT(user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, sent_at = EXCLUDED.sent_at',
    [user.id, hashOtp(code), expiresAt.toISOString(), sentAt.toISOString()]
  );

  waitUntil(
    sendOtp(email, code)
      .then(() => {
        req.log.info({ event: 'auth.otp_resent', userId: user.id }, 'verification code sent');
      })
      .catch((err) => {
        req.log.error({ err, event: 'auth.otp_send_failed', userId: user.id }, 'failed to send verification code');
      })
  );

  res.json({ data: { sent: true } });
};

const login: LoginHandler = async (req, res) => {
  const { email, password } = req.body;
  const { rows: [user] } = await query<UserAuthRow>(
    'SELECT id, email, password_hash, email_verified_at FROM users WHERE email = $1',
    [email]
  );

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  if (!user.email_verified_at) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before logging in');
  }

  const [profileResult, tasksResult] = await Promise.all([
    query<ProfileRow>('SELECT name, mobile, address, business_name AS "businessName", updated_at FROM profiles WHERE user_id = $1', [user.id]),
    query<TaskRow>(`SELECT t.id, t.name, t.category, t.description
      FROM user_tasks ut JOIN tasks t ON t.id = ut.task_id
      WHERE ut.user_id = $1 ORDER BY t.category, t.name`, [user.id])
  ]);
  const profile = profileResult.rows[0];

  res.json({
    data: {
      token: createToken(user.id),
      user: { id: user.id, email: user.email, emailVerifiedAt: user.email_verified_at },
      profile: profile || null,
      selectedTasks: tasksResult.rows,
      setupComplete: Boolean(profile && tasksResult.rows.length)
    }
  });
};

export { register, verifyEmail, resendVerification, login };
