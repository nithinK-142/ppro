const fs = require('node:fs');
const path = require('node:path');
const { neon, Client } = require('@neondatabase/serverless');
const env = require('../config/env');

const sql = neon(env.DATABASE_URL);
let initializePromise;

async function initializeDatabase() {
  if (!initializePromise) {
    initializePromise = (async () => {
      const client = new Client(env.DATABASE_URL);
      await client.connect();
      try {
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await client.query(schema);
      } finally {
        await client.end();
      }
    })();
  }

  return initializePromise;
}

async function query(text, params = []) {
  await initializeDatabase();
  return sql.query(text, params);
}

function createQueryApi(executor) {
  return {
    async get(text, params = []) {
      const result = await executor.query(text, params);
      return result.rows[0];
    },
    async all(text, params = []) {
      const result = await executor.query(text, params);
      return result.rows;
    },
    async run(text, params = []) {
      return executor.query(text, params);
    }
  };
}

const db = createQueryApi({ query });

async function transaction(callback) {
  await initializeDatabase();
  const client = new Client(env.DATABASE_URL);
  await client.connect();

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
    await client.end();
  }
}

async function pingDatabase() {
  try {
    await initializeDatabase();
    await sql.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

async function closeDatabase() {}

module.exports = { db, transaction, pingDatabase, initializeDatabase, closeDatabase };
