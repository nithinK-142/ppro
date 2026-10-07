import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../src/config/db.ts';
import env from '../src/config/env.ts';
import type { QueryResultRow } from '@neondatabase/serverless';

type UserOptions = {
  email: string;
  password?: string;
  verified?: boolean;
};

async function resetUserData() {
  await query('DELETE FROM user_tasks');
  await query('DELETE FROM profiles');
  await query('DELETE FROM email_otps');
  await query('DELETE FROM users');
}

async function createUser({ email, password = 'StrongPass123!', verified = true }: UserOptions) {
  const passwordHash = await bcrypt.hash(password, 4);
  const result = await query<QueryResultRow & { id: number; email: string; email_verified_at: string | null }>(
    'INSERT INTO users (email, password_hash, email_verified_at) VALUES ($1, $2, $3) RETURNING id, email, email_verified_at',
    [email, passwordHash, verified ? new Date().toISOString() : null]
  );
  const user = result.rows[0];
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

  await query(
    `INSERT INTO profiles (user_id, name, mobile, address, business_name)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, profile.name, profile.mobile, profile.address, profile.businessName]
  );

  return profile;
}

async function taskId(name: string) {
  const result = await query<QueryResultRow & { id: number }>('SELECT id FROM tasks WHERE name = $1', [name]);
  const task = result.rows[0];
  if (!task) throw new Error(`Task not found: ${name}`);
  return task.id;
}

async function selectTasks(userId: number, ids: number[]) {
  for (const id of ids) {
    await query('INSERT INTO user_tasks (user_id, task_id) VALUES ($1, $2)', [userId, id]);
  }
}

function authToken(userId: number) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '15m' });
}

function authHeader(userId: number) {
  return { Authorization: `Bearer ${authToken(userId)}` };
}

async function otpRecord(userId: number) {
  const result = await query<QueryResultRow & {
    code_hash: string;
    expires_at: string;
    attempts: number;
    sent_at: string;
  }>('SELECT code_hash, expires_at, attempts, sent_at FROM email_otps WHERE user_id = $1', [userId]);
  return result.rows[0] ?? null;
}

async function verifiedUser(email = `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`) {
  return createUser({ email, verified: true });
}

beforeEach(async () => {
  await resetUserData();
});

export { resetUserData, createUser, createProfile, taskId, selectTasks, authToken, authHeader, otpRecord, verifiedUser };
