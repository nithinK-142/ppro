import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client, Pool } from '@neondatabase/serverless';
import type { QueryResult, QueryResultRow } from '@neondatabase/serverless';
import env from '../config/env.ts';
import type { QueryParameter, QueryParameters } from '../types/database.ts';

const pool = new Pool({ connectionString: env.DATABASE_URL });
let initializePromise: Promise<void> | undefined;

async function initializeDatabase() {
  if (!initializePromise) {
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
  }

  return initializePromise;
}

type QueryExecutor = {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, params?: QueryParameters): Promise<QueryResult<Row>>;
};

async function query<Row extends QueryResultRow = QueryResultRow>(text: string, params: QueryParameters = []) {
  await initializeDatabase();
  return pool.query<Row>(text, [...params]);
}

function createQueryApi(executor: QueryExecutor) {
  return {
    async get<Row extends QueryResultRow = QueryResultRow>(text: string, params: QueryParameters = []): Promise<Row | undefined> {
      const result = await executor.query<Row>(text, params);
      return result.rows[0];
    },
    async all<Row extends QueryResultRow = QueryResultRow>(text: string, params: QueryParameters = []): Promise<Row[]> {
      const result = await executor.query<Row>(text, params);
      return result.rows;
    },
    async run(text: string, params: QueryParameters = []): Promise<QueryResult<QueryResultRow>> {
      return executor.query(text, params);
    }
  };
}

const db = createQueryApi({ query });
type QueryApi = typeof db;

async function transaction<T>(callback: (tx: QueryApi) => Promise<T>) {
  await initializeDatabase();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const tx = createQueryApi(client);
    const result = await callback(tx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function pingDatabase() {
  try {
    await initializeDatabase();
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

async function closeDatabase() {
  await pool.end();
}

export { db, transaction, pingDatabase, initializeDatabase, closeDatabase };
export type { QueryParameter };
