import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const defaultDatabaseUrl =
  'postgresql://postgres:postgres@localhost:5432/searchsomething';

const appDatabaseUrl = new URL(process.env.DATABASE_URL || defaultDatabaseUrl);
const databaseName = appDatabaseUrl.pathname.replace(/^\//, '');
const adminDatabaseUrl = new URL(
  process.env.DATABASE_ADMIN_URL || appDatabaseUrl.toString(),
);

adminDatabaseUrl.pathname = '/postgres';

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

if (!databaseName) {
  throw new Error('DATABASE_URL must include a database name.');
}

const pool = new Pool({
  connectionString: adminDatabaseUrl.toString(),
  ssl:
    process.env.PGSSLMODE === 'require'
      ? { rejectUnauthorized: false }
      : undefined,
});

try {
  const existing = await pool.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [databaseName],
  );

  if (existing.rowCount === 0) {
    await pool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    console.log(`Created PostgreSQL database "${databaseName}".`);
  } else {
    console.log(`PostgreSQL database "${databaseName}" already exists.`);
  }
} finally {
  await pool.end();
}
