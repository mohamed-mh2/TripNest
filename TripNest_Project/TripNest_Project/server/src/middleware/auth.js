// التحقق من JWT وهوية المستخدم ودور المسؤول؛ فحص ملكية السجلات داخل كل ميزة. المسؤول: madin abed.
// #explain_notes: TEMPORARY integration adapter added by Student 2 until JWT login exists.
// Contract for the real implementation: verify the token, then set req.user = { id, role, fullName }.
// If req.user is already set by a JWT middleware, this adapter does nothing.

const { HttpError } = require('../utils/httpError');
const { findUserById } = require('../models/auth');


function isDemoSessionAllowed() {
  return process.env.NODE_ENV !== 'production';
}


async function requireAuth(req, res, next) {
  try {
    if (req.user) {
      return next();
    }

    // #explain_notes: Development-only demo session: the client sends the chosen demo user's id.
    // It is rejected in production, so it can never act as a real login.
    const rawUserId = req.get('X-Demo-User');

    if (!isDemoSessionAllowed() || !rawUserId || !/^\d+$/.test(rawUserId)) {
      throw new HttpError(401, 'Please sign in to continue.', { code: 'UNAUTHENTICATED' });
    }

    const user = await findUserById(Number(rawUserId));

    if (!user) {
      throw new HttpError(401, 'Please sign in to continue.', { code: 'UNAUTHENTICATED' });
    }

    req.user = {
      id: user.id,
      role: user.role,
      fullName: user.full_name,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}


module.exports = {
  requireAuth,
  isDemoSessionAllowed,
};
