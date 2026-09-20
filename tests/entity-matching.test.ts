import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENTITY_MATCHING_VERSION, matchingEvaluationPairs, matchingExamples, matchingMetrics, matchPair } from '../lib/entity-matching';

test('five matching examples expose field-level evidence and deterministic outcomes', () => {
  assert.deepEqual(matchingExamples.map(item => matchPair(item).overall), ['match', 'match', 'mismatch', 'needs-review', 'match']);
  assert.ok(matchPair(matchingExamples[2]).fields.some(field => field.status === 'mismatch'));
  assert.ok(matchPair(matchingExamples[3]).fields.some(field => field.status === 'missing'));
});

test('fixed evaluation has 50 pairs and threshold metrics compare baselines', () => {
  assert.equal(matchingEvaluationPairs.length, 50);
  const metrics = matchingMetrics();
  assert.equal(metrics.total, 50);
  assert.ok(metrics.precision >= 0 && metrics.recall >= 0);
  assert.ok(metrics.baseline.id.cost < metrics.cost);
  assert.ok(metrics.baseline.string.falseMerge >= 0);
});

test('review version and values are not mutated by matching', () => {
  const before = JSON.stringify(matchingExamples);
  matchPair(matchingExamples[0]);
  assert.equal(JSON.stringify(matchingExamples), before);
  assert.match(ENTITY_MATCHING_VERSION, /entity-matching-rules/);
});
