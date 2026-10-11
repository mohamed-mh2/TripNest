import { createDatabase } from './db.js';
import { createApp } from './app.js';
import { fileURLToPath } from 'node:url';
import { initializeCloudDatabase } from './cloudDatabase.js';
const production = process.env.NODE_ENV === 'production';
const db = createDatabase(process.env.DATABASE_URL);
if (production && process.env.AUTO_MIGRATE === 'true') {
  try {
    const catalog = await initializeCloudDatabase(db, {
      adminEmail: process.env.ADMIN_EMAIL,
      adminSetupSecret: process.env.ADMIN_SETUP_SECRET,
    });
    console.log(`Hosted database ready with ${catalog.total} simulated travel services.`);
  } catch (error) {
    await db.end();
    throw error;
  }
}
const app = createApp(db, {
  secret: process.env.JWT_SECRET,
  demo: process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true',
  staticDirectory: production
    ? fileURLToPath(new URL('../../client/dist/', import.meta.url))
    : null,
  trustProxy: process.env.TRUST_PROXY === '1',
});
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST || (production ? '0.0.0.0' : '127.0.0.1');
const server = app.listen(port, host, () =>
  console.log(`TripNest listening on ${host}:${port}`),
);
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 10000).unref();
  server.close(() =>
    db.end().then(() => {
      clearTimeout(deadline);
      process.exit(0);
    }),
  );
  server.closeIdleConnections();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
