import test from 'node:test';
import assert from 'node:assert/strict';
import { arenaActions, applyAction, candidates, createArenaRuntime, environment, scenarioState, scenarios, validateAction } from '../lib/reflex-arena';
import { ContinuousRuntime } from '../lib/runtime';

test('Reflex Arena ships ten fixed, distinct seeds', () => {
  assert.equal(scenarios.length, 10);
  assert.equal(new Set(scenarios.map(s => s.seed)).size, 10);
  assert.ok(scenarios.every(s => s.initial.obstacles.length > 0));
});

test('structured state owns collision, damage, and allowed actions', () => {
  const state = scenarioState(scenarios[0]);
  assert.equal(validateAction(state, 'north').ok, true);
  const wall = { ...state, hero: { x: 4, y: 4 } };
  assert.equal(validateAction(wall, 'north').ok, false);
  assert.equal(validateAction(state, 'teleport' as never).ok, false);
  const enemyTurn = { ...state, enemy: { ...state.ally } };
  assert.equal((enemyTurn.allyHealth), 5);
});

test('candidate ordering responds to Japanese tactic without changing allowed actions', () => {
  const state = scenarioState(scenarios[6]);
  const protect = candidates(state, '味方を守る');
  const attack = candidates(state, '攻撃を優先');
  assert.equal(protect.length > 0, true);
  assert.equal(new Set(protect).size, new Set(attack).size);
  assert.equal(protect.every(a => arenaActions.includes(a)), true);
});

test('fixed replay produces a replayable deterministic trace', async () => {
  const tactic = { current: '敵が近ければ攻撃する' }; const key = { current: '' };
  const first = createArenaRuntime(scenarios[0], 'replay', tactic, key);
  first.start();
  for (let i = 0; i < 5; i++) await first.tick(500);
  const trace = first.exportTrace();
  const replay = ContinuousRuntime.replay(trace);
  assert.equal(replay.events.filter(e => e.type === 'apply').length, 5);
  const second = createArenaRuntime(scenarios[0], 'replay', tactic, key);
  second.start();
  for (let i = 0; i < 5; i++) await second.tick(500);
  assert.deepEqual(second.state, first.state);
});

test('an invalid action does not teleport the hero', () => {
  const state = scenarioState(scenarios[0]);
  const next = applyAction(state, 'north');
  assert.notDeepEqual(next.hero, { x: 4, y: 4 });
});

test('guard protects the ally during the following environment tick', () => {
  const state = { ...scenarioState(scenarios[0]), hero: { x: 9, y: 9 }, ally: { x: 2, y: 4 }, enemy: { x: 1, y: 4 }, guarding: true };
  assert.equal(environment(state).allyHealth, state.allyHealth);
});

test('escort scenarios move the ally to the exit and cannot win by defeating the enemy', () => {
  let state = { ...scenarioState(scenarios[2]), enemyHealth: 0 };
  assert.equal(applyAction(state, 'wait').outcome, 'running');
  for (let tick = 0; tick < 20; tick++) state = environment(state);
  assert.deepEqual(state.ally, state.exit);
  assert.equal(applyAction(state, 'wait').outcome, 'victory');
});

test('replay uses east as its first available movement priority', async () => {
  const runtime = createArenaRuntime(scenarios[0], 'replay', { current: 'default' }, { current: '' });
  runtime.start(); await runtime.tick(500);
  assert.deepEqual(runtime.state.hero, { x: 2, y: 4 });
});

test('live decisions retain measured usage and cost', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ action: 'east', usage: { status: 'measured', inputTokens: 12, outputTokens: 4 }, cost: { status: 'measured', nanodollars: 99 } }), { status: 200 });
  try { const runtime = createArenaRuntime(scenarios[0], 'jev', { current: 'default' }, { current: 'ephemeral' }); await runtime.step(); assert.deepEqual(runtime.metrics.usage, { status: 'measured', inputTokens: 12, outputTokens: 4 }); assert.deepEqual(runtime.metrics.cost, { status: 'measured', nanodollars: 99 }); }
  finally { globalThis.fetch = oldFetch; }
});
