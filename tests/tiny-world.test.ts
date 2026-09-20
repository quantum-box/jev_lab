import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAction, actorForTick, createWorld, observeResident, replayTrace, scenarios, scenarioMetrics, stepWorld, validateAction } from '../lib/tiny-world';

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
  const world = createWorld('bridge-outage'); const moved = applyAction(world, { residentId: 'resident-12', type: 'move', target: { x: 4, y: 2 } });
  assert.equal(moved.event.applied, false); assert.match(moved.event.reason ?? '', /path/);
});

test('Jev mode fails closed instead of replaying a candidate', () => {
  const world = createWorld('normal'); const result = stepWorld(world, 'jev');
  assert.equal(result.tick, 0); assert.equal(result.trace.at(-1)?.applied, false); assert.match(result.trace.at(-1)?.reason ?? '', /no replay fallback/);
});

test('observations expose only incident path edges and co-located interactions', () => {
  const world = createWorld('normal'); const view = observeResident(world, 'resident-1');
  assert.ok(Object.keys(view.paths).length > 0);
  for (const encoded of Object.keys(view.paths)) { const [a, b] = encoded.split('|'); assert.ok(a === '0,1' || b === '0,1'); }
  assert.equal(view.candidates.some(a => a.type === 'trade' || a.type === 'cooperate'), false);
  world.residents[1].position = { x: 0, y: 1 };
  const colocated = observeResident(world, 'resident-1');
  assert.equal(colocated.candidates.some(a => a.type === 'cooperate' && a.withResidentId === 'resident-2'), true);
});

test('direct actions update survival and reject invalid amounts', () => {
  let world = createWorld('normal'); world.residents[0].energy = 1;
  world = applyAction(world, { residentId: 'resident-1', type: 'wait' }).world;
  assert.equal(world.metrics.survival, 11);
  for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const check = validateAction(createWorld('normal'), { residentId: 'resident-1', type: 'gather', amount });
    assert.equal(check.ok, false);
  }
});

test('manual actions retain their original tick during trace replay', () => {
  let world = createWorld('normal'); world.resources['0,1'] = 2;
  world = applyAction(world, { residentId: 'resident-1', type: 'gather', amount: 1 }).world;
  world = applyAction(world, { residentId: 'resident-1', type: 'gather', amount: 1 }).world;
  const replayed = replayTrace(world.trace, createWorld('normal'));
  assert.deepEqual(replayed, world);
  assert.equal(replayed.residents[0].history[1], 'gather at tick 0');
});

test('scenario mechanics affect residents, movement cost, and paths', () => {
  assert.equal(createWorld('newcomers').residents.length, 13);
  const normal = createWorld('normal'); const night = createWorld('night');
  const target = { x: 1, y: 1 };
  assert.equal(applyAction(normal, { residentId: 'resident-1', type: 'move', target }).world.residents[0].energy, 9);
  assert.equal(applyAction(night, { residentId: 'resident-1', type: 'move', target }).world.residents[0].energy, 8);
  const wild = createWorld('wild'); const first = stepWorld(wild, 'rule'); const second = stepWorld(first, 'rule');
  assert.notDeepEqual(wild.paths, first.paths); assert.notDeepEqual(first.paths, second.paths);
});

test('the default actor schedule visits every resident deterministically', () => {
  const world = createWorld('normal'); let state = world; const actors: string[] = [];
  for (let i = 0; i < world.residents.length; i++) { actors.push(actorForTick(state)!); state = stepWorld(state, 'replay'); }
  assert.deepEqual(actors, world.residents.map(r => r.id));
});
