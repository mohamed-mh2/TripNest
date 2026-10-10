import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFamilyPending } from '../src/features/family/pending.ts';
import { readCashPending } from '../src/features/cash/pending.ts';
const key = '10000000-0000-4000-8000-000000000001';
test('retry recovery accepts only validated family and cash operations', () => {
  for (const raw of [null, 'broken', '[]', '{}', 'null']) {
    assert.equal(readFamilyPending(raw), null);
    assert.equal(readCashPending(raw), null);
  }
  const create = { kind: 'create', key, amountMinor: 500 };
  assert.deepEqual(readFamilyPending(JSON.stringify(create)), create);
  assert.equal(readFamilyPending(JSON.stringify({ ...create, amountMinor: 499 })), null);
  const pay = { kind: 'pay', key, token: 'a'.repeat(64), testOutcome: 'approve' };
  assert.deepEqual(readFamilyPending(JSON.stringify(pay)), pay);
  assert.equal(readFamilyPending(JSON.stringify({ ...pay, token: 'not a token' })), null);
  const cash = {
    key,
    packageId: 'rescue',
    paymentMethod: 'wallet',
    testOutcome: 'approve',
  };
  assert.deepEqual(readCashPending(JSON.stringify(cash)), cash);
  for (const change of [
    { packageId: 'free' },
    { key: 'bad' },
    { paymentMethod: 'bank' },
    { testOutcome: 'anything' },
  ])
    assert.equal(readCashPending(JSON.stringify({ ...cash, ...change })), null);
});
