/** A small, provider-agnostic continuous decision runtime.
 *  The simulator is deliberately clock-driven: environment ticks and decision
 *  cadence are separate, which makes a saved trace useful without a provider.
 */
export type RuntimeStatus = 'idle' | 'running' | 'paused' | 'capped' | 'failed' | 'completed';
export type UsageState = { status: 'unavailable' } | { status: 'measured'; inputTokens: number; outputTokens: number };
export type CostState = { status: 'unavailable' } | { status: 'measured'; nanodollars: number };
export type RuntimeCaps = { maxSteps?: number; maxElapsedMs?: number; maxConcurrency?: number; maxEstimatedCostNanodollars?: number };
export type RuntimeMetrics = { status: RuntimeStatus; actionCount: number; elapsedWallMs: number; inFlight: number; decisionLatencyMs: number[]; usage: UsageState; cost: CostState; caps: RuntimeCaps };
export type RuntimeTraceEvent<S, A> =
  | { type: 'snapshot'; step: number; state: S; atMs: number }
  | { type: 'decision'; step: number; action: A; adapter: string; latencyMs: number }
  | { type: 'safe-action'; step: number; action: A; reason: string }
  | { type: 'apply'; step: number; action: A; state: S; atMs: number }
  | { type: 'pause' | 'resume' | 'reset' | 'cap' | 'error'; step: number; reason?: string };
export type Decision<A> = { action: A; usage?: UsageState; cost?: CostState };
export type DecisionAdapter<S, A> = (input: { snapshot: S; allowedActions: readonly A[]; signal: AbortSignal }) => Promise<Decision<A>>;
export type ActionValidation = { ok: true } | { ok: false; reason: string };
export type RuntimeConfig<S, A> = {
  initialState: S; seed: number; allowedActions: readonly A[];
  updateEnvironment: (state: S, random: () => number, elapsedMs: number) => S;
  applyAction: (state: S, action: A) => S;
  validateAction: (state: S, action: A) => ActionValidation;
  safeAction: A;
  decide: DecisionAdapter<S, A>;
  adapterName?: string; decisionCadenceMs?: number; caps?: RuntimeCaps;
  now?: () => number;
};
export type RuntimeTrace<S, A> = { schema: 'jev-runtime-trace'; version: 1; seed: number; initialState: S; events: RuntimeTraceEvent<S, A>[] };

export class RuntimeError extends Error { constructor(public code: string, message: string) { super(message); } }

function seeded(seed: number) { let x = (seed >>> 0) || 1; return () => { x = (Math.imul(1664525, x) + 1013904223) >>> 0; return x / 0x100000000; }; }

