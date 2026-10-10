import { Router } from 'express';
import { requireSession } from '../middleware/auth.js';
import { createAuthController } from '../controllers/auth.js';

export function authRoutes(db, secret) {
  const router = Router();
  const controller = createAuthController(db, secret);
  const attempts = new Map();
  // #explain_notes: Bound repeated password attempts. No passwords are stored in this limiter.
  function limit(req, res, next) {
    const now = Date.now();
    for (const [key, item] of attempts) if (item.until <= now) attempts.delete(key);
    const key = req.ip;
    const item = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    if (item.count >= 20 || (!attempts.has(key) && attempts.size >= 10000)) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((item.until - now) / 1000))));
      return res
        .status(429)
        .json({ error: 'Too many account attempts. Please try again later.' });
    }
    item.count++;
    attempts.set(key, item);
    next();
  }
  router.post('/register', limit, controller.register);
  router.post('/login', limit, controller.login);
  router.get('/me', requireSession(db, secret), controller.me);
  router.post('/logout', requireSession(db, secret), controller.logout);
  return router;
}
