import pg from 'pg';

export function createDatabase(connectionString) {
  if (!connectionString) throw new Error('Set DATABASE_URL in server/.env.');

  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });

  // #explain_notes: PostgreSQL can restart while a connection is idle. The pool
  // removes that connection and opens a fresh one for the next request.
  // Handling this event prevents a temporary disconnect from crashing the API.
  pool.on('error', (error) => {
    console.warn(
      `Database connection interrupted (${error.code || 'disconnect'}). A new connection will be used on the next request.`,
    );
  });

  return pool;
}
