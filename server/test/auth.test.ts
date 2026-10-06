import './setup.ts';
import request from 'supertest';
import app from '../src/app.ts';
import { db } from '../src/db/index.ts';
import { generateOtp, hashOtp } from '../src/utils/otp.ts';
import type { QueryResultRow } from '@neondatabase/serverless';

beforeEach(async () => {
  await db.run('DELETE FROM user_tasks');
  await db.run('DELETE FROM profiles');
  await db.run('DELETE FROM email_otps');
  await db.run('DELETE FROM users');
});

describe('authentication rules', () => {
  it('rejects login until the email is verified', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'test@example.com',
      password: 'StrongPass123!',
      confirmPassword: 'StrongPass123!'
    }).expect(201);

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'test@example.com',
      password: 'StrongPass123!'
    }).expect(403);

    expect(response.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('blocks the fifth wrong OTP attempt', async () => {
    const result = await db.get<QueryResultRow & { id: number }>('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id', ['otp@example.com', 'hash']);
    const userId = result.id;
    await db.run('INSERT INTO email_otps (user_id, code_hash, expires_at, attempts, sent_at) VALUES ($1, $2, $3, 0, $4)', [
      userId,
      hashOtp(generateOtp()),
      new Date(Date.now() + 600_000).toISOString(),
      new Date().toISOString()
    ]);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await request(app).post('/api/v1/auth/verify-email').send({
        email: 'otp@example.com',
        otp: '000000'
      }).expect(400);
      expect(response.body.error.code).toBe('INVALID_OTP');
    }

    const stored = await db.get<QueryResultRow & { attempts: number }>('SELECT attempts FROM email_otps WHERE user_id = $1', [userId]);
    if (!stored) throw new Error('OTP record was not found');
    expect(stored.attempts).toBe(5);
  });
});
