import jwt from 'jsonwebtoken';

export function requireSession(db, secret) {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!token) return res.status(401).json({ error: 'Sign in to access your trip.' });
      const claims = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: 'tripnest',
        audience: 'tripnest-web',
      });
      if (typeof claims !== 'object' || !claims.sub || !claims.sid)
        return res.status(401).json({ error: 'Invalid session.' });
      const session = await db.query(
        'SELECT user_id FROM sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>now()',
        [claims.sid, claims.sub],
      );
      if (!session.rows.length)
        return res.status(401).json({ error: 'Session expired.' });
      req.userId = claims.sub;
      next();
    } catch (error) {
      if (
        error.name?.includes('Token') ||
        error.name === 'NotBeforeError' ||
        error.code === '22P02'
      )
        return res.status(401).json({ error: 'Invalid or expired session.' });
      next(error);
    }
  };
}
