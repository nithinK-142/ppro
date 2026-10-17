import { index, pgTable, serial, text } from 'drizzle-orm/pg-core';

export const tasks = pgTable('tasks', {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  category: text().notNull(),
  description: text().notNull()
}, (table) => [
  index('idx_tasks_category').on(table.category)
]);

export type TaskRow = Pick<typeof tasks.$inferSelect, 'id' | 'name' | 'category' | 'description'>;
