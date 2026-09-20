/**
 * Deterministic policy-revision experiment built on the Reflex Arena state
 * machine. Only policy text and allow-listed parameters are mutable. The
 * arena, reward, validator, code and held-out fixtures are constants here.
 */
import { applyAction, arenaActions, distance, environment, scenarios, scenarioState, validateAction, type ArenaAction, type ArenaScenario, type ArenaState } from './reflex-arena';

export type PolicyParameters = {
  healAtHealth: number;
  protectAtAllyHealth: number;
  attackWhenAdjacent: boolean;
  preferredMove: 'east' | 'south' | 'toward-exit';
};
export type ArenaPolicy = { id: string; text: string; parameters: PolicyParameters };
export type EvaluationPurpose = 'revision-training' | 'selection-holdout' | 'final-unused';
export type PolicyRun = {
  scenarioId: string;
  seed: number;
  outcome: 'victory' | 'defeat' | 'capped';
  score: number;
  steps: number;
  damageTaken: number;
  trace: EvolutionTraceEvent[];
};
export type EvolutionTraceEvent =
  | { type: 'snapshot'; step: number; state: Pick<ArenaState, 'hero' | 'ally' | 'enemy' | 'health' | 'allyHealth' | 'enemyHealth' | 'outcome'> }
  | { type: 'failure'; step: number; reason: string }
  | { type: 'decision'; step: number; action: ArenaAction; candidates: ArenaAction[] }
  | { type: 'apply'; step: number; action: ArenaAction; outcome: ArenaState['outcome'] };
export type AggregateScore = {
  purpose: EvaluationPurpose;
  seeds: number[];
  wins: number;
  meanScore: number;
  variance: number;
  best: number;
  worst: number;
  estimatedCost: number;
  runs: PolicyRun[];
};
export type GenerationNode = {
  id: string;
  generation: number;
  parentId: string | null;
  policy: ArenaPolicy;
  policyDiff: string[];
  training: AggregateScore;
  selection?: AggregateScore;
  final?: AggregateScore;
  disposition: 'baseline' | 'candidate' | 'accepted' | 'rollback';
  reason: string;
};
export type EvolutionCaps = { maxGenerations: number; maxCandidatesPerGeneration: number; maxEstimatedCost: number; maxElapsedMs: number };
export type EvolutionExperiment = {
  schema: 'jev-evolution-arena-experiment';
  version: 1;
  caps: EvolutionCaps;
  revisionSeedIds: string[];
  selectionSeedIds: string[];
  finalUnusedSeedIds: string[];
  generations: GenerationNode[];
  selectedPolicyId: string;
  stopped: boolean;
  stopReason: string;
  totalEstimatedCost: number;
  elapsedMs: number;
  claims: string[];
};

export const EVOLUTION_CAPS: EvolutionCaps = { maxGenerations: 3, maxCandidatesPerGeneration: 3, maxEstimatedCost: 220, maxElapsedMs: 2_000 };
export const revisionScenarios: ArenaScenario[] = scenarios.slice(0, 4);
export const selectionHoldoutScenarios: ArenaScenario[] = scenarios.slice(4, 6);
export const finalUnusedScenarios: ArenaScenario[] = scenarios.slice(6, 10);
export const baselinePolicy: ArenaPolicy = {
  id: 'policy-baseline-v1',
  text: '敵が近ければ攻撃し、遠ければ東へ進む。味方の体力は結果を見て確認する。',
  parameters: { healAtHealth: 1, protectAtAllyHealth: 1, attackWhenAdjacent: true, preferredMove: 'east' },
};

function scoreRun(state: ArenaState, steps: number): number {
  const outcomeBonus = state.outcome === 'victory' ? 1 : 0;
  const healthScore = (state.health + state.allyHealth) / 10;
  const stepPenalty = Math.min(0.2, steps / 240);
  return Math.max(0, Math.min(1, outcomeBonus * 0.65 + healthScore * 0.35 - stepPenalty));
}
function allowedMove(state: ArenaState, policy: ArenaPolicy): ArenaAction {
  const moves: ArenaAction[] = policy.parameters.preferredMove === 'south' ? ['south', 'east', 'north', 'west'] : ['east', 'south', 'north', 'west'];
  if (policy.parameters.preferredMove === 'toward-exit') {
    const towardX = state.exit.x > state.hero.x ? 'east' : state.exit.x < state.hero.x ? 'west' : null;
    const towardY = state.exit.y > state.hero.y ? 'south' : state.exit.y < state.hero.y ? 'north' : null;
    return ([towardX, towardY, 'east', 'south', 'north', 'west'].filter(Boolean) as ArenaAction[]).find(action => validateAction(state, action).ok) ?? 'wait';
  }
  return moves.find(action => validateAction(state, action).ok) ?? 'wait';
}
function chooseAction(state: ArenaState, policy: ArenaPolicy): ArenaAction {
  if (state.item && distance(state.hero, state.item) === 0 && state.health <= policy.parameters.healAtHealth) return 'heal';
  if (state.allyHealth <= policy.parameters.protectAtAllyHealth) return 'guard';
  if (policy.parameters.attackWhenAdjacent && state.enemyHealth > 0 && distance(state.hero, state.enemy) <= 1) return 'attack';
  if (policy.text.toLowerCase().includes('守') && state.allyHealth < 5) return 'guard';
  return allowedMove(state, policy);
}
function snapshot(state: ArenaState): Pick<ArenaState, 'hero' | 'ally' | 'enemy' | 'health' | 'allyHealth' | 'enemyHealth' | 'outcome'> {
  return { hero: { ...state.hero }, ally: { ...state.ally }, enemy: { ...state.enemy }, health: state.health, allyHealth: state.allyHealth, enemyHealth: state.enemyHealth, outcome: state.outcome };
}

