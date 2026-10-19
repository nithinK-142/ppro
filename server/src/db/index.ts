import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import type { PoolClient } from 'pg';
import { normalizeDatabaseCommand, observeDatabaseQuery } from '../observability/metrics.ts';
import { finishSpan, runInParentSpanContext, runInSpanContext, startDatabaseSpan } from '../observability/tracing.ts';
import { performance } from 'node:perf_hooks';
import env from '../config/env.ts';
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

function instrumentQueries(client: PoolClient): void {
  const instrumentedClient = client as unknown as { query: (...args: unknown[]) => unknown };
  const originalQuery = instrumentedClient.query.bind(client);

  instrumentedClient.query = (...args: unknown[]) => {
    const command = normalizeDatabaseCommand(args[0]);
    const started = performance.now();
    const span = startDatabaseSpan(command);
    let recorded = false;
    const record = (error?: unknown) => {
      if (recorded) return;
      recorded = true;
      observeDatabaseQuery(command, (performance.now() - started) / 1000, Boolean(error));
      finishSpan(span, error ? { 'error.type': error instanceof Error ? error.name : 'Error' } : {}, Boolean(error));
    };

    const callbackIndex = args.map((value) => typeof value === 'function').lastIndexOf(true);
    if (callbackIndex >= 0) {
      const callback = args[callbackIndex] as (...callbackArgs: unknown[]) => unknown;
      args[callbackIndex] = (...callbackArgs: unknown[]) => {
        record(callbackArgs[0]);
        return runInParentSpanContext(span, () => callback(...callbackArgs));
      };
      return runInSpanContext(span, () => originalQuery(...args));
    }

    const result = runInSpanContext(span, () => originalQuery(...args));
    if (result && typeof result === 'object' && 'then' in result && typeof result.then === 'function') {
      return Promise.resolve(result).then(
        (value) => { record(); return value; },
        (error: unknown) => { record(error); throw error; }
      );
    }

    if (result && typeof result === 'object' && 'once' in result && typeof result.once === 'function') {
      const query = result as { once: (event: string, listener: (error?: unknown) => void) => unknown };
      query.once('end', () => record());
      query.once('error', (error) => record(error));
    }
    return result;
  };
}

if (env.OBSERVABILITY_ENABLED) pool.on('connect', instrumentQueries);

const db = drizzle(pool);
let initializePromise: Promise<void> | undefined;

async function initializeDatabase() {
  if (!initializePromise) {
    initializePromise = migrate(db, {
      migrationsFolder: fileURLToPath(new URL('../../drizzle/', import.meta.url))
    }).catch((error: unknown) => {
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
