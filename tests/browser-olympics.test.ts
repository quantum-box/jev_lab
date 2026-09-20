import test from 'node:test';
import assert from 'node:assert/strict';
import {
  browserTasks,
  BrowserOlympicsRuntime,
  candidateActions,
  createBrowserState,
  runAllBaselines,
  runBaseline,
  snapshotFor,
  validateBrowserAction,
} from '../lib/browser-olympics';

test('ships ten deterministic tasks across three synthetic sites and layout variants', () => {
  assert.equal(browserTasks.length, 10);
  assert.deepEqual(new Set(browserTasks.map((task) => task.site)), new Set(['ec', 'library', 'form']));
  assert.ok(new Set(browserTasks.map((task) => task.variant)).size >= 3);
  assert.equal(new Set(browserTasks.map((task) => task.seed)).size, 10);
});

test('replay baselines complete through an independent code-owned validator', () => {
  const results = runAllBaselines('replay');
  assert.equal(results.every((result) => result.success), true);
  assert.equal(results.every((result) => result.invalidActionCount === 0), true);
  assert.equal(results.every((result) => result.cost.status === 'unavailable'), true);
});

test('rule baseline records deterministic invalid-action recovery', () => {
  const result = runBaseline('form-required', 'rule');
  assert.equal(result.success, true);
  assert.equal(result.invalidActionCount, 1);
  assert.equal(result.recoveryCount, 1);
});

test('page text cannot grant capabilities and no submit/purchase action is allowed', () => {
  const state = createBrowserState('ec-search');
  assert.equal(validateBrowserAction(state, { kind: 'click', target: 'purchase' }).ok, false);
  assert.equal(validateBrowserAction(state, { kind: 'click', target: 'submit' }).ok, false);
  assert.equal(validateBrowserAction(state, { kind: 'click', target: 'javascript:alert(1)' }).ok, false);
  assert.equal(validateBrowserAction(state, { kind: 'click', target: 'product:ec-green-tea' }).ok, false);
  assert.ok(candidateActions(state).some((candidate) => candidate.kind === 'type'));
});

test('snapshot stays synthetic and contains DOM plus accessibility evidence', () => {
  const snapshot = snapshotFor(createBrowserState('library-search'));
  assert.match(snapshot.url, /^mock:\/\/browser-olympics\//);
  assert.ok(snapshot.dom.some((node) => node.role === 'textbox'));
  assert.ok(snapshot.accessibility.some((node) => node.role === 'combobox'));
  assert.ok(!snapshot.url.startsWith('http'));
});

test('runtime caps invalid loops and replays a recorded trace deterministically', () => {
  const runtime = new BrowserOlympicsRuntime('ec-filter');
  runtime.step({ kind: 'click', target: 'submit' });
  runtime.step({ kind: 'click', target: 'submit' });
  runtime.step({ kind: 'click', target: 'submit' });
  assert.equal(runtime.status, 'capped');
  const replay = new BrowserOlympicsRuntime('ec-search');
  const baseline = runBaseline('ec-search', 'replay');
  const metrics = replay.replay(baseline.trace);
  assert.equal(metrics.success, true);
  assert.equal(metrics.stepCount, baseline.stepCount);
});