export function runPolicy(policy: ArenaPolicy, scenario: ArenaScenario, maxSteps = 24): PolicyRun {
  let state = scenarioState(scenario);
  const trace: EvolutionTraceEvent[] = [];
  for (let step = 1; step <= maxSteps; step++) {
    state = environment(state);
    trace.push({ type: 'snapshot', step, state: snapshot(state) });
    if (state.outcome !== 'running') break;
    const candidates = arenaActions.filter(action => validateAction(state, action).ok);
    const action = chooseAction(state, policy);
    trace.push({ type: 'decision', step, action, candidates });
    if (!validateAction(state, action).ok) {
      trace.push({ type: 'failure', step, reason: 'candidate action rejected by immutable validator' });
      state = applyAction(state, 'guard');
    } else state = applyAction(state, action);
    trace.push({ type: 'apply', step, action, outcome: state.outcome });
    if (state.outcome !== 'running') break;
  }
  if (state.outcome === 'running') trace.push({ type: 'failure', step: maxSteps, reason: 'maximum steps reached before terminal outcome' });
  return { scenarioId: scenario.id, seed: scenario.seed, outcome: state.outcome === 'running' ? 'capped' : state.outcome, score: scoreRun(state, state.step), steps: state.step, damageTaken: state.damageTaken, trace };
}

export function evaluatePolicy(policy: ArenaPolicy, fixtures: ArenaScenario[], purpose: EvaluationPurpose): AggregateScore {
  const runs = fixtures.map(scenario => runPolicy(policy, scenario));
  const scores = runs.map(run => run.score);
  const meanScore = scores.reduce((sum, value) => sum + value, 0) / Math.max(1, scores.length);
  const variance = scores.reduce((sum, value) => sum + (value - meanScore) ** 2, 0) / Math.max(1, scores.length);
  return { purpose, seeds: fixtures.map(scenario => scenario.seed), wins: runs.filter(run => run.outcome === 'victory').length, meanScore, variance, best: Math.max(...scores, 0), worst: Math.min(...scores, 0), estimatedCost: runs.reduce((sum, run) => sum + 1 + run.steps / 24, 0), runs };
}

export function policyDiff(before: ArenaPolicy, after: ArenaPolicy): string[] {
  const changes: string[] = [];
  if (before.text !== after.text) changes.push('方針テキスト: 「' + before.text + '」 → 「' + after.text + '」');
  (Object.keys(after.parameters) as Array<keyof PolicyParameters>).forEach(key => { if (before.parameters[key] !== after.parameters[key]) changes.push('許可パラメータ ' + key + ': ' + String(before.parameters[key]) + ' → ' + String(after.parameters[key])); });
  return changes.length ? changes : ['変更なし'];
}

function candidatesFromFailures(policy: ArenaPolicy, training: AggregateScore): ArenaPolicy[] {
  const failed = training.runs.filter(run => run.outcome !== 'victory');
  const hasGuardFailure = failed.some(run => run.trace.some(event => event.type === 'failure' || (event.type === 'snapshot' && event.state.allyHealth <= 2)));
  return [
    { id: policy.id + '-guard', text: policy.text + ' 味方の体力が3以下なら護衛する。', parameters: { ...policy.parameters, protectAtAllyHealth: 3, preferredMove: 'toward-exit' } },
    { id: policy.id + '-recover', text: policy.text + ' 負傷時はフィールドキットで回復する。', parameters: { ...policy.parameters, healAtHealth: 3, preferredMove: 'toward-exit' } },
    { id: policy.id + '-conservative', text: hasGuardFailure ? policy.text + ' 味方を優先して護衛する。' : policy.text + ' 出口方向を優先し、無理な攻撃を避ける。', parameters: { ...policy.parameters, protectAtAllyHealth: 4, attackWhenAdjacent: false, preferredMove: 'toward-exit' } },
  ];
}

