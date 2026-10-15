import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.ts';
import env from '../src/config/env.ts';
import { normalizeDatabaseCommand } from '../src/observability/metrics.ts';

describe('observability', () => {
  it('normalizes database commands without retaining SQL text', () => {
    expect(normalizeDatabaseCommand("SELECT email FROM users WHERE email = 'private@example.com'")).toBe('select');
    expect(normalizeDatabaseCommand('WITH private_data AS (SELECT 1) SELECT * FROM private_data')).toBe('other');
    expect(normalizeDatabaseCommand('DROP TABLE users')).toBe('drop');
  });

  it('protects the metrics endpoint with a bearer token', async () => {
    await request(app).get('/metrics').expect(401);
    await request(app).get('/metrics').set('Authorization', 'Bearer invalid-token').expect(401);

    // Generate one request sample; /metrics scrapes are intentionally excluded.
    await request(app).get('/health/live').expect(200);

    const response = await request(app)
      .get('/metrics')
      .set('Authorization', `Bearer ${env.METRICS_TOKEN}`)
      .expect(200);

    expect(response.text).toContain('padosipro_process_memory_bytes');
    expect(response.text).toContain('padosipro_http_request_duration_seconds_bucket');
    expect(response.text).not.toContain('route="/metrics"');
  });

  it('uses route templates for rejected requests and excludes raw query values', async () => {
    await request(app).get('/api/v1/tasks/selected').expect(401);
    await request(app).get('/private-path?email=private-user@example.com').expect(404);

    const response = await request(app)
      .get('/metrics')
      .set('Authorization', `Bearer ${env.METRICS_TOKEN}`)
      .expect(200);

    expect(response.text).toContain('route="/api/v1/tasks/selected"');
    expect(response.text).toContain('route="unmatched"');
    expect(response.text).not.toContain('private-user@example.com');
    expect(response.text).not.toContain('/private-path');
  });
});
