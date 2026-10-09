// إعداد اتصال PostgreSQL باستخدام pg ومتغيرات البيئة؛ استخدامه من models. المسؤول: الفريق.

const { Pool, types } = require('pg');


// #explain_notes: DATE columns stay as 'YYYY-MM-DD' strings so no timezone shift happens.
types.setTypeParser(1082, (value) => value);


let pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tripnest',
});


function getPool() {
  return pool;
}


// #explain_notes: Tests replace the pool with an in-memory PostgreSQL emulator (pg-mem).
function setPool(nextPool) {
  pool = nextPool;
}


function query(text, params) {
  return pool.query(text, params);
}


// #explain_notes: Runs several statements in one transaction; rolls back on any error.
async function withTransaction(work) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


module.exports = {
  getPool,
  setPool,
  query,
  withTransaction,
};
