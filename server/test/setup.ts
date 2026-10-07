import 'dotenv/config';
import { beforeAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-abcdefghijklmnopqrstuvwxyz';
process.env.OTP_SECRET = 'test-otp-secret-abcdefghijklmnopqrstuvwxyz';
process.env.CLIENT_ORIGIN = 'http://localhost:8081';
process.env.LOG_LEVEL = 'silent';

beforeAll(async () => {
  const { initializeDatabase, query } = await import('../src/config/db.ts');
  const { seedTasks } = await import('../src/config/seed.ts');

  await initializeDatabase();
  await query('DELETE FROM user_tasks');
  await query('DELETE FROM profiles');
  await query('DELETE FROM email_otps');
  await query('DELETE FROM users');
  await query('DELETE FROM tasks');
  await seedTasks();
});
