const jwt = require('jsonwebtoken');
const authModel = require('../models/auth');

async function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Authentication required.' });

  try {
    const claims = jwt.verify(match[1], process.env.JWT_SECRET, {
      issuer: 'tripnest-api',
      audience: 'tripnest-client',
    });
    if (!claims.sub || !claims.jti) return res.status(401).json({ error: 'Invalid session.' });
    const user = await authModel.findActiveSession(claims.jti);
    if (!user || String(user.id) !== String(claims.sub)) {
      return res.status(401).json({ error: 'Session expired or revoked.' });
    }
    req.user = user;
    req.auth = { jti: claims.jti };
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    return next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions.' });
    return next();
  };
}

module.exports = { authenticate, requireRole };
