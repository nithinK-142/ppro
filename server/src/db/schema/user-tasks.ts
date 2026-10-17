import { integer, pgTable, primaryKey, timestamp, index } from 'drizzle-orm/pg-core';
import { tasks } from './tasks.ts';
import { users } from './users.ts';

export const userTasks = pgTable('user_tasks', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
}, (table) => [
  primaryKey({ columns: [table.userId, table.taskId] }),
  index('idx_user_tasks_user_id').on(table.userId)
]);
