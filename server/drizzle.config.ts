import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './src/db/schema/auth.ts',
    './src/db/schema/profiles.ts',
    './src/db/schema/tasks.ts',
    './src/db/schema/user-tasks.ts',
    './src/db/schema/users.ts'
  ],
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
});
