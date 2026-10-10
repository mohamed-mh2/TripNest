import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createAuthModel } from '../models/auth.js';
import { validateRegistration, validateLogin } from '../authValidation.js';

const SESSION_MS = 60 * 60 * 1000;
const BCRYPT_ROUNDS = 12;
const dummyHash = bcrypt.hashSync('unusable-account-timing-placeholder', BCRYPT_ROUNDS);

export function createAuthController(db, secret) {
  const model = createAuthModel(db);
  function reply(res, user, sessionId, expiresAt, status = 200) {
    const token = jwt.sign({ sid: sessionId }, secret, {
      subject: user.id,
      expiresIn: '1h',
      issuer: 'tripnest',
      audience: 'tripnest-web',
      algorithm: 'HS256',
    });
    const { password_hash, ...publicUser } = user;
    return res
      .status(status)
      .set('Cache-Control', 'no-store')
      .json({ token, user: publicUser, expiresAt });
  }
  function validation(res, errors) {
    return res.status(400).json({
      error: {
        message: 'Check the highlighted fields.',
        code: 'VALIDATION',
        fields: errors,
      },
    });
  }
  async function register(req, res, next) {
    const { value, errors } = validateRegistration(req.body);
    if (Object.keys(errors).length) return validation(res, errors);
    try {
      const passwordHash = await bcrypt.hash(value.password, BCRYPT_ROUNDS);
      const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
      const { user, sessionId } = await model.createAccountSession(
        { ...value, passwordHash },
        expiresAt,
      );
      return reply(res, user, sessionId, expiresAt, 201);
    } catch (error) {
      if (error.code === '23505')
        return res.status(409).json({
          error: {
            message: 'An account with this email already exists. Sign in instead.',
            code: 'EMAIL_EXISTS',
            fields: { email: 'Email already registered.' },
          },
        });
      next(error);
    }
  }
  async function login(req, res, next) {
    const { value, errors } = validateLogin(req.body);
    if (Object.keys(errors).length) return validation(res, errors);
    try {
      const user = await model.findByEmail(value.email);
      const matches = await bcrypt.compare(
        value.password,
        user?.password_hash || dummyHash,
      );
      if (!user?.password_hash || !matches)
        return res.status(401).json({ error: 'Incorrect email or password.' });
      const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
      return reply(res, user, await model.createSession(user.id, expiresAt), expiresAt);
    } catch (error) {
      next(error);
    }
  }
  async function me(req, res, next) {
    try {
      const user = await model.findById(req.userId);
      if (!user) return res.status(401).json({ error: 'Account unavailable.' });
      res.set('Cache-Control', 'no-store').json({ user });
    } catch (error) {
      next(error);
    }
  }
  async function logout(req, res, next) {
    try {
      await model.revokeSession(req.sessionId, req.userId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
  return { register, login, me, logout };
}
