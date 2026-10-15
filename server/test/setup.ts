import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll } from 'vitest';

const testEnvPath = fileURLToPath(new URL('../.env.test', import.meta.url));
const appEnvPath = fileURLToPath(new URL('../.env', import.meta.url));

if (!existsSync(testEnvPath)) {
  throw new Error('Missing server/.env.test. Copy .env.test.example to .env.test and configure a disposable PostgreSQL database.');
}

const testEnv = dotenv.parse(readFileSync(testEnvPath));
const requiredTestKeys = [
  'NODE_ENV',
  'DATABASE_URL',
  'JWT_SECRET',
  'OTP_SECRET',
  'MAILJET_API_KEY',
  'MAILJET_SECRET_KEY',
  'MAIL_FROM_EMAIL',
  'METRICS_TOKEN'
];
const missingTestKeys = requiredTestKeys.filter((key) => !testEnv[key]?.trim());

if (missingTestKeys.length > 0) {
  throw new Error(`Missing required values in server/.env.test: ${missingTestKeys.join(', ')}.`);
}
if (testEnv.NODE_ENV !== 'test') {
  throw new Error('Set NODE_ENV=test in server/.env.test.');
}

dotenv.config({ path: testEnvPath, override: true });
const testDatabaseUrl = testEnv.DATABASE_URL;

function sameDatabase(left: string, right: string): boolean {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return a.protocol === b.protocol && a.hostname === b.hostname && a.port === b.port && a.pathname === b.pathname;
  } catch {
    return left === right;
  }
}

if (existsSync(appEnvPath)) {
  const appEnv = dotenv.parse(readFileSync(appEnvPath));
  if (appEnv.DATABASE_URL && sameDatabase(testDatabaseUrl, appEnv.DATABASE_URL)) {
    throw new Error('server/.env.test must use a different database from server/.env. Tests delete and reseed tables.');
  }
}

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
