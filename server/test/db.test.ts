import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pingDatabase } from '../src/config/db.ts';
import { profiles, tasks, userTasks, users } from '../src/config/schema.ts';

const email = `transaction-${Date.now()}@example.com`;

describe('database helpers', () => {
  it('pings the database successfully', async () => {
    await expect(pingDatabase()).resolves.toBe(true);
  });

  it('commits transaction changes', async () => {
    const [user] = await db.insert(users).values({ email, passwordHash: 'hash' }).returning({ id: users.id });
    expect(user?.id).toBeTypeOf('number');

    const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    expect(rows).toHaveLength(1);

    await db.delete(users).where(eq(users.email, email));
  });

  it('rolls back transaction changes when the callback throws', async () => {
    const transactionEmail = `rollback-${Date.now()}@example.com`;

    await expect(db.transaction(async (tx) => {
      await tx.insert(users).values({ email: transactionEmail, passwordHash: 'hash' });
      throw new Error('rollback');
    })).rejects.toThrow('rollback');

    const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, transactionEmail));
    expect(rows).toHaveLength(0);
  });

  it('cascades user cleanup to profile and selections', async () => {
    const [user] = await db.insert(users).values({ email: `cascade-${Date.now()}@example.com`, passwordHash: 'hash' }).returning({ id: users.id });
    const [task] = await db.select({ id: tasks.id }).limit(1);
    if (!user || !task) throw new Error('Failed to prepare cascade test');

    await db.insert(profiles).values({ userId: user.id, name: 'Test User', mobile: '+919876543210', address: 'Bangalore' });
    await db.insert(userTasks).values({ userId: user.id, taskId: task.id });
    await db.delete(users).where(eq(users.id, user.id));

    const profile = await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.userId, user.id));
    const selection = await db.select({ userId: userTasks.userId }).from(userTasks).where(eq(userTasks.userId, user.id));
    expect(profile).toHaveLength(0);
    expect(selection).toHaveLength(0);
  });
});
