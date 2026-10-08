import 'dotenv/config';
import { beforeAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-abcdefghijklmnopqrstuvwxyz';
process.env.OTP_SECRET = 'test-otp-secret-abcdefghijklmnopqrstuvwxyz';
process.env.CLIENT_ORIGIN = 'http://localhost:8081';
process.env.LOG_LEVEL = 'silent';

beforeAll(async () => {
  const { initializeDatabase, db } = await import('../src/config/db.ts');
  const { tasks, userTasks, profiles, emailOtps, users } = await import('../src/config/schema.ts');
  const { seedTasks } = await import('../src/config/seed.ts');

  await initializeDatabase();
  await db.delete(userTasks);
  await db.delete(profiles);
  await db.delete(emailOtps);
  await db.delete(users);
  await db.delete(tasks);
  await seedTasks();
});
