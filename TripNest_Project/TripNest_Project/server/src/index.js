import { createDatabase } from './db.js';
import { createApp } from './app.js';
const db = createDatabase(process.env.DATABASE_URL);
const app = createApp(db, {
  secret: process.env.JWT_SECRET,
  demo: process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true',
});
const server = app.listen(Number(process.env.PORT ?? 3001), '127.0.0.1', () =>
  console.log('TripNest API: http://127.0.0.1:3001'),
);
process.on('SIGINT', () => server.close(() => db.end().then(() => process.exit(0))));
