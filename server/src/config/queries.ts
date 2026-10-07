import { query } from './db.ts';
import type { TaskRow, UserVerificationRow } from '../types/database.ts';

async function findUserByEmail(email: string) {
  const { rows: [user] } = await query<UserVerificationRow>(
    'SELECT id, email_verified_at FROM users WHERE email = $1',
    [email]
  );
  return user;
}

async function getSelectedTasks(userId: number) {
  const { rows } = await query<TaskRow>(`SELECT t.id, t.name, t.category, t.description
    FROM user_tasks ut JOIN tasks t ON t.id = ut.task_id
    WHERE ut.user_id = $1 ORDER BY t.category, t.name`, [userId]);
  return rows;
}

export { findUserByEmail, getSelectedTasks };
