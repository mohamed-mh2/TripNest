import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLogin, validateRegistration } from '../src/authValidation.js';

test('registration trims and normalizes name and email', () => {
  const result = validateRegistration({
    name: '  Madin Abed ',
    email: ' MADIN@EXAMPLE.COM ',
    password: 'long-password',
  });
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.value, {
    name: 'Madin Abed',
    email: 'madin@example.com',
    password: 'long-password',
  });
});

test('registration rejects malformed bodies, invalid fields, and passwords over bcrypt byte limit', () => {
  assert.ok(validateRegistration(null).errors.name);
  const result = validateRegistration({
    name: 'A',
    email: 'not-an-email',
    password: 'x'.repeat(73),
  });
  assert.deepEqual(Object.keys(result.errors).sort(), ['email', 'name', 'password']);
  assert.ok(
    validateRegistration({ name: 'Person', email: 'a@b.co', password: '😀'.repeat(19) })
      .errors.password,
  );
});

test('login rejects missing credentials and normalizes email', () => {
  assert.equal(Object.keys(validateLogin({}).errors).length, 2);
  const result = validateLogin({ email: ' USER@example.com ', password: 'secret' });
  assert.deepEqual(result.errors, {});
  assert.equal(result.value.email, 'user@example.com');
  assert.ok(validateLogin(null).errors.email);
});
