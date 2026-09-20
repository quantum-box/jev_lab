import { strict as assert } from 'node:assert';
import { evaluationQueries, evaluate, rank, retrieve } from '../lib/search-reranking';
import { test } from 'node:test';

test('evaluation set contains 50 distinct human-labelled queries', () => {
  assert.equal(evaluationQueries.length, 50);
  assert.equal(new Set(evaluationQueries.map(q => q.query)).size, 50);
  assert.ok(evaluationQueries.some(q => q.note === 'unrelated'));
});

test('replay reranks exactly retrieved candidates and exposes stable rank changes', () => {
  const candidates = retrieve('pwdを忘れた');
  const result = rank('pwdを忘れた', candidates, 'replay', { d1: 3 });
  assert.ok(result.length <= candidates.length);
  assert.deepEqual(result.map(r => r.id).sort(), candidates.map(r => r.id).sort());
  assert.equal(result[0]?.id, 'd1');
  assert.equal(rank('pwdを忘れた', candidates, 'replay', { d1: 3 })[0]?.id, 'd1');
});

test('metrics include both baseline and deterministic replay', () => {
  const baseline = evaluate('baseline');
  const replay = evaluate('replay');
  assert.equal(baseline.queries, 50);
  assert.equal(replay.queries, 50);
  assert.ok(replay.ndcg >= 0 && replay.ndcg <= 1);
  assert.ok(replay.mrr >= 0 && replay.mrr <= 1);
});
