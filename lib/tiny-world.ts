export type Mode = 'replay' | 'rule' | 'jev';
export type Scenario = { id: string; name: string; description: string; seed: number; resources: number; outages?: string[]; memoryLoss?: boolean; newcomers?: boolean; night?: boolean; wild?: boolean; drought?: boolean };
export type Position = { x: number; y: number };
export type Resident = { id: string; name: string; goal: string; position: Position; energy: number; memory: string[]; inventory: number; history: string[] };
export type World = { tick: number; seed: number; scenario: Scenario; resources: Record<string, number>; paths: Record<string, boolean>; residents: Resident[]; metrics: { survival: number; resources: number; trades: number; cooperation: number; cost: number }; trace: TraceEvent[] };
export type Action = { residentId: string; type: 'move' | 'gather' | 'trade' | 'cooperate' | 'wait'; target?: Position; withResidentId?: string; amount?: number };
export type Observation = { self: Pick<Resident, 'id' | 'name' | 'goal' | 'position' | 'energy' | 'inventory'>; visible: Array<{ id: string; name: string; position: Position; inventory: number }>; localResources: Record<string, number>; paths: Record<string, boolean>; memory: string[]; history: string[]; candidates: Action[] };
export type TraceEvent = { tick: number; nextTick?: number; action: Action; observation: Observation; applied: boolean; reason?: string; stateHash: string };

export const scenarios: Scenario[] = [
  { id: 'normal', name: 'Normal day', description: '資源も経路も安定した平常日', seed: 11, resources: 24 },
  { id: 'scarcity', name: 'Scarcity', description: '食料が少なく、交換が重要', seed: 23, resources: 8 },
  { id: 'bridge-outage', name: 'Bridge outage', description: '中央橋が閉鎖される', seed: 37, resources: 18, outages: ['3,2|4,2'] },
  { id: 'memory-loss', name: 'Memory loss', description: '一部の住民が直近の記憶を失う', seed: 41, resources: 18, memoryLoss: true },
  { id: 'rain', name: 'Heavy rain', description: '遠い道が使えない', seed: 53, resources: 20, outages: ['1,1|1,2', '6,4|6,5'] },
  { id: 'festival', name: 'Festival', description: '協力すれば資源が増える', seed: 67, resources: 16 },
  { id: 'drought', name: 'Drought', description: '採取地点が枯れている', seed: 71, resources: 12, drought: true },
  { id: 'newcomers', name: 'Newcomers', description: '近隣に新しい住民が現れる', seed: 83, resources: 20, newcomers: true },
  { id: 'night', name: 'Long night', description: '移動コストが高い', seed: 97, resources: 20, night: true },
  { id: 'wild', name: 'Wild paths', description: '経路が毎tick変わる', seed: 101, resources: 18, wild: true },
];
const names = ['Aoi', 'Bram', 'Cleo', 'Dara', 'Eli', 'Faye', 'Gus', 'Hana', 'Ivo', 'June', 'Kato', 'Lina'];
const goals = ['食料を確保する', '隣人と交換する', '橋の向こうを調べる', '共同倉庫を満たす'];
const key = (p: Position) => `${p.x},${p.y}`;
const edge = (a: Position, b: Position) => `${key(a)}|${key(b)}`;
const parsePosition = (value: string): Position | undefined => { const [x, y] = value.split(',').map(Number); return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : undefined; };
const hash = (w: World) => JSON.stringify({ tick: w.tick, resources: w.resources, residents: w.residents.map(r => [r.id, r.position, r.energy, r.inventory]) });
function rng(seed: number) { let x = seed >>> 0; return () => ((x = Math.imul(1664525, x) + 1013904223 | 0) >>> 0) / 4294967296; }
function adjacent(a: Position, b: Position) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1; }
function basePaths(s: Scenario) { const paths: Record<string, boolean> = {}; for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) { if (x < 7) paths[edge({ x, y }, { x: x + 1, y })] = true; if (y < 5) paths[edge({ x, y }, { x, y: y + 1 })] = true; } for (const e of s.outages ?? []) paths[e] = false; return paths; }
function pathsForTick(s: Scenario, tick: number) { const paths = basePaths(s); if (!s.wild) return paths; const random = rng(s.seed + tick * 7919); for (const route of Object.keys(paths)) if (random() < 0.1) paths[route] = !paths[route]; return paths; }
function actionEnergyCost(world: World, action: Action) { return world.scenario.night && action.type === 'move' ? 2 : 1; }
function finalizeMetrics(world: World) { world.metrics.survival = world.residents.filter(r => r.energy > 0).length; return world; }

