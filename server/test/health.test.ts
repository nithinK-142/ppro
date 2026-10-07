import request from 'supertest';
import app from '../src/app.ts';

describe('health endpoints', () => {
  it('reports liveness', async () => {
    await request(app).get('/health/live').expect(200, { status: 'ok' });
  });

  it('reports database readiness when the database is reachable', async () => {
    await request(app).get('/health/ready').expect(200, { status: 'ok' });
  });
});
