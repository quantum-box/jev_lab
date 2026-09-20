import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultCandidates, fixedRoutingCases, routeRequest, routingEvaluationCases, routingMetrics, validateCandidates } from '../lib/model-routing';

test('router selects all five fixed paths without calling a provider', () => {
  for (const example of fixedRoutingCases) assert.equal(routeRequest(example.input).target, example.expected, example.label);
});

test('candidate validation rejects duplicates and contradictory constraints', () => {
  const duplicate = validateCandidates([defaultCandidates[0], { ...defaultCandidates[1], id: defaultCandidates[0].id }]);
  assert.ok(duplicate.some(issue => issue.message.includes('重複')));
  const contradictory = validateCandidates([{ ...defaultCandidates[1], constraints: ['requires-tools'], supportsTools: false }]);
  assert.ok(contradictory.some(issue => issue.message.includes('矛盾')));
});

test('evaluation contains 50 cases and exposes routing metrics', () => {
  assert.equal(routingEvaluationCases.length, 50);
  const metrics = routingMetrics(routingEvaluationCases);
  assert.equal(metrics.accuracy, 1);
  assert.equal(metrics.holdRate, 0.6);
  assert.equal(Number.isFinite(metrics.decisionCost), true);
});

test('missing information does not get invented by the router', () => {
  const result = routeRequest({ text: '情報不足のため適切な経路を選んで' });
  assert.equal(result.target, 'human-review');
  assert.ok(result.flags.includes('情報不足'));
});

