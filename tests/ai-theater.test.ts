import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actors, compareTheaterModes, fixedTheaterResponse, inspectTheaterTrace, replayTheaterTrace, runTheater, theaterScenarios } from '../lib/ai-theater';

test('theater has five bounded actors and ten deterministic settings', () => {
  assert.equal(actors.length, 5);
  assert.equal(theaterScenarios.length, 10);
  assert.equal(new Set(actors.map(actor => actor.secret)).size, 5);
});

test('Jev decisions and generated dialogue are separate and secrets stay private', () => {
  const scenario = theaterScenarios[0];
  const trace = runTheater(scenario, 'jev', undefined, 3);
  assert.equal(trace.events.length, 3);
  assert.notEqual(trace.events[0].decision.id, trace.events[0].dialogue.id);
  assert.equal(inspectTheaterTrace(trace, scenario).secretLeakage, 0);
});

test('intervention, stop budget, and replay remain deterministic', () => {
  const scenario = theaterScenarios[2];
  const trace = runTheater(scenario, 'intervention', scenario.interventions[0], 2);
  assert.equal(trace.stopped, true);
  assert.equal(trace.stopReason, 'budget or stop limit reached');
  const replay = replayTheaterTrace(trace, scenario);
  assert.deepEqual(replay.events, trace.events);
  assert.equal(fixedTheaterResponse(scenario).events.length, 2);
});

test('rule, Jev, and intervention comparisons expose cost and quality measures', () => {
  const comparison = compareTheaterModes(theaterScenarios[0]);
  assert.equal(comparison.rule.cost, 0);
  assert.ok(comparison.jev.cost > 0);
  assert.ok(Number.isFinite(comparison.intervention.repetitionRate));
});
