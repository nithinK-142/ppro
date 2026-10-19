import bcrypt from 'bcrypt';
import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { profiles, unverifiedUsers, users } from '../db/schema/index.ts';
import { getSelectedTasks } from '../db/queries.ts';
import type { DataResponse, LoginData, LogoutData, RegisterData, RefreshData, ResendData } from '../types/api.ts';
import env from '../config/env.ts';
import AppError from '../utils/app-error.ts';
import { generateOtp, hashOtp, otpMatches, otpExpired, resendAvailable } from '../utils/otp.ts';
import { sendOtp } from '../utils/mailer.ts';
import { loginSchema, registerSchema, refreshTokenSchema, resendSchema, verifySchema } from '../validation/auth.ts';
import { issueTokenPair, revokeRefreshToken, rotateRefreshToken } from '../services/session-tokens.ts';

type RegisterInput = z.infer<typeof registerSchema>;
type VerifyInput = z.infer<typeof verifySchema>;
type ResendInput = z.infer<typeof resendSchema>;
type LoginInput = z.infer<typeof loginSchema>;
type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

type RouteParams = Record<string, string>;
type RegisterHandler = RequestHandler<RouteParams, DataResponse<RegisterData>, RegisterInput>;
type VerificationHandler = RequestHandler<RouteParams, DataResponse<LoginData>, VerifyInput>;
type ResendHandler = RequestHandler<RouteParams, DataResponse<ResendData>, ResendInput>;
type LoginHandler = RequestHandler<RouteParams, DataResponse<LoginData>, LoginInput>;
type RefreshHandler = RequestHandler<RouteParams, DataResponse<RefreshData>, RefreshTokenInput>;
type LogoutHandler = RequestHandler<RouteParams, DataResponse<LogoutData>, RefreshTokenInput>;

function disableResponseCaching(res: Response) {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
}

function otpWindow() {
  const sentAt = new Date();
  const expiresAt = new Date(sentAt.getTime() + env.OTP_EXPIRES_MINUTES * 60_000);
  return { sentAt, expiresAt };
}

const PENDING_REGISTRATION_TTL_MS = 24 * 60 * 60 * 1000;

async function sendVerificationCode(req: Request, email: string, code: string, registrationId: string, event: 'auth.otp_sent' | 'auth.otp_resent'): Promise<boolean> {
  try {
    await sendOtp(email, code);
    req.log.info({ event, registrationId }, 'verification code sent');
    return true;
  } catch {
    req.log.error({ event: 'auth.otp_send_failed', registrationId }, 'failed to send verification code');
    return false;
  }
}

function invalidRegistration() {
  return new AppError(400, 'INVALID_OTP', 'The verification code or registration is invalid or expired');
}

const register: RegisterHandler = async (req, res) => {
  const { email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const code = generateOtp();
  const { sentAt, expiresAt } = otpWindow();

  const registration = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 0))`);

    const [user] = await tx.select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) return null;

    const [pending] = await tx.insert(unverifiedUsers).values({
      email,
      passwordHash,
      codeHash: hashOtp(code),
      expiresAt,
      attempts: 0,
      sentAt
    }).returning({ registrationId: unverifiedUsers.registrationId });

    return pending ?? null;
  });

  if (!registration) {
    throw new AppError(409, 'EMAIL_EXISTS', 'An account already exists for this email');
  }

  req.log.info({ event: 'auth.registration_pending', registrationId: registration.registrationId }, 'pending registration created');
  const verificationEmailSent = await sendVerificationCode(req, email, code, registration.registrationId, 'auth.otp_sent');
  if (!verificationEmailSent) {
    await db.update(unverifiedUsers)
      .set({ sentAt: new Date(Date.now() - env.OTP_RESEND_SECONDS * 1000 - 1) })
      .where(eq(unverifiedUsers.registrationId, registration.registrationId));
  }

  res.status(201).json({
    data: { registrationId: registration.registrationId, email, verificationRequired: true, verificationEmailSent }
  });
};

const verifyEmail: VerificationHandler = async (req, res) => {
  const { registrationId, otp } = req.body;
  const [initial] = await db.select({ email: unverifiedUsers.email })
    .from(unverifiedUsers)
    .where(eq(unverifiedUsers.registrationId, registrationId))
    .limit(1);

  if (!initial) throw invalidRegistration();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${initial.email}, 0))`);

    const [pending] = await tx.select().from(unverifiedUsers)
      .where(eq(unverifiedUsers.registrationId, registrationId))
      .limit(1);

    if (!pending) return { status: 'invalid' as const };

    const now = new Date();
    if (now.getTime() - pending.createdAt.getTime() >= PENDING_REGISTRATION_TTL_MS) {
      await tx.delete(unverifiedUsers).where(eq(unverifiedUsers.registrationId, registrationId));
      return { status: 'expired' as const };
    }

    if (pending.attempts >= env.OTP_MAX_ATTEMPTS || otpExpired(pending.expiresAt, now)) {
      return { status: 'invalid' as const };
    }

    if (!otpMatches(otp, pending.codeHash)) {
      await tx.update(unverifiedUsers)
        .set({ attempts: sql`${unverifiedUsers.attempts} + 1` })
        .where(eq(unverifiedUsers.registrationId, registrationId));
      return { status: 'invalid' as const };
    }

    const [created] = await tx.insert(users).values({
      email: pending.email,
      passwordHash: pending.passwordHash,
      emailVerifiedAt: now
    }).returning({ id: users.id });

    if (!created) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create account');
    const userId = created.id;

    await tx.delete(unverifiedUsers).where(eq(unverifiedUsers.email, pending.email));
    return { status: 'verified' as const, userId, email: pending.email, emailVerifiedAt: now };
  });

  if (result.status === 'expired') {
    throw new AppError(400, 'REGISTRATION_EXPIRED', 'This registration expired. Start again.');
  }
  if (result.status !== 'verified') throw invalidRegistration();

  const [profileResult, selectedTasks] = await Promise.all([
    db.select({
      name: profiles.name,
      mobile: profiles.mobile,
      address: profiles.address,
      businessName: profiles.businessName,
      updated_at: profiles.updatedAt
    }).from(profiles).where(eq(profiles.userId, result.userId)).limit(1),
    getSelectedTasks(result.userId)
  ]);
  const profile = profileResult[0];
  const tokens = await issueTokenPair(result.userId);

  req.log.info({ event: 'auth.email_verified', userId: result.userId, registrationId }, 'email verified');
  disableResponseCaching(res);
  res.json({
    data: {
      ...tokens,
      user: { id: result.userId, email: result.email, emailVerifiedAt: result.emailVerifiedAt.toISOString() },
      profile: profile ? { ...profile, updated_at: profile.updated_at.toISOString() } : null,
      selectedTasks,
      setupComplete: Boolean(profile && selectedTasks.length)
    }
  });
};