function scoreIsImprovement(candidate: AggregateScore, current: AggregateScore) {
  return candidate.meanScore > current.meanScore + 0.0001 || candidate.wins > current.wins;
}
function assertSeedSeparation() {
  const revision = new Set(revisionScenarios.map(scenario => scenario.seed));
  const selection = new Set(selectionHoldoutScenarios.map(scenario => scenario.seed));
  const final = new Set(finalUnusedScenarios.map(scenario => scenario.seed));
  return ![...selection].some(seed => revision.has(seed)) && ![...final].some(seed => revision.has(seed) || selection.has(seed));
}

export function runEvolutionExperiment(initialPolicy = baselinePolicy, caps: EvolutionCaps = EVOLUTION_CAPS): EvolutionExperiment {
  if (!assertSeedSeparation()) throw new Error('evaluation seed separation violated');
  const started = Date.now();
  const generations: GenerationNode[] = [];
  let current = initialPolicy;
  let currentTraining = evaluatePolicy(current, revisionScenarios, 'revision-training');
  let totalCost = currentTraining.estimatedCost;
  generations.push({ id: 'generation-0', generation: 0, parentId: null, policy: current, policyDiff: ['baseline: no revision'], training: currentTraining, disposition: 'baseline', reason: '固定方針の基準値' });
  let stopped = false;
  let stopReason = '';
  for (let generation = 1; generation <= caps.maxGenerations; generation++) {
    if (Date.now() - started > caps.maxElapsedMs || totalCost >= caps.maxEstimatedCost) { stopped = true; stopReason = 'cap reached before candidate generation'; break; }
    const proposed = candidatesFromFailures(current, currentTraining).slice(0, caps.maxCandidatesPerGeneration);
    let accepted: { policy: ArenaPolicy; training: AggregateScore; diff: string[] } | null = null;
    for (const candidate of proposed) {
      const training = evaluatePolicy(candidate, revisionScenarios, 'revision-training');
      totalCost += training.estimatedCost;
      const diff = policyDiff(current, candidate);
      if (!accepted || scoreIsImprovement(training, accepted.training)) accepted = { policy: candidate, training, diff };
      generations.push({ id: 'generation-' + generation + '-' + candidate.id, generation, parentId: 'generation-' + (generation - 1), policy: candidate, policyDiff: diff, training, disposition: 'candidate', reason: 'failure trace からの決定的候補' });
      if (totalCost >= caps.maxEstimatedCost) { stopped = true; stopReason = 'estimated cost cap reached'; break; }
    }
    if (!accepted) { stopped = true; stopReason = 'no candidate available'; break; }
    if (scoreIsImprovement(accepted.training, currentTraining)) {
      current = accepted.policy; currentTraining = accepted.training;
      const node = generations.find(item => item.policy.id === current.id);
      if (node) { node.disposition = 'accepted'; node.reason = '訓練セットで改善。次世代へ進む'; }
    } else {
      const node = generations.find(item => item.policy.id === accepted!.policy.id);
      if (node) { node.disposition = 'rollback'; node.reason = '改善なし／悪化のため baseline に rollback'; }
      stopped = true; stopReason = 'no improvement; rollback recorded'; break;
    }
  }
  const selected = generations.filter(node => node.disposition === 'accepted').at(-1) ?? generations[0];
  selected.selection = evaluatePolicy(selected.policy, selectionHoldoutScenarios, 'selection-holdout');
  selected.final = evaluatePolicy(selected.policy, finalUnusedScenarios, 'final-unused');
  totalCost += (selected.selection?.estimatedCost ?? 0) + (selected.final?.estimatedCost ?? 0);
  const elapsedMs = Date.now() - started;
  return { schema: 'jev-evolution-arena-experiment', version: 1, caps, revisionSeedIds: revisionScenarios.map(scenario => scenario.id), selectionSeedIds: selectionHoldoutScenarios.map(scenario => scenario.id), finalUnusedSeedIds: finalUnusedScenarios.map(scenario => scenario.id), generations, selectedPolicyId: selected.policy.id, stopped: stopped || generations.length > caps.maxGenerations, stopReason: stopReason || (generations.length > caps.maxGenerations ? 'generation cap reached' : 'experiment completed'), totalEstimatedCost: totalCost, elapsedMs, claims: ['この固定実験の結果は、一般的な自己改善を意味しない。', '改善なし・退化・ばらつきも有効な実験記録として保存する。', '最終未使用セットは候補生成・選別に使っていない。'] };
}

export const evolutionFixedExperiment = runEvolutionExperiment();

