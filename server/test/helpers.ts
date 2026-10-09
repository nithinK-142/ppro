import { beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../src/config/db.ts';
import { emailOtps, profiles, tasks, userTasks, users } from '../src/config/schema.ts';
import env from '../src/config/env.ts';

type UserOptions = {
  email: string;
  password?: string;
  verified?: boolean;
};

async function resetUserData() {
  await db.delete(userTasks);
  await db.delete(profiles);
  await db.delete(emailOtps);
  await db.delete(users);
}

async function createUser({ email, password = 'StrongPass123!', verified = true }: UserOptions) {
  const passwordHash = await bcrypt.hash(password, 4);
  const [user] = await db.insert(users).values({
    email,
    passwordHash,
    emailVerifiedAt: verified ? new Date() : null
  }).returning({ id: users.id, email: users.email, emailVerifiedAt: users.emailVerifiedAt });
  if (!user) throw new Error('Failed to create test user');
  return { ...user, password };
}

async function createProfile(userId: number, overrides: Partial<{ name: string; mobile: string; address: string; businessName: string | null }> = {}) {
  const profile = {
    name: 'Nithin Kumar',
    mobile: '+919876543210',
    address: 'Bangalore, Karnataka',
    businessName: 'Padosi Homes',
    ...overrides
  };

  await db.insert(profiles).values({ userId, ...profile });
  return profile;
}

async function taskId(name: string) {
  const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.name, name)).limit(1);
  if (!task) throw new Error(`Task not found: ${name}`);
  return task.id;
}

async function selectTasks(userId: number, ids: number[]) {
  if (!ids.length) return;
  await db.insert(userTasks).values(ids.map((taskId) => ({ userId, taskId })));
}

function authToken(userId: number) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '15m' });
}

function authHeader(userId: number) {
  return { Authorization: `Bearer ${authToken(userId)}` };
}

async function otpRecord(userId: number) {
  const [record] = await db.select({
    codeHash: emailOtps.codeHash,
    expiresAt: emailOtps.expiresAt,
    attempts: emailOtps.attempts,
    sentAt: emailOtps.sentAt
  }).from(emailOtps).where(eq(emailOtps.userId, userId)).limit(1);
  return record ?? null;
}

async function verifiedUser(email = `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`) {
  return createUser({ email, verified: true });
}

beforeEach(async () => {
  await resetUserData();
});


export { resetUserData, createUser, createProfile, taskId, selectTasks, authToken, authHeader, otpRecord, verifiedUser };
