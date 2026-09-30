const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const env = require('../config/env');

const databasePath = path.resolve(process.cwd(), env.DATABASE_PATH);
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

function pingDatabase() {
  return db.prepare('SELECT 1 AS ok').get()?.ok === 1;
}

function closeDatabase() {
  if (db.open) db.close();
}

module.exports = { db, pingDatabase, closeDatabase };