export class ContinuousRuntime<S, A> {
  private readonly config: RuntimeConfig<S, A>; private readonly random: () => number; private readonly now: () => number;
  private stateValue: S; private statusValue: RuntimeStatus = 'idle'; private stepValue = 0; private elapsedValue = 0; private lastDecisionAt = -Infinity;
  private generation = 0; private inFlightValue = 0; private traceValue: RuntimeTraceEvent<S, A>[] = []; private latencies: number[] = [];
  private controllers = new Set<AbortController>();
  private usageValue: UsageState = { status: 'unavailable' }; private costValue: CostState = { status: 'unavailable' };
  constructor(config: RuntimeConfig<S, A>) { this.config = { ...config, caps: config.caps ?? {} }; this.stateValue = config.initialState; this.random = seeded(config.seed); this.now = config.now ?? (() => Date.now()); }
  get state() { return this.stateValue; } get status() { return this.statusValue; } get stepCount() { return this.stepValue; }
  get metrics(): RuntimeMetrics { return { status: this.statusValue, actionCount: this.stepValue, elapsedWallMs: this.elapsedValue, inFlight: this.inFlightValue, decisionLatencyMs: [...this.latencies], usage: this.usageValue, cost: this.costValue, caps: this.config.caps ?? {} }; }
  get trace(): RuntimeTrace<S, A> { return { schema: 'jev-runtime-trace', version: 1, seed: this.config.seed, initialState: this.config.initialState, events: this.traceValue.map(e => structuredClone(e)) }; }
  start() { if (this.statusValue === 'idle') { this.statusValue = 'running'; this.lastDecisionAt = this.elapsedValue - (this.config.decisionCadenceMs ?? 1000); } return this.statusValue; }
  pause() { if (this.statusValue === 'running') { this.statusValue = 'paused'; this.generation++; for (const c of this.controllers) c.abort(); this.controllers.clear(); this.traceValue.push({ type: 'pause', step: this.stepValue }); } return this.statusValue; }
  resume() { if (this.statusValue === 'paused') { this.statusValue = 'running'; this.generation++; this.traceValue.push({ type: 'resume', step: this.stepValue }); } return this.statusValue; }
  reset(seed = this.config.seed) { this.generation++; this.stateValue = structuredClone(this.config.initialState); this.stepValue = 0; this.elapsedValue = 0; this.lastDecisionAt = -Infinity; this.statusValue = 'idle'; this.inFlightValue = 0; this.traceValue = [{ type: 'reset', step: 0 }]; this.latencies = []; this.usageValue = { status: 'unavailable' }; this.costValue = { status: 'unavailable' }; if (seed !== this.config.seed) throw new RuntimeError('seed_immutable', 'Create a new runtime to change the seed.'); }
  private capCheck() { const c = this.config.caps ?? {}; if (c.maxSteps !== undefined && this.stepValue >= c.maxSteps || c.maxElapsedMs !== undefined && this.elapsedValue >= c.maxElapsedMs || c.maxEstimatedCostNanodollars !== undefined && this.costValue.status === 'measured' && this.costValue.nanodollars >= c.maxEstimatedCostNanodollars) { this.statusValue = 'capped'; this.traceValue.push({ type: 'cap', step: this.stepValue, reason: 'configured cap reached' }); return true; } return false; }
  async tick(deltaMs: number): Promise<void> { if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RuntimeError('invalid_delta', 'deltaMs must be non-negative'); this.elapsedValue += deltaMs; if (this.capCheck() || this.statusValue !== 'running') return; this.stateValue = this.config.updateEnvironment(this.stateValue, this.random, this.elapsedValue); const cadence = this.config.decisionCadenceMs ?? 1000; if (this.elapsedValue - this.lastDecisionAt >= cadence) await this.step(); this.capCheck(); }
  async step(): Promise<void> {
    if (this.statusValue === 'idle') this.start(); if (this.statusValue !== 'running') return;
    const cap = this.config.caps?.maxConcurrency ?? 1; if (this.inFlightValue >= cap) return;
    if (this.config.caps?.maxSteps !== undefined && this.stepValue >= this.config.caps.maxSteps) { this.capCheck(); return; }
    const snapshot = structuredClone(this.stateValue); const generation = this.generation; const step = this.stepValue + 1; this.traceValue.push({ type: 'snapshot', step, state: snapshot, atMs: this.elapsedValue });
    const controller = new AbortController(); this.controllers.add(controller); this.inFlightValue++; this.lastDecisionAt = this.elapsedValue; const started = this.now();
    try { const result = await this.config.decide({ snapshot, allowedActions: this.config.allowedActions, signal: controller.signal }); if (generation !== this.generation || this.statusValue !== 'running') throw new RuntimeError('stale_decision', 'Decision invalidated before apply.');
      if (!this.config.allowedActions.some(a => Object.is(a, result.action))) throw new RuntimeError('disallowed_action', 'Decision is not an allowed action.'); const check = this.config.validateAction(snapshot, result.action); if (!check.ok) { this.traceValue.push({ type: 'safe-action', step, action: this.config.safeAction, reason: check.reason }); this.stateValue = this.config.applyAction(snapshot, this.config.safeAction); }
      else { this.traceValue.push({ type: 'decision', step, action: result.action, adapter: this.config.adapterName ?? 'adapter', latencyMs: Math.max(0, this.now() - started) }); this.stateValue = this.config.applyAction(snapshot, result.action); }
      const action = check.ok ? result.action : this.config.safeAction; this.stepValue++; this.traceValue.push({ type: 'apply', step, action, state: structuredClone(this.stateValue), atMs: this.elapsedValue }); this.latencies.push(Math.max(0, this.now() - started)); if (result.usage) this.usageValue = result.usage; if (result.cost) this.costValue = result.cost;
    } catch (error) { if (error instanceof RuntimeError && error.code === 'stale_decision') return; this.traceValue.push({ type: 'error', step, reason: error instanceof Error ? error.message : 'decision failed' }); this.stateValue = this.config.applyAction(snapshot, this.config.safeAction); this.stepValue++; this.traceValue.push({ type: 'safe-action', step, action: this.config.safeAction, reason: 'decision failed or timed out' }, { type: 'apply', step, action: this.config.safeAction, state: structuredClone(this.stateValue), atMs: this.elapsedValue }); this.statusValue = 'paused';
    } finally { this.controllers.delete(controller); this.inFlightValue--; }
  }
  exportTrace() { const json = JSON.stringify(this.trace); if (json.length > 500_000) throw new RuntimeError('trace_too_large', 'Trace exceeds 500KB.'); return json; }
  static validateTrace<S, A>(value: unknown): value is RuntimeTrace<S, A> { if (!value || typeof value !== 'object') return false; const v = value as Record<string, unknown>; return v.schema === 'jev-runtime-trace' && v.version === 1 && Number.isFinite(v.seed) && Array.isArray(v.events) && v.events.length <= 10000; }
  static replay<S, A>(serialized: string | RuntimeTrace<S, A>): { state: S; events: RuntimeTraceEvent<S, A>[] } { const v = typeof serialized === 'string' ? JSON.parse(serialized) : serialized; if (!ContinuousRuntime.validateTrace<S, A>(v)) throw new RuntimeError('invalid_trace', 'Invalid runtime trace.'); const applies = v.events.filter((e): e is Extract<RuntimeTraceEvent<S, A>, {type:'apply'}> => typeof e === 'object' && e !== null && (e as {type?:string}).type === 'apply'); const last = applies.at(-1); return { state: structuredClone(last?.state ?? v.initialState), events: v.events.map(e => structuredClone(e)) }; }
}

export function compareBaseline<S, A>(trace: RuntimeTrace<S, A>, baseline: RuntimeTrace<S, A>) { const a = trace.events.filter(e => e.type === 'apply').map(e => JSON.stringify(e.type === 'apply' ? e.action : null)); const b = baseline.events.filter(e => e.type === 'apply').map(e => JSON.stringify(e.type === 'apply' ? e.action : null)); return { sameLength: a.length === b.length, matchingActions: a.filter((x, i) => x === b[i]).length, traceActions: a.length, baselineActions: b.length }; }
