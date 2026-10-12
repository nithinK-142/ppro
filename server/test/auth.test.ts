import request from 'supertest';
import { createHash } from 'node:crypto';
import { beforeEach, vi } from 'vitest';
import app from '../src/app.ts';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../src/config/db.ts';
import { emailOtps, refreshTokens, users } from '../src/config/schema.ts';
import { generateOtp, hashOtp } from '../src/utils/otp.ts';
import { authHeader, createProfile, createUser, otpRecord, selectTasks, taskId } from './helpers.ts';

const { sendOtpMock } = vi.hoisted(() => ({ sendOtpMock: vi.fn() }));
vi.mock('../src/utils/mailer.ts', () => ({ sendOtp: sendOtpMock }));

beforeEach(() => {
  sendOtpMock.mockReset().mockResolvedValue(undefined);
});

const validPassword = 'StrongPass123!';

describe('authentication', () => {
  it('registers a normalized email and creates an OTP record', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: ' TEST@EXAMPLE.COM ', password: validPassword, confirmPassword: validPassword })
      .expect(201);

    expect(response.body.data.email).toBe('test@example.com');
    expect(response.body.data.verificationRequired).toBe(true);

    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, response.body.data.userId)).limit(1);
    expect(user?.email).toBe('test@example.com');

    const otp = await otpRecord(response.body.data.userId);
    expect(otp).toMatchObject({ attempts: 0 });
    expect(otp?.codeHash).toHaveLength(64);
    expect(sendOtpMock).toHaveBeenCalledWith('test@example.com', expect.stringMatching(/^\d{6}$/));
  });

  it('keeps registration successful when the email provider fails', async () => {
    sendOtpMock.mockRejectedValueOnce(new Error('mail provider unavailable'));

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'mail-failure@example.com', password: validPassword, confirmPassword: validPassword })
      .expect(201);

    expect(response.body.data.verificationRequired).toBe(true);
    expect(sendOtpMock).toHaveBeenCalledOnce();
  });

  it('rejects duplicate registration for a verified account', async () => {
    await createUser({ email: 'exists@example.com', verified: true });

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'EXISTS@example.com', password: validPassword, confirmPassword: validPassword })
      .expect(409);

    expect(response.body.error.code).toBe('EMAIL_EXISTS');
    expect(response.body.error.message).toContain('already exists');
  });

  it('rejects duplicate registration for an unverified account', async () => {
    await createUser({ email: 'pending@example.com', verified: false });

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'pending@example.com', password: validPassword, confirmPassword: validPassword })
      .expect(409);

    expect(response.body.error.code).toBe('EMAIL_EXISTS');
    expect(response.body.error.message).toContain('Verify the email');
  });

  it('verifies a valid OTP and removes the OTP record', async () => {
    const user = await createUser({ email: 'verify@example.com', verified: false });
    const code = '123456';
    await db.insert(emailOtps).values({
      userId: user.id,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + 600_000),
      attempts: 0,
      sentAt: new Date()
    });

    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ email: user.email, otp: code })
      .expect(200);

    expect(response.body.data.verified).toBe(true);
    expect(await otpRecord(user.id)).toBeNull();

    const [updated] = await db.select({ emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, user.id)).limit(1);
    expect(updated?.emailVerifiedAt).toBeTruthy();
  });

  it('accepts repeated verification for an already verified account', async () => {
    const user = await createUser({ email: 'verified@example.com', verified: true });

    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ email: user.email, otp: '123456' })
      .expect(200);

    expect(response.body.data).toEqual({ verified: true });
  });

  it('rejects an unknown verification email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ email: 'missing@example.com', otp: '123456' })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_OTP');
  });

  it('rejects an expired OTP without incrementing attempts', async () => {
    const user = await createUser({ email: 'expired@example.com', verified: false });
    await db.insert(emailOtps).values({
      userId: user.id,
      codeHash: hashOtp('123456'),
      expiresAt: new Date(Date.now() - 1_000),
      attempts: 2,
      sentAt: new Date(Date.now() - 60_000)
    });

    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ email: user.email, otp: '123456' })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_OTP');
    expect((await otpRecord(user.id))?.attempts).toBe(2);
  });

  it('increments wrong OTP attempts and blocks at the maximum', async () => {
    const user = await createUser({ email: 'otp@example.com', verified: false });
    await db.insert(emailOtps).values({
      userId: user.id,
      codeHash: hashOtp(generateOtp()),
      expiresAt: new Date(Date.now() + 600_000),
      attempts: 0,
      sentAt: new Date()
    });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ email: user.email, otp: '000000' })
        .expect(400);
      expect(response.body.error.code).toBe('INVALID_OTP');
    }

    expect((await otpRecord(user.id))?.attempts).toBe(5);

    const blocked = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ email: user.email, otp: '123456' })
      .expect(400);
    expect(blocked.body.error.code).toBe('INVALID_OTP');
  });

  it('resends verification when cooldown has elapsed or no OTP exists', async () => {
    const user = await createUser({ email: 'resend@example.com', verified: false });

    const response = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: user.email })
      .expect(200);

    expect(response.body.data).toEqual({ sent: true });
    expect(await otpRecord(user.id)).toMatchObject({ attempts: 0 });
  });

  it('blocks resend during cooldown', async () => {
    const user = await createUser({ email: 'cooldown@example.com', verified: false });
    await db.insert(emailOtps).values({
      userId: user.id,
      codeHash: hashOtp('123456'),
      expiresAt: new Date(Date.now() + 600_000),
      attempts: 0,
      sentAt: new Date()
    });

    const response = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: user.email })
      .expect(429);

    expect(response.body.error.code).toBe('OTP_COOLDOWN');
    expect(response.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('rejects resend for a missing email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'missing@example.com' })
      .expect(404);

    expect(response.body.error.code).toBe('EMAIL_NOT_FOUND');
  });

  it('returns verified for resend on an already verified account', async () => {
    const user = await createUser({ email: 'already@example.com', verified: true });

    const response = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: user.email })
      .expect(200);

    expect(response.body.data).toEqual({ verified: true });
  });

  it('rejects invalid credentials', async () => {
    await createUser({ email: 'login@example.com', verified: true });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@example.com', password: 'WrongPass123!' })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects login until email is verified', async () => {
    await createUser({ email: 'unverified-login@example.com', verified: false });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'unverified-login@example.com', password: validPassword })
      .expect(403);

    expect(response.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('logs in with profile and selected tasks and reports setup complete', async () => {
    const user = await createUser({ email: 'complete@example.com', verified: true });
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
    await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${response.body.data.accessToken}`)
      .expect(200);
    expect(response.body.data.profile.businessName).toBe('Padosi Homes');
    expect(response.body.data.selectedTasks).toHaveLength(2);
    expect(response.body.data.setupComplete).toBe(true);
  });

  it('stores only a hash of the refresh token', async () => {
    const user = await createUser({ email: 'token-hash@example.com', verified: true });
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
    const user = await createUser({ email: 'token-rotation@example.com', verified: true });
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
    const user = await createUser({ email: 'token-logout@example.com', verified: true });
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
    const user = await createUser({ email: 'token-expired@example.com', verified: true });
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
    const user = await createUser({ email: 'incomplete@example.com', verified: true });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: validPassword })
      .expect(200);

    expect(response.body.data.profile).toBeNull();
    expect(response.body.data.selectedTasks).toEqual([]);
    expect(response.body.data.setupComplete).toBe(false);
  });

  it('returns selected tasks when logging in with a valid session', async () => {
    const user = await createUser({ email: 'session@example.com', verified: true });
    const id = await taskId('AC service visit');
    await selectTasks(user.id, [id]);

    const response = await request(app)
      .get('/api/v1/profile')
      .set(authHeader(user.id))
      .expect(200);

    expect(response.body.data.selectedTasks).toHaveLength(1);
  });
});
