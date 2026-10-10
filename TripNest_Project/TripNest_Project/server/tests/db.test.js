import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createDatabase } from '../src/db.js';

test('database requires a connection string', () => {
  assert.throws(() => createDatabase(), /DATABASE_URL/);
});

// #explain_notes: This test terminates only its own idle database connection.
// It does not modify or remove any demo data or other users' connections.
test(
  'an idle disconnect does not crash the process and the next query reconnects',
  {
    skip: !process.env.DATABASE_URL,
    timeout: 15000,
  },
  async () => {
    const pool = createDatabase(process.env.DATABASE_URL);
    const controller = new pg.Pool({ connectionString: process.env.DATABASE_URL });

    try {
      const connection = await pool.connect();
      const {
        rows: [{ pid }],
      } = await connection.query('SELECT pg_backend_pid() AS pid');
      const disconnected = new Promise((resolve) => pool.once('error', resolve));
      connection.release();

      const {
        rows: [{ terminated }],
      } = await controller.query('SELECT pg_terminate_backend($1) AS terminated', [pid]);
      assert.equal(terminated, true);
      await disconnected;

      const {
        rows: [{ freshPid, value }],
      } = await pool.query('SELECT pg_backend_pid() AS "freshPid", 1 AS value');
      assert.notEqual(freshPid, pid);
      assert.equal(value, 1);
    } finally {
      await Promise.all([pool.end(), controller.end()]);
    }
  },
);