export function createWorld(scenario: Scenario | string = scenarios[0]): World {
  const s = typeof scenario === 'string' ? scenarios.find(x => x.id === scenario) ?? scenarios[0] : scenario;
  const random = rng(s.seed);
  const residentNames = s.newcomers ? [...names, 'Mio'] : names;
  const residents = residentNames.map((name, i) => ({ id: `resident-${i + 1}`, name, goal: goals[i % goals.length], position: s.newcomers && i === names.length ? { x: 4, y: 2 } : { x: i % 8, y: Math.floor(i / 8) + 1 }, energy: 10, memory: s.memoryLoss && i % 4 === 0 ? [] : ['朝に共同倉庫を確認した'], inventory: 0, history: [] }));
  const resources: Record<string, number> = {};
  for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) resources[`${x},${y}`] = s.drought ? 0 : random() < 0.25 ? 2 : 0;
  return { tick: 0, seed: s.seed, scenario: s, resources, paths: pathsForTick(s, 0), residents, metrics: { survival: residents.length, resources: s.resources, trades: 0, cooperation: 0, cost: 0 }, trace: [] };
}
function clone<T>(value: T): T { return structuredClone(value); }

export function observeResident(world: World, residentId: string): Observation {
  const resident = world.residents.find(r => r.id === residentId); if (!resident) throw new Error('unknown resident');
  const visible = world.residents.filter(r => r.id !== resident.id && Math.abs(r.position.x - resident.position.x) <= 1 && Math.abs(r.position.y - resident.position.y) <= 1).map(r => ({ id: r.id, name: r.name, position: clone(r.position), inventory: r.inventory }));
  const localResources: Record<string, number> = {}; for (let y = Math.max(0, resident.position.y - 1); y <= Math.min(5, resident.position.y + 1); y++) for (let x = Math.max(0, resident.position.x - 1); x <= Math.min(7, resident.position.x + 1); x++) localResources[`${x},${y}`] = world.resources[`${x},${y}`] ?? 0;
  const paths = Object.fromEntries(Object.entries(world.paths).filter(([encoded]) => { const [left, right] = encoded.split('|').map(parsePosition); return !!left && !!right && (key(left) === key(resident.position) || key(right) === key(resident.position)); }));
  const candidates: Action[] = [{ residentId, type: 'wait' }];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const target = { x: resident.position.x + dx, y: resident.position.y + dy }; if (target.x >= 0 && target.x < 8 && target.y >= 0 && target.y < 6 && (paths[edge(resident.position, target)] ?? paths[edge(target, resident.position)])) candidates.push({ residentId, type: 'move', target }); }
  if ((localResources[key(resident.position)] ?? 0) > 0) candidates.push({ residentId, type: 'gather', amount: 1 });
  for (const other of visible.filter(v => key(v.position) === key(resident.position))) { candidates.push({ residentId, type: 'trade', withResidentId: other.id, amount: 1 }); candidates.push({ residentId, type: 'cooperate', withResidentId: other.id }); }
  return { self: { id: resident.id, name: resident.name, goal: resident.goal, position: clone(resident.position), energy: resident.energy, inventory: resident.inventory }, visible, localResources, paths, memory: [...resident.memory], history: [...resident.history], candidates };
}

export function validateAction(world: World, action: Action): { ok: true } | { ok: false; reason: string } {
  const resident = world.residents.find(x => x.id === action.residentId); if (!resident) return { ok: false, reason: 'unknown resident' };
  if (resident.energy < actionEnergyCost(world, action)) return { ok: false, reason: 'resident has no energy' };
  const amount = action.amount === undefined ? 1 : action.amount;
  if ((action.type === 'gather' || action.type === 'trade') && (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0)) return { ok: false, reason: 'amount must be finite and positive' };
  if (action.type === 'move') { if (!action.target || action.target.x < 0 || action.target.x >= 8 || action.target.y < 0 || action.target.y >= 6) return { ok: false, reason: 'target outside map' }; if (!adjacent(resident.position, action.target) || (!(world.paths[edge(resident.position, action.target)] ?? false) && !(world.paths[edge(action.target, resident.position)] ?? false))) return { ok: false, reason: 'path unavailable' }; }
  if (action.type === 'gather' && (world.resources[key(resident.position)] ?? 0) < amount) return { ok: false, reason: 'not enough local resource' };
  if ((action.type === 'trade' || action.type === 'cooperate') && !action.withResidentId) return { ok: false, reason: 'target resident required' };
  if (action.type === 'trade') { const other = world.residents.find(x => x.id === action.withResidentId); if (!other || key(other.position) !== key(resident.position)) return { ok: false, reason: 'trade target not co-located' }; if (resident.inventory < amount) return { ok: false, reason: 'not enough inventory' }; }
  if (action.type === 'cooperate') { const other = world.residents.find(x => x.id === action.withResidentId); if (!other || key(other.position) !== key(resident.position)) return { ok: false, reason: 'cooperation target not co-located' }; }
  return { ok: true };
}

