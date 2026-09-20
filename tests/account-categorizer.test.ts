import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCOUNT_RULES_VERSION, categorizeTransaction, compareCategorization, replayCorrections, validAccountId, type Transaction } from '../lib/account-categorizer';

const tx = (description: string, id = 'TX-TEST'): Transaction => ({ id, date: '2026-09-20', description, amount: 1200 });

test('categorizer selects a valid account and exposes rule provenance', () => {
  const result = categorizeTransaction(tx('Office rent September'), 'standard', 'replay');
  assert.equal(result.status, 'matched');
  assert.equal(result.accountId, '6100');
  assert.equal(result.rulesVersion, ACCOUNT_RULES_VERSION);
  assert.equal(validAccountId(result.accountId!), true);
});

test('ambiguous and unknown descriptions are reviewable without inventing IDs', () => {
  assert.equal(categorizeTransaction(tx('交通費か交際費か不明')).status, 'needs-review');
  const unknown = categorizeTransaction(tx('謎の支出')); assert.equal(unknown.status, 'unmatched'); assert.equal(unknown.accountId, undefined);
  assert.equal(categorizeTransaction({ ...tx('ok'), amount: -1 }).status, 'unmatched');
});

test('company rule switch and deterministic comparison are explicit', () => {
  const studio = categorizeTransaction(tx('機材購入'), 'studio');
  assert.equal(studio.accountId, '6200');
  const comparison = compareCategorization(tx('Office rent September'));
  assert.equal(comparison.consistent, true);
  assert.equal(comparison.baseline.accountId, comparison.jev.accountId);
});

test('corrections can be replayed only to known account IDs', () => {
  const original = categorizeTransaction(tx('謎の支出'));
  const corrected = replayCorrections([original], [{ transactionId: original.transactionId, to: '5200', reason: '担当者確認', at: '2026-09-20T00:00:00Z' }]);
  assert.equal(corrected[0].accountId, '5200');
  const rejected = replayCorrections([original], [{ transactionId: original.transactionId, to: '9999', reason: 'bad', at: 'now' }]);
  assert.equal(rejected[0].accountId, undefined);
});
