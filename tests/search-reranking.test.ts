import { strict as assert } from 'node:assert';
import { evaluationQueries, evaluate, rank, retrieve } from '../lib/search-reranking';
import { test } from 'node:test';

test('evaluation set contains 50 distinct human-labelled queries', () => {
  assert.equal(evaluationQueries.length, 50);
  assert.equal(new Set(evaluationQueries.map(q => q.query)).size, 50);
  assert.ok(evaluationQueries.filter(q => q.note === 'unrelated').length >= 2);
  assert.ok(evaluationQueries.filter(q => q.note === 'unrelated').every(q => Object.keys(q.labels).length === 0));
  assert.ok(evaluationQueries.some(q => q.query === 'duplicate invoice'));
});

test('replay reranks exactly retrieved candidates and exposes stable rank changes', () => {
  const candidates = retrieve('pwdを忘れた');
  const result = rank('pwdを忘れた', candidates, 'replay', { d1: 3 });
  assert.ok(result.length <= candidates.length);
  assert.deepEqual(result.map(r => r.id).sort(), candidates.map(r => r.id).sort());
  assert.equal(result[0]?.id, 'd1');
  assert.equal(rank('pwdを忘れた', candidates, 'replay', { d1: 3 })[0]?.id, 'd1');
});

test('mixed Japanese and English fragments retrieve the intended candidates', () => {
  assert.equal(retrieve('Webhook署名')[0]?.id, 'd7');
  assert.equal(retrieve('passwordではない請求書')[0]?.id, 'd4');
});

test('evaluation labels do not leak into replay ranking features', () => {
  const candidates = retrieve('invoice download');
  const withLabel = rank('invoice download', candidates, 'replay', { d4: 3 });
  const withWrongLabel = rank('invoice download', candidates, 'replay', { d4: 0, d5: 3 });
  assert.deepEqual(withLabel.map(r => r.id), withWrongLabel.map(r => r.id));
  assert.deepEqual(withLabel.map(r => r.score), withWrongLabel.map(r => r.score));
});

test('evaluation labels make absent documents irrelevant while interactive mode stays lexical', () => {
  const candidates = retrieve('invoice download');
  const evaluated = rank('invoice download', candidates, 'baseline', {});
  const interactive = rank('invoice download', candidates, 'baseline');
  assert.ok(evaluated.every(row => row.relevance === 0));
  assert.ok(interactive.some(row => row.relevance > 0));
});

test('metrics include both baseline and deterministic replay', () => {
  const baseline = evaluate('baseline');
  const replay = evaluate('replay');
  assert.equal(baseline.queries, 50);
  assert.equal(replay.queries, 50);
  assert.ok(replay.ndcg >= 0 && replay.ndcg <= 1);
  assert.ok(replay.mrr >= 0 && replay.mrr <= 1);
  assert.equal(replay.noRelevantQueryCount, 2);
  assert.equal(replay.evaluatedQueries, 48);
  assert.equal(replay.rejectionRate, 0.04);
});
