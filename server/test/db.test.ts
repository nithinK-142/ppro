import { pingDatabase, query, transaction } from '../src/config/db.ts';
import { createUser } from './helpers.ts';

describe('database helpers', () => {
  it('pings the database successfully', async () => {
    expect(await pingDatabase()).toBe(true);
  });

  it('commits transaction changes', async () => {
    const user = await transaction(async (tx) => {
      const result = await tx<{ id: number; email: string }>(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        ['transaction@example.com', 'hash']
      );
      return result.rows[0];
    });

    expect(user?.email).toBe('transaction@example.com');
    const stored = await query<{ id: number }>('SELECT id FROM users WHERE email = $1', ['transaction@example.com']);
    expect(stored.rows).toHaveLength(1);
  });

  it('rolls back transaction changes when the callback throws', async () => {
    await expect(transaction(async (tx) => {
      await tx('INSERT INTO users (email, password_hash) VALUES ($1, $2)', ['rollback@example.com', 'hash']);
      throw new Error('rollback test');
    })).rejects.toThrow('rollback test');

    const stored = await query<{ id: number }>('SELECT id FROM users WHERE email = $1', ['rollback@example.com']);
    expect(stored.rows).toEqual([]);
  });

  it('cascades user cleanup to profile and selections', async () => {
    const user = await createUser({ email: 'cascade@example.com' });
    const task = await query<{ id: number }>('SELECT id FROM tasks LIMIT 1');
    const taskId = task.rows[0]?.id;
    if (!taskId) throw new Error('Task seed missing');

    await query('INSERT INTO profiles (user_id, name, mobile, address) VALUES ($1, $2, $3, $4)', [user.id, 'Test User', '+919876543210', 'Bangalore']);
    await query('INSERT INTO user_tasks (user_id, task_id) VALUES ($1, $2)', [user.id, taskId]);
    await query('DELETE FROM users WHERE id = $1', [user.id]);

    const profile = await query('SELECT 1 FROM profiles WHERE user_id = $1', [user.id]);
    const selection = await query('SELECT 1 FROM user_tasks WHERE user_id = $1', [user.id]);
    expect(profile.rows).toEqual([]);
    expect(selection.rows).toEqual([]);
  });
});
