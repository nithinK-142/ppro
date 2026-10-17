import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.ts';

export const profiles = pgTable('profiles', {
  userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  mobile: text().notNull(),
  address: text().notNull(),
  businessName: text('business_name'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
});

export type ProfileRow = typeof profiles.$inferSelect;
