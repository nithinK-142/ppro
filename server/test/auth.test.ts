import request from 'supertest';
import bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { beforeEach, vi } from 'vitest';
import app from '../src/app.ts';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../src/db/index.ts';
import env from '../src/config/env.ts';
import { refreshTokens, unverifiedUsers, users } from '../src/db/schema/index.ts';
import { hashOtp, otpMatches } from '../src/utils/otp.ts';
import { authHeader, createProfile, createUser, selectTasks, taskId } from './helpers.ts';

const { sendOtpMock } = vi.hoisted(() => ({ sendOtpMock: vi.fn() }));
vi.mock('../src/utils/mailer.ts', () => ({ sendOtp: sendOtpMock }));

beforeEach(() => {
  sendOtpMock.mockReset().mockResolvedValue(undefined);
});

const validPassword = 'StrongPass123!';

async function beginRegistration(email: string, password = validPassword) {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password, confirmPassword: password })
    .expect(201);
  const registrationId = response.body.data.registrationId as string;
  const code = sendOtpMock.mock.calls.at(-1)?.[1] as string;
  return { response, registrationId, code };
}

async function pendingRecord(registrationId: string) {
  const [record] = await db.select().from(unverifiedUsers)
    .where(eq(unverifiedUsers.registrationId, registrationId)).limit(1);
  return record ?? null;
}

