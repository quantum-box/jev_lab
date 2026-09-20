import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePlaygroundAnswer, validatePlaygroundInput, wireRequest } from '../lib/playground';

const choice = validatePlaygroundInput({ state: { amount: 10 }, question: { id: 'category', type: 'choice', instructions: '分類を1つ選ぶ', criteria: { expense: '経費', review: '要確認' } } });
test('playground wire request is exact typed shape', () => assert.deepEqual(wireRequest(choice), { model: 'typesafe/jev-latest', state: { amount: 10 }, questions: { category: { instructions: '分類を1つ選ぶ', type: 'choice', criteria: { expense: '経費', review: '要確認' } } } }));
test('invalid state and criteria are rejected', () => {
  assert.throws(() => validatePlaygroundInput({ state: [], question: { id: 'q', type: 'noul', instructions: 'x' } }), /state/);
  assert.throws(() => validatePlaygroundInput({ state: {}, question: { id: 'q', type: 'choice', instructions: '', criteria: { one: 'x' } } }), /instructions/);
  assert.throws(() => validatePlaygroundInput({ state: {}, question: { id: 'q', type: 'choice', instructions: 'x', criteria: { one: 'x' } } }), /2〜8/);
  assert.throws(() => validatePlaygroundInput({ state: {}, question: { id: 'q', type: 'noul', instructions: 'x', criteria: [] } }), /criteria/);
});
test('typed response normalization rejects unknown choice', () => assert.throws(() => normalizePlaygroundAnswer({ type: 'choice', choice: 'other' }, choice.question), /criteria/));
test('score preserves ordered criteria and noul omits criteria', () => {
  const score = validatePlaygroundInput({ state: { impact: 3 }, question: { id: 'urgency', type: 'score', instructions: '順序づける', criteria: ['low', 'high'] } });
  assert.deepEqual(wireRequest(score).questions.urgency.criteria, ['low', 'high']);
  const noul = validatePlaygroundInput({ state: { ok: true }, question: { id: 'is_ok', type: 'noul', instructions: '該当度を判定' } });
  assert.deepEqual(wireRequest(noul).questions.is_ok, { instructions: '該当度を判定', type: 'noul' });
});
