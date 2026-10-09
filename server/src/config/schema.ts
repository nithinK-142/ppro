import { integer, pgTable, primaryKey, serial, text, timestamp, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial().primaryKey(),
  email: text().notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
});

export const emailOtps = pgTable('email_otps', {
  userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  attempts: integer().notNull().default(0),
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }).notNull()
});

export const profiles = pgTable('profiles', {
  userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  mobile: text().notNull(),
  address: text().notNull(),
  businessName: text('business_name'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
});

export const tasks = pgTable('tasks', {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  category: text().notNull(),
  description: text().notNull()
}, (table) => [
  index('idx_tasks_category').on(table.category),
  index('idx_tasks_name').on(table.name)
]);

export const userTasks = pgTable('user_tasks', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
}, (table) => [
  primaryKey({ columns: [table.userId, table.taskId] }),
  index('idx_user_tasks_user_id').on(table.userId)
]);

export type TaskRow = Pick<typeof tasks.$inferSelect, 'id' | 'name' | 'category' | 'description'>;
export type ProfileRow = typeof profiles.$inferSelect;
export type UserRow = typeof users.$inferSelect;
