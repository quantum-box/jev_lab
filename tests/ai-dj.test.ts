import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparisonMetrics, DJ_SCENARIOS, makeDjTrace, replayDjTrace, selectDjLoop } from '../lib/ai-dj';

test('AI DJ selection is deterministic for the same seed, prompt, and bar', () => {
  const a = selectDjLoop(489101, '朝の静かな集中', 2);
  const b = selectDjLoop(489101, '朝の静かな集中', 2);
  assert.deepEqual(a, b);
  assert.equal(a.loop.source, 'owned-web-audio');
  assert.equal(a.loop.license, 'original-synth');
});

test('trace replay returns the last decision without running audio', () => {
  const trace = makeDjTrace(DJ_SCENARIOS[0].seed, ['静かに', '少し元気に'], 4);
  const replayed = replayDjTrace(JSON.stringify(trace));
  assert.equal(replayed.state?.bar, 4);
  assert.equal(replayed.events.length, trace.events.length);
  assert.equal(comparisonMetrics(trace).decisionCount, 4);
  assert.equal(comparisonMetrics(trace).promptChanges, 1);
  assert.equal(comparisonMetrics(trace).measuredCost, 'unavailable');
});

test('ten scenario seeds are present and unique', () => {
  assert.equal(DJ_SCENARIOS.length, 10);
  assert.equal(new Set(DJ_SCENARIOS.map(scenario => scenario.seed)).size, 10);
});

test('invalid or oversized traces are rejected', () => {
  assert.throws(() => replayDjTrace(JSON.stringify({ schema: 'other', version: 1, seed: 1, events: [] })));
  assert.throws(() => replayDjTrace(JSON.stringify({ schema: 'jev-ai-dj-trace', version: 1, seed: 1, events: Array.from({ length: 1001 }, () => ({ type: 'bar', bar: 1, loopId: 'x' })) })));
});
