import request from 'supertest';
import app from '../src/app.ts';
import { asc } from 'drizzle-orm';
import { db } from '../src/config/db.ts';
import { tasks } from '../src/config/schema.ts';
import { authHeader, createUser, selectTasks, taskId } from './helpers.ts';

describe('tasks API', () => {
  it('uses the default page and limit when omitted', async () => {
    const response = await request(app).get('/api/v1/tasks').expect(200);
    expect(response.body.data).toHaveLength(20);
    expect(response.body.pagination).toEqual({ page: 1, limit: 20, total: 30, pages: 2 });
  });

  it('lists the seeded catalogue with pagination', async () => {
    const response = await request(app)
      .get('/api/v1/tasks')
      .query({ page: 1, limit: 2 })
      .expect(200);

    expect(response.body.data).toHaveLength(2);
    expect(response.body.pagination).toEqual({ page: 1, limit: 2, total: 30, pages: 15 });
  });

  it('searches task names and descriptions case-insensitively', async () => {
    const response = await request(app)
      .get('/api/v1/tasks')
      .query({ search: 'doctor' })
      .expect(200);

    expect(response.body.data.map((task: { name: string }) => task.name)).toEqual([
      'Doctor appointment',
      'Doctor visit accompaniment'
    ]);
    expect(response.body.pagination.total).toBe(2);
  });

  it('filters by category', async () => {
    const response = await request(app)
      .get('/api/v1/tasks')
      .query({ category: 'Home Services' })
      .expect(200);

    expect(response.body.data).toHaveLength(5);
    expect(response.body.data.every((task: { category: string }) => task.category === 'Home Services')).toBe(true);
  });

  it('combines search and category filters', async () => {
    const response = await request(app)
      .get('/api/v1/tasks')
      .query({ search: 'service', category: 'Home Services' })
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe('AC service visit');
  });

  it('returns an empty page beyond the available results', async () => {
    const response = await request(app)
      .get('/api/v1/tasks')
      .query({ page: 1000, limit: 50 })
      .expect(200);

    expect(response.body.data).toEqual([]);
    expect(response.body.pagination.total).toBe(30);
    expect(response.body.pagination.pages).toBe(1);
  });

  it('rejects invalid query parameters', async () => {
    const response = await request(app)
      .get('/api/v1/tasks')
      .query({ page: 0, limit: 51, category: 'Invalid Category' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an oversized search query', async () => {
    const response = await request(app)
      .get('/api/v1/tasks')
      .query({ search: 'x'.repeat(61) })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication for selected tasks', async () => {
    const response = await request(app)
      .get('/api/v1/tasks/selected')
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns selected tasks in deterministic order', async () => {
    const user = await createUser({ email: 'selected@example.com' });
    const ids = await Promise.all([taskId('Doctor appointment'), taskId('AC service visit')]);
    await selectTasks(user.id, ids);

    const response = await request(app)
      .get('/api/v1/tasks/selected')
      .set(authHeader(user.id))
      .expect(200);

    expect(response.body.data.map((task: { name: string }) => task.name)).toEqual([
      'Doctor appointment',
      'AC service visit'
    ]);
  });

  it('replaces an existing selection atomically', async () => {
    const user = await createUser({ email: 'save-selection@example.com' });
    const first = await taskId('AC service visit');
    const second = await taskId('Doctor appointment');
    await selectTasks(user.id, [first]);

    const response = await request(app)
      .put('/api/v1/tasks/selected')
      .set(authHeader(user.id))
      .send({ taskIds: [second] })
      .expect(200);

    expect(response.body.data.map((task: { name: string }) => task.name)).toEqual(['Doctor appointment']);
  });

  it('accepts up to 30 selected tasks', async () => {
    const user = await createUser({ email: 'max-selection@example.com' });
    const result = await db.select({ id: tasks.id }).from(tasks).orderBy(asc(tasks.id)).limit(30);
    const ids = result.map((row) => row.id);

    const response = await request(app)
      .put('/api/v1/tasks/selected')
      .set(authHeader(user.id))
      .send({ taskIds: ids })
      .expect(200);

    expect(response.body.data).toHaveLength(30);
  });

  it('rejects empty and oversized selections', async () => {
    const user = await createUser({ email: 'selection-validation@example.com' });

    const empty = await request(app)
      .put('/api/v1/tasks/selected')
      .set(authHeader(user.id))
      .send({ taskIds: [] })
      .expect(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const oversized = await request(app)
      .put('/api/v1/tasks/selected')
      .set(authHeader(user.id))
      .send({ taskIds: Array.from({ length: 31 }, (_, index) => index + 1) })
      .expect(400);
    expect(oversized.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication to save selected tasks', async () => {
    const response = await request(app)
      .put('/api/v1/tasks/selected')
      .send({ taskIds: [1] })
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a selection containing a missing task', async () => {
    const user = await createUser({ email: 'missing-task@example.com' });
    const existing = await taskId('AC service visit');

    await selectTasks(user.id, [existing]);

    const response = await request(app)
      .put('/api/v1/tasks/selected')
      .set(authHeader(user.id))
      .send({ taskIds: [existing, 999999999] })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_TASK');
    const selected = await request(app).get('/api/v1/tasks/selected').set(authHeader(user.id)).expect(200);
    expect(selected.body.data).toHaveLength(1);
    expect(selected.body.data[0].name).toBe('AC service visit');
  });

  it('rejects duplicate task ids instead of creating duplicate selections', async () => {
    const user = await createUser({ email: 'duplicate-task@example.com' });
    const id = await taskId('AC service visit');

    const response = await request(app)
      .put('/api/v1/tasks/selected')
      .set(authHeader(user.id))
      .send({ taskIds: [id, id] })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_TASK');
  });
});
