import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveThemePreference } from '../src/features/themePreference.ts';

test('a saved theme takes precedence over the device theme', () => {
  assert.equal(resolveThemePreference('light', true), 'light');
  assert.equal(resolveThemePreference('dark', false), 'dark');
});
test('new visitors follow the device theme, including invalid saved values', () => {
  assert.equal(resolveThemePreference(null, true), 'dark');
  assert.equal(resolveThemePreference(null, false), 'light');
  assert.equal(resolveThemePreference('invalid', true), 'dark');
});
