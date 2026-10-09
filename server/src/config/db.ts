import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import env from './env.ts';

const pool = new Pool({ connectionString: env.DATABASE_URL });
const db = drizzle({ client: pool });
let initializePromise: Promise<void> | undefined;

async function initializeDatabase() {
  if (initializePromise) return initializePromise;

  initializePromise = (async () => {
    const client = new Client(env.DATABASE_URL);
    await client.connect();

    try {
      const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schema);
    } finally {
      await client.end();
    }
  })();

  return initializePromise;
}

async function pingDatabase() {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

async function closeDatabase() {
  await pool.end();
}

export { db, initializeDatabase, pingDatabase, closeDatabase };
