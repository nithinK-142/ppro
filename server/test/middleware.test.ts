import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app.ts';
import env from '../src/config/env.ts';
import { authHeader, createUser } from './helpers.ts';

describe('middleware and error handling', () => {
  it('preserves a valid incoming request id', async () => {
    const requestId = 'client-request_123';
    const response = await request(app).get('/health/live').set('X-Request-Id', requestId).expect(200);
    expect(response.headers['x-request-id']).toBe(requestId);
  });

  it('replaces an invalid incoming request id', async () => {
    const response = await request(app).get('/health/live').set('X-Request-Id', 'bad id with spaces').expect(200);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('returns a structured not-found error', async () => {
    const response = await request(app).get('/api/v1/does-not-exist').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });

  it('rejects malformed JSON', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_JSON');
  });

  it('rejects request bodies larger than the configured limit', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'large@example.com', password: 'StrongPass123!', confirmPassword: 'StrongPass123!', extra: 'x'.repeat(21_000) }))
      .expect(413);

    expect(response.body.error.code).toBe('REQUEST_TOO_LARGE');
  });

  it('rejects missing bearer authentication', async () => {
    const response = await request(app).get('/api/v1/tasks/selected').expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects malformed bearer tokens', async () => {
    const response = await request(app)
      .get('/api/v1/tasks/selected')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects expired bearer tokens', async () => {
    const token = jwt.sign({ sub: 1 }, env.JWT_SECRET, { expiresIn: -1 });
    const response = await request(app)
      .get('/api/v1/tasks/selected')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects non-numeric token subjects', async () => {
    const token = jwt.sign({ sub: 'abc' }, env.JWT_SECRET, { expiresIn: '15m' });
    const response = await request(app)
      .get('/api/v1/tasks/selected')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });

  it('accepts a valid bearer token', async () => {
    const user = await createUser({ email: 'auth-middleware@example.com' });
    const response = await request(app)
      .get('/api/v1/tasks/selected')
      .set(authHeader(user.id))
      .expect(200);

    expect(response.body.data).toEqual([]);
  });

  it('allows the configured client origin through CORS', async () => {
    const response = await request(app)
      .get('/health/live')
      .set('Origin', 'http://localhost:8081')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8081');
  });

  it('includes security headers', async () => {
    const response = await request(app).get('/health/live').expect(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('enforces the authentication account rate limit', async () => {
    const email = 'rate-limit@example.com';
    for (let attempt = 1; attempt <= 15; attempt += 1) {
      await request(app).post('/api/v1/auth/login').send({ email, password: 'WrongPass123!' });
    }

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPass123!' })
      .expect(429);

    expect(response.headers['ratelimit']).toBeTruthy();
  });
});
