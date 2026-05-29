import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Client } = pg;
const DB_USER = process.env.DB_USER || 'app_user';
const DB_PASSWORD = process.env.DB_PASSWORD || 'F28(}?v93%FE';
const DB_HOST = process.env.DB_HOST || 'devdb.anatech.ai';
const DB_NAME = process.env.DB_NAME || 'searchsomething';
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_ADMIN_NAME = process.env.DB_ADMIN_NAME || 'postgres';

const databaseName = DB_NAME;

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

if (!databaseName) {
  throw new Error('DB_NAME must include a database name.');
}

const client = new Client({
  user: DB_USER,
  password: DB_PASSWORD,
  host: DB_HOST,
  database: DB_ADMIN_NAME,
  port: DB_PORT,
  ssl:
    process.env.PGSSLMODE === 'require'
      ? { rejectUnauthorized: false }
      : undefined,
});

try {
  await client.connect();

  const existing = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [databaseName],
  );

  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    console.log(`Created PostgreSQL database "${databaseName}".`);
  } else {
    console.log(`PostgreSQL database "${databaseName}" already exists.`);
  }
} finally {
  await client.end();
}
