// Applies the schema, additive migrations, and demo seed to PostgreSQL without deleting data. المسؤول: الفريق.

const fs = require('fs');
const path = require('path');


// #explain_notes: Order matters: shared core first, then feature migrations, then the demo seed.
function readSetupFiles() {
  const migrationsDir = path.join(__dirname, 'migrations');

  const migrations = fs
    .readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort()
    .map((fileName) => fs.readFileSync(path.join(migrationsDir, fileName), 'utf8'));

  return {
    schema: fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'),
    migrations,
    seed: fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8'),
  };
}


async function setupDatabase(pool) {
  const files = readSetupFiles();

  await pool.query(files.schema);

  for (const migration of files.migrations) {
    await pool.query(migration);
  }

  // #explain_notes: Seed only an empty database so existing records are never duplicated or overwritten.
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');

  if (rows[0].count === 0) {
    await pool.query(files.seed);
  }
}


module.exports = { setupDatabase };


if (require.main === module) {
  const db = require('../src/db');

  setupDatabase(db.getPool())
    .then(() => {
      console.log('TripNest database is ready.');
      return db.getPool().end();
    })
    .catch((error) => {
      console.error('Database setup failed:', error.message);
      process.exit(1);
    });
}
