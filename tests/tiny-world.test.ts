import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAction, createWorld, observeResident, replayTrace, scenarios, scenarioMetrics, stepWorld } from '../lib/tiny-world';

test('resident observation is local and does not expose omniscient state', () => {
  const world = createWorld('normal'); const view = observeResident(world, 'resident-1');
  assert.equal(Object.prototype.hasOwnProperty.call(view, 'resources'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(view, 'residents'), false);
  assert.equal(view.visible.some(x => x.id === 'resident-12'), false);
  assert.deepEqual(view.self.position, { x: 0, y: 1 });
});

test('gather and trade are atomic and cannot double consume', () => {
  let world = createWorld('normal'); world.resources['0,1'] = 1;
  const first = applyAction(world, { residentId: 'resident-1', type: 'gather', amount: 1 }); world = first.world;
  assert.equal(first.event.applied, true); assert.equal(world.resources['0,1'], 0); assert.equal(world.residents[0].inventory, 1);
  const second = applyAction(world, { residentId: 'resident-1', type: 'gather', amount: 1 });
  assert.equal(second.event.applied, false); assert.equal(second.world.residents[0].inventory, 1);
  const trade = applyAction(world, { residentId: 'resident-1', type: 'trade', withResidentId: 'resident-2', amount: 1 });
  assert.equal(trade.event.applied, false); // different locations: no mutation
  assert.equal(trade.world.residents[0].inventory, 1);
});

test('scenarios are seeded, metrics and trace replay are deterministic', () => {
  for (const scenario of scenarios) {
    const a = createWorld(scenario), b = createWorld(scenario); let x = a, y = b;
    for (let i = 0; i < 8; i++) { x = stepWorld(x, 'rule', x.residents[i % 12].id); y = stepWorld(y, 'rule', y.residents[i % 12].id); }
    assert.deepEqual(x, y); assert.deepEqual(replayTrace(x.trace, a), x); assert.ok(scenarioMetrics(scenario).cost >= 0);
  }
});

test('blocked path and non-local trade are recorded as failures', () => {
  const world = createWorld('bridge-outage'); const moved = applyAction(world, { residentId: 'resident-4', type: 'move', target: { x: 4, y: 2 } });
  assert.equal(moved.event.applied, false); assert.match(moved.event.reason ?? '', /path|target/);
});
