const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const authModel = require('../models/auth');
const { validateRegistration, validateLogin } = require('../authValidation');

const SESSION_MS = 15 * 60 * 1000;
const BCRYPT_ROUNDS = 12;

function issueToken(user, jti) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, jti },
    process.env.JWT_SECRET,
    { expiresIn: '15m', issuer: 'tripnest-api', audience: 'tripnest-client' }
  );
}

async function register(req, res, next) {
  try {
    const { value, errors } = validateRegistration(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed.', fields: errors });

    const passwordHash = await bcrypt.hash(value.password, BCRYPT_ROUNDS);
    let user;
    try {
      user = await authModel.createUser({ ...value, passwordHash });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'An account with this email already exists.' });
      throw error;
    }

    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_MS);
    await authModel.createSession({ jti, userId: user.id, expiresAt });
    return res.status(201).json({
      token: issueToken(user, jti),
      user,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { value, errors } = validateLogin(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed.', fields: errors });

    const user = await authModel.findUserByEmail(value.email);
    const validPassword = user && await bcrypt.compare(value.password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Email or password is incorrect.' });

    const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at };
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_MS);
    await authModel.createSession({ jti, userId: user.id, expiresAt });
    return res.json({
      token: issueToken(publicUser, jti),
      user: publicUser,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

async function me(req, res) {
  return res.json({ user: req.user });
}

async function logout(req, res, next) {
  try {
    await authModel.revokeSession(req.auth.jti);
    return res.json({ message: 'Logged out.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, me, logout, issueToken };