describe('authentication', () => {
  it('creates isolated pending state, hashes the password, and sends a hashed OTP', async () => {
    const { response, registrationId, code } = await beginRegistration(' TEST@EXAMPLE.COM ');

    expect(response.body.data).toMatchObject({
      registrationId,
      email: 'test@example.com',
      verificationRequired: true,
      verificationEmailSent: true
    });
    expect(registrationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(await pendingRecord(registrationId)).toMatchObject({ email: 'test@example.com', attempts: 0 });
    const pending = await pendingRecord(registrationId);
    expect(pending?.codeHash).toHaveLength(64);
    expect(pending?.codeHash).not.toBe(code);
    expect(await bcrypt.compare(validPassword, pending?.passwordHash ?? '')).toBe(true);
    expect(await db.select().from(users).where(eq(users.email, 'test@example.com'))).toHaveLength(0);
    expect(otpMatches(code, pending?.codeHash ?? '')).toBe(true);
    expect(sendOtpMock).toHaveBeenCalledWith('test@example.com', expect.stringMatching(/^\d{6}$/));
  });

  it('reports registration success separately from verification email delivery', async () => {
    sendOtpMock.mockRejectedValueOnce(Object.assign(new Error('mail provider unavailable'), { code: 'MAILJET_API_ERROR', statusCode: 503 }));

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'mail-failure@example.com', password: validPassword, confirmPassword: validPassword })
      .expect(201);

    expect(response.body.data).toMatchObject({ verificationRequired: true, verificationEmailSent: false });
    expect(await pendingRecord(response.body.data.registrationId)).not.toBeNull();
    expect(await db.select().from(users).where(eq(users.email, 'mail-failure@example.com'))).toHaveLength(0);
    expect(sendOtpMock).toHaveBeenCalledOnce();
  });

  it('rejects duplicate registration for a verified account', async () => {
    await createUser({ email: 'exists@example.com' });

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'EXISTS@example.com', password: validPassword, confirmPassword: validPassword })
      .expect(409);

    expect(response.body.error.code).toBe('EMAIL_EXISTS');
  });

  it('allows separate pending attempts for the same email and promotes only the verified attempt', async () => {
    const attacker = await beginRegistration('shared@example.com', 'AttackerPass123!');
    const victim = await beginRegistration('shared@example.com', 'VictimPass123!');
    const attackerCode = '123456';
    const victimCode = '654321';
    await db.update(unverifiedUsers).set({ codeHash: hashOtp(attackerCode) })
      .where(eq(unverifiedUsers.registrationId, attacker.registrationId));
    await db.update(unverifiedUsers).set({ codeHash: hashOtp(victimCode) })
      .where(eq(unverifiedUsers.registrationId, victim.registrationId));

    expect(attacker.registrationId).not.toBe(victim.registrationId);
    expect(await db.select({ id: unverifiedUsers.registrationId }).from(unverifiedUsers)
      .where(eq(unverifiedUsers.email, 'shared@example.com'))).toHaveLength(2);

    await request(app).post('/api/v1/auth/verify-email')
      .send({ registrationId: attacker.registrationId, otp: victimCode })
      .expect(400);
    expect((await pendingRecord(attacker.registrationId))?.attempts).toBe(1);
    expect((await pendingRecord(victim.registrationId))?.attempts).toBe(0);

    const verified = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ registrationId: victim.registrationId, otp: victimCode })
      .expect(200);

    expect(verified.body.data.accessToken).toEqual(expect.any(String));
    const [user] = await db.select({ id: users.id, passwordHash: users.passwordHash, emailVerifiedAt: users.emailVerifiedAt })
      .from(users).where(eq(users.email, 'shared@example.com')).limit(1);
    expect(user?.emailVerifiedAt).toBeTruthy();
    expect(await bcrypt.compare('VictimPass123!', user?.passwordHash ?? '')).toBe(true);
    expect(await bcrypt.compare('AttackerPass123!', user?.passwordHash ?? '')).toBe(false);
    expect(await db.select().from(unverifiedUsers).where(eq(unverifiedUsers.email, 'shared@example.com'))).toHaveLength(0);

    await request(app).post('/api/v1/auth/login')
      .send({ email: 'shared@example.com', password: 'VictimPass123!' })
      .expect(200);
    await request(app).post('/api/v1/auth/login')
      .send({ email: 'shared@example.com', password: 'AttackerPass123!' })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ registrationId: attacker.registrationId, otp: attackerCode })
      .expect(400);
  });

  it('serializes concurrent verification attempts for the same email', async () => {
    const first = await beginRegistration('race@example.com', 'FirstChosenPass123!');
    const second = await beginRegistration('race@example.com', 'SecondChosenPass123!');

    const responses = await Promise.all([
      request(app).post('/api/v1/auth/verify-email').send({ registrationId: first.registrationId, otp: first.code }),
      request(app).post('/api/v1/auth/verify-email').send({ registrationId: second.registrationId, otp: second.code })
    ]);

    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([200, 400]);
    expect(await db.select().from(users).where(eq(users.email, 'race@example.com'))).toHaveLength(1);
    expect(await db.select().from(unverifiedUsers).where(eq(unverifiedUsers.email, 'race@example.com'))).toHaveLength(0);
  });

  it('rejects an unknown registration identifier and consumed registrations', async () => {
    await request(app).post('/api/v1/auth/verify-email')
      .send({ registrationId: '00000000-0000-4000-8000-000000000000', otp: '123456' })
      .expect(400);

    const registration = await beginRegistration('replay@example.com');
    await request(app).post('/api/v1/auth/verify-email')
      .send({ registrationId: registration.registrationId, otp: registration.code })
      .expect(200);
    const replay = await request(app).post('/api/v1/auth/verify-email')
      .send({ registrationId: registration.registrationId, otp: registration.code })
      .expect(400);
    expect(replay.body.error.code).toBe('INVALID_OTP');
  });

  it('enforces the failed-attempt limit for each registration', async () => {
    const registration = await beginRegistration('wrong-otp@example.com');
    const wrongOtp = registration.code === '000000' ? '000001' : '000000';
    for (let attempt = 1; attempt <= env.OTP_MAX_ATTEMPTS; attempt += 1) {
      const response = await request(app).post('/api/v1/auth/verify-email')
        .send({ registrationId: registration.registrationId, otp: wrongOtp })
        .expect(400);
      expect(response.body.error.code).toBe('INVALID_OTP');
    }
    expect((await pendingRecord(registration.registrationId))?.attempts).toBe(env.OTP_MAX_ATTEMPTS);
    await request(app).post('/api/v1/auth/verify-email')
      .send({ registrationId: registration.registrationId, otp: registration.code })
      .expect(400);
    expect(await db.select().from(users).where(eq(users.email, 'wrong-otp@example.com'))).toHaveLength(0);
  });

  it('rejects OTPs after their ten-minute expiry', async () => {
    const registration = await beginRegistration('expired-otp@example.com');
    await db.update(unverifiedUsers).set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(unverifiedUsers.registrationId, registration.registrationId));

    const response = await request(app).post('/api/v1/auth/verify-email')
      .send({ registrationId: registration.registrationId, otp: registration.code })
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_OTP');
    expect(await pendingRecord(registration.registrationId)).not.toBeNull();
  });

  it('rejects and consumes registrations older than 24 hours', async () => {
    const registration = await beginRegistration('expired-registration@example.com');
    await db.update(unverifiedUsers).set({ createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000 - 1) })
      .where(eq(unverifiedUsers.registrationId, registration.registrationId));

    const response = await request(app).post('/api/v1/auth/verify-email')
      .send({ registrationId: registration.registrationId, otp: registration.code })
      .expect(400);
    expect(response.body.error.code).toBe('REGISTRATION_EXPIRED');
    expect(await pendingRecord(registration.registrationId)).toBeNull();
  });

  it('resends by registration ID and resets only that attempt OTP state', async () => {
    const registration = await beginRegistration('resend@example.com');
    await db.update(unverifiedUsers).set({ sentAt: new Date(Date.now() - env.OTP_RESEND_SECONDS * 1000 - 1000), attempts: 2 })
      .where(eq(unverifiedUsers.registrationId, registration.registrationId));

    const beforeResend = await pendingRecord(registration.registrationId);
    const createdAt = beforeResend?.createdAt;
    const originalCodeHash = beforeResend?.codeHash;
    const response = await request(app).post('/api/v1/auth/resend-verification')
      .send({ registrationId: registration.registrationId })
      .expect(200);

    expect(response.body.data).toEqual({ sent: true });
    const pending = await pendingRecord(registration.registrationId);
    expect(pending?.createdAt.getTime()).toBe(createdAt?.getTime());
    expect(pending?.attempts).toBe(0);
    expect(pending?.codeHash).not.toBe(originalCodeHash);
    expect(otpMatches(sendOtpMock.mock.calls.at(-1)?.[1] as string, pending?.codeHash ?? '')).toBe(true);
  });

  it('blocks resend during cooldown', async () => {
    const registration = await beginRegistration('cooldown@example.com');
    const response = await request(app).post('/api/v1/auth/resend-verification')
      .send({ registrationId: registration.registrationId })
      .expect(429);

    expect(response.body.error.code).toBe('OTP_COOLDOWN');
    expect(response.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('reports resend delivery failures', async () => {
    const registration = await beginRegistration('resend-failure@example.com');
    await db.update(unverifiedUsers).set({ sentAt: new Date(Date.now() - env.OTP_RESEND_SECONDS * 1000 - 1000) })
      .where(eq(unverifiedUsers.registrationId, registration.registrationId));
    sendOtpMock.mockRejectedValueOnce(new Error('mail provider unavailable'));

    const response = await request(app).post('/api/v1/auth/resend-verification')
      .send({ registrationId: registration.registrationId })
      .expect(502);

    expect(response.body.error.code).toBe('EMAIL_DELIVERY_FAILED');
    expect(response.body.error.requestId).toBeTruthy();
  });

  it('rejects invalid credentials', async () => {
    await createUser({ email: 'login@example.com' });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@example.com', password: 'WrongPass123!' })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('logs in with profile and selected tasks and reports setup complete', async () => {
    const user = await createUser({ email: 'complete@example.com' });
    await createProfile(user.id);
    const ids = await Promise.all([taskId('AC service visit'), taskId('Doctor appointment')]);
    await selectTasks(user.id, ids);

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: validPassword })
      .expect(200);

    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
    expect(jwt.decode(response.body.data.accessToken)).toMatchObject({ sub: String(user.id), tokenUse: 'access' });
    expect(response.body.data).not.toHaveProperty('token');
    expect(response.body.data.user.email).toBe(user.email);
    expect(response.body.data.user.emailVerifiedAt).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(response.body.data.user.emailVerifiedAt))).toBe(false);
    expect(response.body.data.profile.updated_at).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(response.body.data.profile.updated_at))).toBe(false);
    await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${response.body.data.accessToken}`)
      .expect(200);
    expect(response.body.data.profile.businessName).toBe('Padosi Homes');
    expect(response.body.data.selectedTasks).toHaveLength(2);
    expect(response.body.data.setupComplete).toBe(true);
  });

  it('stores only a hash of the refresh token', async () => {
    const user = await createUser({ email: 'token-hash@example.com' });
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: validPassword })
      .expect(200);

    const tokenHash = createHash('sha256').update(response.body.data.refreshToken).digest('hex');
    const [record] = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, user.id)).limit(1);

    expect(record?.tokenHash).toBe(tokenHash);
    expect(record?.tokenHash).not.toBe(response.body.data.refreshToken);
    expect(record?.revokedAt).toBeNull();
    expect(record?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rotates refresh tokens and revokes the family when an old token is reused', async () => {
    const user = await createUser({ email: 'token-rotation@example.com' });
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: validPassword })
      .expect(200);
    const firstRefreshToken = loginResponse.body.data.refreshToken as string;
    const refreshAttemptId = 'refresh-attempt-000001';

    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefreshToken, refreshAttemptId })
      .expect(200);

    expect(refreshResponse.body.data.accessToken).toEqual(expect.any(String));
    expect(refreshResponse.body.data.refreshToken).toEqual(expect.any(String));
    expect(refreshResponse.body.data.refreshToken).not.toBe(firstRefreshToken);

    const firstHash = createHash('sha256').update(firstRefreshToken).digest('hex');
    const [firstRecord] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, firstHash)).limit(1);
    expect(firstRecord?.revokedAt).toBeTruthy();
    expect(firstRecord?.replacedByHash).toBe(createHash('sha256').update(refreshResponse.body.data.refreshToken).digest('hex'));

    const recoveredResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefreshToken, refreshAttemptId })
      .expect(200);
    expect(recoveredResponse.body.data).toEqual(refreshResponse.body.data);

    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefreshToken, refreshAttemptId: 'refresh-attempt-000002' })
      .expect(401);

    const activeHash = createHash('sha256').update(refreshResponse.body.data.refreshToken).digest('hex');
    const [activeRecord] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, activeHash)).limit(1);
    expect(activeRecord?.revokedAt).toBeTruthy();

    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refreshResponse.body.data.refreshToken })
      .expect(401);
  });

  it('revokes the refresh-token family on logout', async () => {
    const user = await createUser({ email: 'token-logout@example.com' });
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: validPassword })
      .expect(200);
    const refreshToken = loginResponse.body.data.refreshToken as string;

    await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken })
      .expect(200, { data: { loggedOut: true } });

    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('rejects expired refresh tokens and revokes their session family', async () => {
    const user = await createUser({ email: 'token-expired@example.com' });
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: validPassword })
      .expect(200);
    const refreshToken = loginResponse.body.data.refreshToken as string;
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    await db.update(refreshTokens)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(refreshTokens.tokenHash, tokenHash));

    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    const [record] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);
    expect(record?.revokedAt).toBeTruthy();
  });

  it('rejects unknown refresh tokens', async () => {
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'x'.repeat(43) })
      .expect(401);
  });

  it('logs in without profile or tasks and reports incomplete setup', async () => {
    const user = await createUser({ email: 'incomplete@example.com' });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: validPassword })
      .expect(200);

    expect(response.body.data.profile).toBeNull();
    expect(response.body.data.selectedTasks).toEqual([]);
    expect(response.body.data.setupComplete).toBe(false);
  });

  it('returns selected tasks when logging in with a valid session', async () => {
    const user = await createUser({ email: 'session@example.com' });
    const id = await taskId('AC service visit');
    await selectTasks(user.id, [id]);

    const response = await request(app)
      .get('/api/v1/profile')
      .set(authHeader(user.id))
      .expect(200);

    expect(response.body.data.selectedTasks).toHaveLength(1);
  });
});
