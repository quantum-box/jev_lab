import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultCandidates, defaultCriteria, fixedRoutingCases, routeRequest, routingEvaluationCases, routingMetrics, validateCandidates } from '../lib/model-routing';

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

test('editable routing criteria and candidate capabilities are enforced', () => {
  const withoutTools = defaultCandidates.map(candidate => candidate.id === 'high-v1' ? { ...candidate, supportsTools: false } : candidate);
  const toolDecision = routeRequest({ text: 'API検索を実行する', needsTools: true }, withoutTools);
  assert.equal(toolDecision.target, 'human-review');
  assert.ok(toolDecision.flags.includes('ツール能力不足'));

  const costDecision = routeRequest({ text: '自由形式の短い依頼', estimatedTokens: 500 }, defaultCandidates, { ...defaultCriteria, maxLightCost: 0.00001 });
  assert.equal(costDecision.target, 'high-performance');
  assert.ok(costDecision.flags.includes('軽量費用上限'));

  const defaultDecision = routeRequest({ text: '自由形式の短い依頼' }, defaultCandidates, { ...defaultCriteria, defaultRoute: 'rules' });
  assert.equal(defaultDecision.target, 'rules');
  assert.match(defaultDecision.reason, /ルール処理/);
});
