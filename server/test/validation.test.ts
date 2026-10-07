import request from 'supertest';
import app from '../src/app.ts';
import { authHeader, createUser } from './helpers.ts';

describe('request validation', () => {
  it('rejects registration with an invalid email', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'not-an-email',
      password: 'StrongPass123!',
      confirmPassword: 'StrongPass123!'
    }).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects short passwords and password mismatches', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'validation@example.com',
      password: 'short',
      confirmPassword: 'different'
    }).expect(400);

    expect(response.body.error.details).toMatchObject({ password: expect.any(Array), confirmPassword: expect.any(Array) });
  });

  it('rejects malformed OTP values', async () => {
    const response = await request(app).post('/api/v1/auth/verify-email').send({
      email: 'test@example.com',
      otp: '12ab'
    }).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty resend email', async () => {
    const response = await request(app).post('/api/v1/auth/resend-verification').send({ email: '' }).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects login without a password', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({ email: 'test@example.com' }).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects names that are too short after trimming', async () => {
    const user = await createUser({ email: 'name-validation@example.com' });
    const response = await request(app)
      .patch('/api/v1/profile')
      .set(authHeader(user.id))
      .send({ name: ' A ', mobile: '+919876543210', address: 'Bangalore', businessName: '' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid Indian mobile numbers', async () => {
    const user = await createUser({ email: 'mobile-validation@example.com' });
    const response = await request(app)
      .patch('/api/v1/profile')
      .set(authHeader(user.id))
      .send({ name: 'Valid Name', mobile: '9876543210', address: 'Bangalore', businessName: '' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects addresses outside the allowed length', async () => {
    const user = await createUser({ email: 'address-validation@example.com' });
    const response = await request(app)
      .patch('/api/v1/profile')
      .set(authHeader(user.id))
      .send({ name: 'Valid Name', mobile: '+919876543210', address: 'x'.repeat(301), businessName: '' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
