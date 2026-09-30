require('./setup');

const { beforeEach, describe, expect, it } = require('vitest');
const request = require('supertest');
const app = require('../src/app');
const { db } = require('../src/db');
const { generateOtp, hashOtp } = require('../src/utils/otp');

beforeEach(() => {
  db.exec('DELETE FROM user_tasks; DELETE FROM profiles; DELETE FROM email_otps; DELETE FROM users;');
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
    const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run('otp@example.com', 'hash');
    const userId = Number(result.lastInsertRowid);
    db.prepare('INSERT INTO email_otps (user_id, code_hash, expires_at, attempts, sent_at) VALUES (?, ?, ?, 0, ?)')
      .run(userId, hashOtp(generateOtp()), new Date(Date.now() + 600_000).toISOString(), new Date().toISOString());

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await request(app).post('/api/v1/auth/verify-email').send({
        email: 'otp@example.com',
        otp: '000000'
      }).expect(400);
      expect(response.body.error.code).toBe('INVALID_OTP');
    }

    const stored = db.prepare('SELECT attempts FROM email_otps WHERE user_id = ?').get(userId);
    expect(stored.attempts).toBe(5);
  });
});
