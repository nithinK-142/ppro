import { index, integer, pgTable, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.ts';

export const emailOtps = pgTable('email_otps', {
  userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  attempts: integer().notNull().default(0),
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }).notNull()
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: serial().primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  familyId: uuid('family_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
  replacedByHash: text('replaced_by_hash'),
  rotationAttemptId: text('rotation_attempt_id'),
  rotationResponse: text('rotation_response'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
}, (table) => [
  index('idx_refresh_tokens_user_id').on(table.userId),
  index('idx_refresh_tokens_family_id').on(table.familyId),
  index('idx_refresh_tokens_expires_at').on(table.expiresAt)
]);
