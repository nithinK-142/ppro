import request from 'supertest';
import app from '../src/app.ts';
import { eq } from 'drizzle-orm';
import { db } from '../src/config/db.ts';
import { users } from '../src/config/schema.ts';
import { authHeader, createProfile, createUser, selectTasks, taskId } from './helpers.ts';

describe('profile API', () => {
  it('requires authentication to read the profile', async () => {
    const response = await request(app).get('/api/v1/profile').expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns a user with no profile and no selected tasks', async () => {
    const user = await createUser({ email: 'empty-profile@example.com' });

    const response = await request(app)
      .get('/api/v1/profile')
      .set(authHeader(user.id))
      .expect(200);

    expect(response.body.data.user.email).toBe(user.email);
    expect(response.body.data.profile).toBeNull();
    expect(response.body.data.selectedTasks).toEqual([]);
    expect(response.body.data.setupComplete).toBe(false);
  });

  it('returns profile and selected tasks for a complete setup', async () => {
    const user = await createUser({ email: 'profile@example.com' });
    await createProfile(user.id);
    const ids = await Promise.all([taskId('AC service visit'), taskId('Doctor appointment')]);
    await selectTasks(user.id, ids);

    const response = await request(app)
      .get('/api/v1/profile')
      .set(authHeader(user.id))
      .expect(200);

    expect(response.body.data.profile).toMatchObject({
      name: 'Nithin Kumar',
      mobile: '+919876543210',
      address: 'Bangalore, Karnataka',
      businessName: 'Padosi Homes'
    });
    expect(response.body.data.selectedTasks).toHaveLength(2);
    expect(response.body.data.setupComplete).toBe(true);
  });

  it('returns unauthorized when the token belongs to a deleted user', async () => {
    const user = await createUser({ email: 'deleted@example.com' });
    await db.delete(users).where(eq(users.id, user.id));

    const response = await request(app)
      .get('/api/v1/profile')
      .set(authHeader(user.id))
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('creates a profile and stores an empty business name as null', async () => {
    const user = await createUser({ email: 'create-profile@example.com' });

    const response = await request(app)
      .patch('/api/v1/profile')
      .set(authHeader(user.id))
      .send({
        name: 'Nithin Kumar',
        mobile: '+919876543210',
        address: 'Bangalore, Karnataka',
        businessName: ''
      })
      .expect(200);

    expect(response.body.data.businessName).toBeNull();
    expect(response.body.data.name).toBe('Nithin Kumar');
  });

  it('updates an existing profile', async () => {
    const user = await createUser({ email: 'update-profile@example.com' });
    await createProfile(user.id);

    const response = await request(app)
      .patch('/api/v1/profile')
      .set(authHeader(user.id))
      .send({
        name: 'Updated Name',
        mobile: '+919999999999',
        address: 'Updated Bangalore Address',
        businessName: 'Updated Home'
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      name: 'Updated Name',
      mobile: '+919999999999',
      address: 'Updated Bangalore Address',
      businessName: 'Updated Home'
    });
  });

  it('rejects invalid profile data', async () => {
    const user = await createUser({ email: 'invalid-profile@example.com' });

    const response = await request(app)
      .patch('/api/v1/profile')
      .set(authHeader(user.id))
      .send({
        name: 'A',
        mobile: '9876543210',
        address: 'abc',
        businessName: 'X'.repeat(121)
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toMatchObject({
      name: expect.any(Array),
      mobile: expect.any(Array),
      address: expect.any(Array),
      businessName: expect.any(Array)
    });
  });
});
