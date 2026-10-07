import request from 'supertest';
import app from '../src/app.ts';
import { query } from '../src/config/db.ts';
import { generateOtp, hashOtp } from '../src/utils/otp.ts';
import { authHeader, createProfile, createUser, otpRecord, selectTasks, taskId } from './helpers.ts';
import type { QueryResultRow } from '@neondatabase/serverless';

const validPassword = 'StrongPass123!';

describe('authentication', () => {
  it('registers a normalized email and creates an OTP record', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: ' TEST@EXAMPLE.COM ', password: validPassword, confirmPassword: validPassword })
      .expect(201);

    expect(response.body.data.email).toBe('test@example.com');
    expect(response.body.data.verificationRequired).toBe(true);

    const user = await query<QueryResultRow & { email: string }>('SELECT email FROM users WHERE id = $1', [response.body.data.userId]);
    expect(user.rows[0]?.email).toBe('test@example.com');

    const otp = await otpRecord(response.body.data.userId);
    expect(otp).toMatchObject({ attempts: 0 });
    expect(otp?.code_hash).toHaveLength(64);
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
    await query(
      'INSERT INTO email_otps (user_id, code_hash, expires_at, attempts, sent_at) VALUES ($1, $2, $3, 0, $4)',
      [user.id, hashOtp(code), new Date(Date.now() + 600_000).toISOString(), new Date().toISOString()]
    );

    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ email: user.email, otp: code })
      .expect(200);

    expect(response.body.data.verified).toBe(true);
    expect(await otpRecord(user.id)).toBeNull();

    const updated = await query<QueryResultRow & { email_verified_at: string | null }>('SELECT email_verified_at FROM users WHERE id = $1', [user.id]);
    expect(updated.rows[0]?.email_verified_at).toBeTruthy();
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
    await query(
      'INSERT INTO email_otps (user_id, code_hash, expires_at, attempts, sent_at) VALUES ($1, $2, $3, 2, $4)',
      [user.id, hashOtp('123456'), new Date(Date.now() - 1_000).toISOString(), new Date(Date.now() - 60_000).toISOString()]
    );

    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ email: user.email, otp: '123456' })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_OTP');
    expect((await otpRecord(user.id))?.attempts).toBe(2);
  });

  it('increments wrong OTP attempts and blocks at the maximum', async () => {
    const user = await createUser({ email: 'otp@example.com', verified: false });
    await query(
      'INSERT INTO email_otps (user_id, code_hash, expires_at, attempts, sent_at) VALUES ($1, $2, $3, 0, $4)',
      [user.id, hashOtp(generateOtp()), new Date(Date.now() + 600_000).toISOString(), new Date().toISOString()]
    );

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
    await query(
      'INSERT INTO email_otps (user_id, code_hash, expires_at, attempts, sent_at) VALUES ($1, $2, $3, 0, $4)',
      [user.id, hashOtp('123456'), new Date(Date.now() + 600_000).toISOString(), new Date().toISOString()]
    );

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

    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user.email).toBe(user.email);
    expect(response.body.data.profile.businessName).toBe('Padosi Homes');
    expect(response.body.data.selectedTasks).toHaveLength(2);
    expect(response.body.data.setupComplete).toBe(true);
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
