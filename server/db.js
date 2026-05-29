import pg from 'pg';

const { Client } = pg;

const DB_USER = process.env.DB_USER || 'app_user';
const DB_PASSWORD = process.env.DB_PASSWORD || 'F28(}?v93%FE';
const DB_HOST = process.env.DB_HOST || 'devdb.anatech.ai';
const DB_NAME = process.env.DB_NAME || 'searchsomething';
const DB_PORT = process.env.DB_PORT || 5432;

export const client = new Client({
  user: DB_USER,
  password: DB_PASSWORD,
  host: DB_HOST,
  database: DB_NAME,
  port: DB_PORT,
  ssl:
    process.env.PGSSLMODE === 'require'
      ? { rejectUnauthorized: false }
      : undefined,
});

await client.connect();

export async function initDb() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      location_accuracy DOUBLE PRECISION,
      exact_location TEXT,
      chat_history JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS users_session_id_idx ON users (session_id);
  `);
}

export async function getUserBySession(sessionId) {
  const result = await client.query(
    `SELECT * FROM users WHERE session_id = $1 LIMIT 1`,
    [sessionId],
  );

  return result.rows[0] || null;
}

export async function upsertUserLocation({
  sessionId,
  latitude,
  longitude,
  locationAccuracy,
  exactLocation,
}) {
  const result = await client.query(
    `
      INSERT INTO users (
        session_id,
        latitude,
        longitude,
        location_accuracy,
        exact_location
      )
      VALUES ($1, $2, $3, $4, NULLIF($5, ''))
      ON CONFLICT (session_id)
      DO UPDATE SET
        latitude = COALESCE(EXCLUDED.latitude, users.latitude),
        longitude = COALESCE(EXCLUDED.longitude, users.longitude),
        location_accuracy = COALESCE(EXCLUDED.location_accuracy, users.location_accuracy),
        exact_location = COALESCE(EXCLUDED.exact_location, users.exact_location),
        updated_at = NOW()
      RETURNING *
    `,
    [
      sessionId,
      latitude ?? null,
      longitude ?? null,
      locationAccuracy ?? null,
      exactLocation?.trim() || '',
    ],
  );

  return result.rows[0];
}

export async function appendChatMessages(sessionId, messages) {
  const result = await client.query(
    `
      UPDATE users
      SET
        chat_history = chat_history || $2::jsonb,
        updated_at = NOW()
      WHERE session_id = $1
      RETURNING *
    `,
    [sessionId, JSON.stringify(messages)],
  );

  return result.rows[0];
}
