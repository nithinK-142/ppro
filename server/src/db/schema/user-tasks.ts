import { integer, pgTable, primaryKey, timestamp } from 'drizzle-orm/pg-core';
import { tasks } from './tasks.ts';
import { users } from './users.ts';

export const userTasks = pgTable('user_tasks', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
}, (table) => [
  primaryKey({ columns: [table.userId, table.taskId] })
]);
