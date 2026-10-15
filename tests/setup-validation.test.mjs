import test from 'node:test';
import assert from 'node:assert/strict';
import { amount, subscriptionExpired, uuidPattern } from '../server/actions/validation.ts';

test('money preserves zero and decimals, rejects negative, blank and overflow', () => {
  assert.equal(amount('0'), 0);
  assert.equal(amount('8.50'), 8.5);
  for (const value of ['', '-1', '1.001', '100000000', 'NaN', 'Infinity', null, '1e3']) assert.equal(amount(value), null);
});
test('expiry checks both dates and rejects inactive or undated subscriptions', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  const trial = { status: 'TRIAL_ACTIVE', trial_ends_at: future, current_period_end: null };
  assert.equal(subscriptionExpired(trial), false);
  assert.equal(subscriptionExpired({ ...trial, trial_ends_at: past }), true);
  assert.equal(subscriptionExpired({ ...trial, trial_ends_at: null }), true);
  assert.equal(subscriptionExpired({ ...trial, current_period_end: past }), true);
  assert.equal(subscriptionExpired({ status: 'ACTIVE', trial_ends_at: null, current_period_end: future }), false);
  assert.equal(subscriptionExpired({ status: 'ACTIVE', trial_ends_at: past, current_period_end: future }), true);
  assert.equal(subscriptionExpired({ status: 'ACTIVE', trial_ends_at: null, current_period_end: null }), true);
  assert.equal(subscriptionExpired({ ...trial, status: 'PAST_DUE' }), true);
});
test('property IDs must be UUIDs', () => {
  assert.equal(uuidPattern.test('00000000-0000-4000-8000-000000000001'), true);
  assert.equal(uuidPattern.test('other-user-property'), false);
});