export function applyAction(world: World, action: Action): { world: World; event: TraceEvent } {
  const next = clone(world); const observation = observeResident(world, action.residentId); const valid = validateAction(world, action);
  if (!valid.ok) { finalizeMetrics(next); const event: TraceEvent = { tick: world.tick, nextTick: world.tick, action: clone(action), observation, applied: false, reason: valid.reason, stateHash: hash(world) }; next.trace.push(event); return { world: next, event }; }
  const resident = next.residents.find(x => x.id === action.residentId)!; resident.energy -= actionEnergyCost(world, action); resident.history.push(`${action.type} at tick ${world.tick}`);
  if (action.type === 'move') resident.position = clone(action.target!);
  const amount = action.amount === undefined ? 1 : action.amount;
  if (action.type === 'gather') { next.resources[key(resident.position)] -= amount; resident.inventory += amount; next.metrics.resources += amount; }
  if (action.type === 'trade') { resident.inventory -= amount; next.residents.find(x => x.id === action.withResidentId)!.inventory += amount; next.metrics.trades++; }
  if (action.type === 'cooperate') { next.metrics.cooperation++; next.metrics.resources++; resident.inventory++; next.residents.find(x => x.id === action.withResidentId)!.inventory++; }
  next.metrics.cost++; finalizeMetrics(next);
  const event: TraceEvent = { tick: world.tick, nextTick: world.tick, action: clone(action), observation, applied: true, stateHash: hash(next) }; next.trace.push(event); return { world: next, event };
}

export function chooseRule(world: World, residentId: string): Action { const observation = observeResident(world, residentId); const gather = observation.candidates.find(a => a.type === 'gather'); if (gather) return gather; const cooperate = observation.candidates.find(a => a.type === 'cooperate'); if (cooperate && observation.self.inventory === 0) return cooperate; return observation.candidates.find(a => a.type === 'move') ?? observation.candidates[0]; }
export function actorForTick(world: World) { return world.residents[world.tick % world.residents.length]?.id ?? world.residents[0]?.id; }

export function stepWorld(world: World, mode: Mode = 'replay', residentId?: string): World {
  const actorId = residentId ?? actorForTick(world); if (!actorId) return clone(world);
  if (mode === 'jev') { const next = clone(world); const observation = observeResident(world, actorId); const event: TraceEvent = { tick: world.tick, nextTick: world.tick, action: { residentId: actorId, type: 'wait' }, observation, applied: false, reason: 'Jev live mode is unavailable; no replay fallback was used.', stateHash: hash(world) }; next.trace.push(event); return next; }
  const prepared = world.scenario.wild ? { ...clone(world), paths: pathsForTick(world.scenario, world.tick) } : world;
  const action = mode === 'rule' ? chooseRule(prepared, actorId) : (() => { const candidates = observeResident(prepared, actorId).candidates; return candidates[prepared.tick % candidates.length]; })();
  const result = applyAction(prepared, action); result.world.tick++; if (result.world.scenario.wild) result.world.paths = pathsForTick(result.world.scenario, result.world.tick); result.event.nextTick = result.world.tick; result.world.trace[result.world.trace.length - 1].nextTick = result.world.tick; return result.world;
}

export function replayTrace(trace: TraceEvent[], initial: World): World {
  let state = clone(initial);
  for (let i = 0; i < trace.length; i++) { const event = trace[i]; state.tick = event.tick; if (state.scenario.wild) state.paths = pathsForTick(state.scenario, event.tick); if (event.applied) state = applyAction(state, event.action).world; state.tick = event.nextTick ?? event.tick + 1; if (state.scenario.wild) state.paths = pathsForTick(state.scenario, state.tick); state.trace = clone(trace.slice(0, i + 1)); finalizeMetrics(state); }
  return state;
}

export function scenarioMetrics(scenario: Scenario) { const start = createWorld(scenario); let state = start; for (let i = 0; i < start.residents.length; i++) state = stepWorld(state, 'rule'); return state.metrics; }
