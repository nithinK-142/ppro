import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { waitUntil } from '@vercel/functions';
import type { Request, RequestHandler } from 'express';
import type { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../config/db.ts';
import { emailOtps, profiles, users } from '../config/schema.ts';
import { findUserByEmail, getSelectedTasks } from '../config/queries.ts';
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

function sendVerificationCode(req: Request, email: string, code: string, userId: number, event: 'auth.otp_sent' | 'auth.otp_resent') {
  waitUntil(
    sendOtp(email, code)
      .then(() => {
        req.log.info({ event, userId }, 'verification code sent');
      })
      .catch((err) => {
        req.log.error({ err, event: 'auth.otp_send_failed', userId }, 'failed to send verification code');
      })
  );
}

const register: RegisterHandler = async (req, res) => {
  const { email, password } = req.body;
  const existing = await findUserByEmail(email);

  if (existing) {
    throw new AppError(409, 'EMAIL_EXISTS', existing.emailVerifiedAt ? 'An account already exists for this email' : 'An account is already registered. Verify the email or request a new code.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const code = generateOtp();
  const { sentAt, expiresAt } = otpWindow();

  const userId = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id });
    if (!user) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create account');

    await tx.insert(emailOtps).values({
      userId: user.id,
      codeHash: hashOtp(code),
      expiresAt,
      attempts: 0,
      sentAt
    });

    return user.id;
  });

  req.log.info({ event: 'auth.registered', userId }, 'user registered');

  sendVerificationCode(req, email, code, userId, 'auth.otp_sent');

  res.status(201).json({
    data: { userId, email, verificationRequired: true }
  });
};

const verifyEmail: VerificationHandler = async (req, res) => {
  const { email, otp } = req.body;
  const user = await findUserByEmail(email);

  if (!user) throw new AppError(400, 'INVALID_OTP', 'The verification code is invalid or expired');
  if (user.emailVerifiedAt) {
    res.json({ data: { verified: true } });
    return;
  }

  const [record] = await db.select({
    codeHash: emailOtps.codeHash,
    expiresAt: emailOtps.expiresAt,
    attempts: emailOtps.attempts
  }).from(emailOtps).where(eq(emailOtps.userId, user.id)).limit(1);

  if (!record || record.attempts >= env.OTP_MAX_ATTEMPTS || otpExpired(record.expiresAt)) {
    throw new AppError(400, 'INVALID_OTP', 'The verification code is invalid or expired');
  }

  if (!otpMatches(otp, record.codeHash)) {
    const attempts = record.attempts + 1;
    await db.update(emailOtps).set({ attempts }).where(eq(emailOtps.userId, user.id));
    throw new AppError(400, 'INVALID_OTP', attempts >= env.OTP_MAX_ATTEMPTS ? 'Too many incorrect attempts. Request a new code.' : 'The verification code is incorrect');
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
    await tx.delete(emailOtps).where(eq(emailOtps.userId, user.id));
  });

  req.log.info({ event: 'auth.email_verified', userId: user.id }, 'email verified');
  res.json({ data: { verified: true } });
};

const resendVerification: ResendHandler = async (req, res) => {
  const { email } = req.body;
  const user = await findUserByEmail(email);

  if (!user) throw new AppError(404, 'EMAIL_NOT_FOUND', 'No account exists for this email');
  if (user.emailVerifiedAt) {
    res.json({ data: { verified: true } });
    return;
  }

  const [current] = await db.select({ sentAt: emailOtps.sentAt })
    .from(emailOtps)
    .where(eq(emailOtps.userId, user.id))
    .limit(1);
  const wait = current ? resendAvailable(current.sentAt) : 0;
  if (wait > 0) throw new AppError(429, 'OTP_COOLDOWN', `Try again in ${wait} seconds`, { retryAfterSeconds: wait });

  const code = generateOtp();
  const { sentAt, expiresAt } = otpWindow();
  await db.insert(emailOtps).values({
    userId: user.id,
    codeHash: hashOtp(code),
    expiresAt,
    attempts: 0,
    sentAt
  }).onConflictDoUpdate({
    target: emailOtps.userId,
    set: { codeHash: hashOtp(code), expiresAt, attempts: 0, sentAt }
  });

  sendVerificationCode(req, email, code, user.id, 'auth.otp_resent');

  res.json({ data: { sent: true } });
};

const login: LoginHandler = async (req, res) => {
  const { email, password } = req.body;
  const [user] = await db.select({
    id: users.id,
    email: users.email,
    passwordHash: users.passwordHash,
    emailVerifiedAt: users.emailVerifiedAt
  }).from(users).where(eq(users.email, email)).limit(1);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  if (!user.emailVerifiedAt) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before logging in');
  }

  const [profileResult, selectedTasks] = await Promise.all([
    db.select({
      name: profiles.name,
      mobile: profiles.mobile,
      address: profiles.address,
      businessName: profiles.businessName,
      updated_at: profiles.updatedAt
    }).from(profiles).where(eq(profiles.userId, user.id)).limit(1),
    getSelectedTasks(user.id)
  ]);
  const profile = profileResult[0];

  res.json({
    data: {
      token: createToken(user.id),
      user: { id: user.id, email: user.email, emailVerifiedAt: user.emailVerifiedAt },
      profile: profile || null,
      selectedTasks,
      setupComplete: Boolean(profile && selectedTasks.length)
    }
  });
};

export { register, verifyEmail, resendVerification, login };
