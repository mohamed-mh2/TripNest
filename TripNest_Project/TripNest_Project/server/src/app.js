import express from 'express';
import jwt from 'jsonwebtoken';
import { requireSession } from './middleware/auth.js';
import { financeRoutes } from './routes/finance.js';
import { bookingRoutes } from './routes/bookings.js';

export function createApp(db, { secret, demo = false }) {
  if (!secret || secret.length < 32)
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', async (req, res, next) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch (e) {
      next(e);
    }
  });
  // Explicit local demo only; production uses student 1's login and session endpoints.
  if (demo)
    app.get('/api/dev/session', async (req, res, next) => {
      try {
        const result = await db.query(
          "SELECT s.id,s.user_id,t.id AS trip_id FROM sessions s JOIN trips t ON t.owner_id=s.user_id WHERE s.id='20000000-0000-4000-8000-000000000001' AND s.expires_at>now() AND s.revoked_at IS NULL LIMIT 1",
        );
        if (!result.rows.length)
          return res.status(503).json({ error: 'Run the local database setup first.' });
        const row = result.rows[0];
        res.set('Cache-Control', 'no-store').json({
          tripId: row.trip_id,
          token: jwt.sign({ sid: row.id }, secret, {
            subject: row.user_id,
            expiresIn: '1h',
            issuer: 'tripnest',
            audience: 'tripnest-web',
          }),
        });
      } catch (e) {
        next(e);
      }
    });
  // Second isolated demo identity lets the team test a family sender and a traveler.
  if (demo)
    app.get('/api/dev/family-session', async (req, res, next) => {
      try {
        const result = await db.query(
          "SELECT id,user_id FROM sessions WHERE id='20000000-0000-4000-8000-000000000002' AND expires_at>now() AND revoked_at IS NULL",
        );
        if (!result.rows.length)
          return res.status(503).json({
            error: 'Run local database setup to create the family demo account.',
          });
        const row = result.rows[0];
        res.set('Cache-Control', 'no-store').json({
          token: jwt.sign({ sid: row.id }, secret, {
            subject: row.user_id,
            expiresIn: '1h',
            issuer: 'tripnest',
            audience: 'tripnest-web',
          }),
        });
      } catch (e) {
        next(e);
      }
    });
  app.use('/api', bookingRoutes(db, secret));
  app.use('/api', requireSession(db, secret), financeRoutes(db, secret));
  app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
  app.use((error, req, res, next) => {
    const status = error.status ?? (error.code === '23505' ? 409 : 500);
    if (
      error.fields ||
      (typeof error.code === 'string' && error.code !== '23505' && status < 500)
    ) {
      return res
        .status(status)
        .json({
          error: {
            message: error.message,
            code: error.code,
            fields: error.fields || null,
          },
        });
    }
    res.status(status).json({
      error:
        status === 500
          ? 'Server could not complete the request.'
          : status === 409 && error.code === '23505'
            ? 'This operation already exists.'
            : error.message,
    });
  });
  return app;
}
