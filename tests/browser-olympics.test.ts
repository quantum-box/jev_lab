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
  validateBrowserTrace,
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
  const disabled = snapshotFor(createBrowserState('form-required')).dom.find((node) => node.id === 'submit-disabled');
  assert.equal(disabled?.enabled, false);
  assert.equal(snapshotFor(createBrowserState('ec-filter')).dom.some((node) => node.attributes['data-layout'] === 'dense'), true);
  assert.equal(snapshotFor(createBrowserState('ec-sort')).dom.some((node) => node.role === 'navigation'), true);
  assert.equal(snapshotFor(createBrowserState('form-required')).dom.some((node) => node.role === 'dialog'), true);
});

test('filters and sorts are rendered in snapshots and completion checks the rendered results', () => {
  const filtered = new BrowserOlympicsRuntime('ec-filter');
  filtered.step({ kind: 'select', target: 'category', value: 'stationery' });
  assert.deepEqual(filtered.state, { ...filtered.state, category: 'stationery' });
  assert.equal(snapshotFor(filtered.state).dom.filter((node) => node.id.startsWith('product:')).map((node) => node.id).join(','), 'product:ec-notebook');
  const sorted = new BrowserOlympicsRuntime('library-sort');
  sorted.step({ kind: 'select', target: 'sort', value: 'recent' });
  assert.deepEqual(snapshotFor(sorted.state).dom.filter((node) => node.id.startsWith('book:')).map((node) => node.id).join(','), 'book:book-solaris,book:book-metamorphosis,book:book-little-prince');
});

test('invalid recovery is applied and the recovery snapshot matches runtime state', () => {
  const runtime = new BrowserOlympicsRuntime('ec-filter');
  const result = runtime.step({ kind: 'click', target: 'submit' });
  assert.equal(result.accepted, false);
  assert.ok(result.changes.includes('notice'));
  assert.deepEqual(result.snapshot, snapshotFor(runtime.state, runtime.stepCount));
  const apply = runtime.trace.find((event) => event.type === 'apply');
  assert.equal(apply?.type, 'apply');
  if (apply?.type === 'apply') assert.deepEqual(apply.snapshot, result.snapshot);
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
  assert.equal(validateBrowserTrace(JSON.parse(baseline.trace)), true);
  assert.throws(() => replay.replay(JSON.stringify({ schema: 'browser-olympics-trace', version: 999, taskId: 'ec-search', events: [] })), /invalid browser trace/);
  assert.throws(() => replay.replay(JSON.stringify({ schema: 'browser-olympics-trace', version: 1, taskId: 'ec-search', events: [{ type: 'decision', step: 1, source: 'replay', action: { kind: 'execute', target: 'arbitrary-js' } }] })), /invalid browser trace/);
});

test('no-progress metric is cumulative while its cap uses a separate consecutive streak', () => {
  const runtime = new BrowserOlympicsRuntime('ec-filter');
  runtime.step({ kind: 'observe', target: 'page' });
  runtime.step({ kind: 'observe', target: 'page' });
  assert.equal(runtime.metrics.noProgressCount, 2);
  runtime.step({ kind: 'select', target: 'category', value: 'stationery' });
  assert.equal(runtime.metrics.noProgressCount, 2);
  assert.equal(runtime.status, 'completed');
});
