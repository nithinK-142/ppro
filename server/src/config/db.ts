import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client, Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import env from './env.ts';
import logger from '../utils/logger.ts';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS
});

pool.on('error', (error) => {
  logger.error({ err: error }, 'unexpected error from an idle PostgreSQL pool client');
});

const db = drizzle(pool);
let initializePromise: Promise<void> | undefined;

async function initializeDatabase() {
  if (!initializePromise) {
    initializePromise = (async () => {
      const client = new Client({
        connectionString: env.DATABASE_URL,
        connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS
      });
      let connected = false;

      try {
        await client.connect();
        connected = true;

        const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await client.query(schema);
      } finally {
        if (connected) await client.end();
      }
    })().catch((error: unknown) => {
      initializePromise = undefined;
      throw error;
    });
  }

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