const resendVerification: ResendHandler = async (req, res) => {
  const { registrationId } = req.body;
  const [initial] = await db.select({ email: unverifiedUsers.email })
    .from(unverifiedUsers)
    .where(eq(unverifiedUsers.registrationId, registrationId))
    .limit(1);

  if (!initial) throw invalidRegistration();

  const code = generateOtp();
  const { sentAt, expiresAt } = otpWindow();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${initial.email}, 0))`);

    const [pending] = await tx.select().from(unverifiedUsers)
      .where(eq(unverifiedUsers.registrationId, registrationId))
      .limit(1);

    if (!pending) return { status: 'invalid' as const };
    if (Date.now() - pending.createdAt.getTime() >= PENDING_REGISTRATION_TTL_MS) {
      await tx.delete(unverifiedUsers).where(eq(unverifiedUsers.registrationId, registrationId));
      return { status: 'invalid' as const };
    }

    const wait = resendAvailable(pending.sentAt);
    if (wait > 0) return { status: 'cooldown' as const, wait };

    await tx.update(unverifiedUsers).set({
      codeHash: hashOtp(code),
      expiresAt,
      attempts: 0,
      sentAt
    }).where(eq(unverifiedUsers.registrationId, registrationId));

    return { status: 'ready' as const, email: pending.email };
  });

  if (result.status === 'cooldown') {
    throw new AppError(429, 'OTP_COOLDOWN', `Try again in ${result.wait} seconds`, { retryAfterSeconds: result.wait });
  }
  if (result.status !== 'ready') throw invalidRegistration();

  const sent = await sendVerificationCode(req, result.email, code, registrationId, 'auth.otp_resent');
  if (!sent) {
    await db.update(unverifiedUsers)
      .set({ sentAt: new Date(Date.now() - env.OTP_RESEND_SECONDS * 1000 - 1) })
      .where(eq(unverifiedUsers.registrationId, registrationId));
    throw new AppError(502, 'EMAIL_DELIVERY_FAILED', 'Could not send the verification email. Try again shortly.');
  }

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

  const tokens = await issueTokenPair(user.id);

  disableResponseCaching(res);
  res.json({
    data: {
      ...tokens,
      user: { id: user.id, email: user.email, emailVerifiedAt: user.emailVerifiedAt.toISOString() },
      profile: profile ? { ...profile, updated_at: profile.updated_at.toISOString() } : null,
      selectedTasks,
      setupComplete: Boolean(profile && selectedTasks.length)
    }
  });
};

const refreshSession: RefreshHandler = async (req, res) => {
  const result = await rotateRefreshToken(req.body.refreshToken, req.body.refreshAttemptId);

  if (result.status !== 'rotated' && result.status !== 'replayed') {
    if (result.status === 'reused') {
      req.log.warn({ event: 'auth.refresh_token_reuse_detected', userId: result.userId }, 'revoked refresh token was reused; session family revoked');
    }
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired. Sign in again.');
  }

  req.log.info({ event: result.status === 'replayed' ? 'auth.token_refresh_replayed' : 'auth.token_refreshed', userId: result.userId }, result.status === 'replayed' ? 'returned prior refresh result' : 'access token refreshed');
  disableResponseCaching(res);
  res.json({ data: result.tokens });
};

const logout: LogoutHandler = async (req, res) => {
  await revokeRefreshToken(req.body.refreshToken);
  res.json({ data: { loggedOut: true } });
};

export { register, verifyEmail, resendVerification, login, refreshSession, logout };
