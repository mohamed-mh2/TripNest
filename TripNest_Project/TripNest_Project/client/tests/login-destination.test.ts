import test from 'node:test';
import assert from 'node:assert/strict';
import { loginDestination } from '../src/features/accounts/loginDestination.ts';

test('sign-in keeps a shared support link and service details, including session expiry', () => {
  const link = '/#support=' + 'a'.repeat(64);
  assert.equal(loginDestination('/', '', link.slice(1)), link);
  assert.equal(
    loginDestination('/services/4', '?category=flight'),
    '/services/4?category=flight',
  );
  assert.equal(
    loginDestination('/auth', '?expired=1&returnTo=' + encodeURIComponent(link)),
    link,
  );
  assert.equal(loginDestination('/auth'), '/trips');
});

test('login return addresses cannot redirect to another site or an unknown route', () => {
  for (const value of [
    'https://example.test',
    '//example.test',
    '/\\example.test',
    '/auth',
    '/missing',
  ]) {
    assert.equal(
      loginDestination('/auth', '?returnTo=' + encodeURIComponent(value)),
      '/trips',
    );
  }
});
