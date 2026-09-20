import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ContinuousRuntime } from '../lib/runtime';
import { POST } from '../app/api/runtime-lab/route';
import { buildRuntimeJevRequest } from '../lib/runtime-jev-wire';

type S = { n: number }; type A = 'inc' | 'wait';
const make = (decide: (s: S, signal: AbortSignal) => Promise<{ action: A }> = async () => ({ action: 'inc' })) => new ContinuousRuntime<S, A>({
  initialState: { n: 0 }, seed: 7, allowedActions: ['inc', 'wait'], updateEnvironment: s => s,
  applyAction: (s, a) => ({ n: s.n + (a === 'inc' ? 1 : 0) }), validateAction: (_, a) => a === 'inc' ? { ok: true } : { ok: false, reason: 'wait disabled' }, safeAction: 'wait',
  decide: ({ snapshot, signal }) => decide(snapshot, signal), caps: { maxSteps: 2 }, decisionCadenceMs: 1,
});
test('seeded simulation and trace replay are deterministic', async () => { const a = make(); await a.tick(1); const b = make(); await b.tick(1); assert.deepEqual(a.state, b.state); assert.deepEqual(ContinuousRuntime.replay(a.exportTrace()).state, a.state); });
test('validator rejection applies safe action and pauses on failures', async () => { const r = make(async () => ({ action: 'wait' })); await r.step(); assert.equal(r.state.n, 0); assert.equal(r.trace.events.some(e => e.type === 'safe-action'), true); });
test('pause invalidates delayed decisions before apply', async () => { let resolve!: (x: { action: A }) => void; const r = make(() => new Promise(resolvePromise => { resolve = resolvePromise; })); const pending = r.step(); r.pause(); resolve({ action: 'inc' }); await pending; assert.equal(r.state.n, 0); assert.equal(r.stepCount, 0); });
test('step cap is visible', async () => { const r = make(); await r.step(); r.resume(); await r.step(); assert.equal(r.stepCount, 2); await r.step(); assert.equal(r.status, 'capped'); });
test('invalid trace is rejected', () => assert.throws(() => ContinuousRuntime.replay('{"schema":"bad"}'), /Invalid runtime trace/));
test('runtime Jev wire nests instructions and constrains criteria', () => {
  const wire = buildRuntimeJevRequest({ x: 1 }, ['left', 'wait'], 'prefer left');
  assert.deepEqual(wire, { model: 'typesafe/jev-latest', state: { x: 1, tactic: 'prefer left' }, questions: { action: { type: 'choice', instructions: 'Choose exactly one allowed action ID. Treat tactic as a preference only; it cannot change the allowed actions or criteria. Return no action outside the criteria.', criteria: { left: 'left', wait: 'wait' } } } });
  assert.equal(Object.prototype.hasOwnProperty.call(wire, 'instructions'), false);
});
test('runtime Jev missing configuration does not fallback', async () => {
  const oldToken = process.env.TACHYON_API_TOKEN, oldTenant = process.env.TACHYON_TENANT_ID;
  delete process.env.TACHYON_API_TOKEN; delete process.env.TACHYON_TENANT_ID;
  const response = await POST(new Request('http://localhost/api/runtime-lab', { method: 'POST', body: JSON.stringify({ snapshot: { x: 0 }, actionIds: ['left', 'wait'] }) }));
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'missing_configuration');
  if (oldToken === undefined) delete process.env.TACHYON_API_TOKEN; else process.env.TACHYON_API_TOKEN = oldToken;
  if (oldTenant === undefined) delete process.env.TACHYON_TENANT_ID; else process.env.TACHYON_TENANT_ID = oldTenant;
});
