import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baselinePolicy, evolutionFixedExperiment, evaluatePolicy, finalUnusedScenarios, revisionScenarios, runEvolutionExperiment, selectionHoldoutScenarios, runPolicy } from '../lib/evolution-arena';

test('evolution experiment keeps revision, selection, and final seeds disjoint', () => {
  const all = [...revisionScenarios, ...selectionHoldoutScenarios, ...finalUnusedScenarios].map(item => item.seed);
  assert.equal(new Set(all).size, all.length);
  assert.ok(evolutionFixedExperiment.finalUnusedSeedIds.length > 0);
  assert.ok(evolutionFixedExperiment.claims.some(claim => claim.includes('一般的な自己改善')));
});

test('policy evaluation is deterministic and trace contains snapshots, decisions, and applies', () => {
  const first = runPolicy(baselinePolicy, revisionScenarios[0]);
  const second = runPolicy(baselinePolicy, revisionScenarios[0]);
  assert.deepEqual(first, second);
  assert.ok(first.trace.some(event => event.type === 'snapshot'));
  assert.ok(first.trace.some(event => event.type === 'decision'));
  assert.ok(first.trace.some(event => event.type === 'apply'));
});

test('rollback is recorded when candidates do not improve and limits are explicit', () => {
  const experiment = runEvolutionExperiment(baselinePolicy, { maxGenerations: 1, maxCandidatesPerGeneration: 2, maxEstimatedCost: 220, maxElapsedMs: 2_000 });
  assert.equal(experiment.caps.maxGenerations, 1);
  assert.ok(experiment.generations.some(node => node.disposition === 'rollback' || node.disposition === 'accepted'));
  assert.ok(experiment.totalEstimatedCost <= 220);
});

test('evaluation never changes the immutable scenario fixture', () => {
  const before = JSON.stringify(revisionScenarios);
  evaluatePolicy(baselinePolicy, revisionScenarios, 'revision-training');
  assert.equal(JSON.stringify(revisionScenarios), before);
});

test('aggregate extrema, budget caps, and generation lineage stay truthful', () => {
  const aggregate = evaluatePolicy(baselinePolicy, revisionScenarios, 'revision-training');
  assert.equal(aggregate.worst, Math.min(...aggregate.runs.map(run => run.score)));
  assert.equal(aggregate.best, Math.max(...aggregate.runs.map(run => run.score)));

  const capped = runEvolutionExperiment(baselinePolicy, { maxGenerations: 3, maxCandidatesPerGeneration: 3, maxEstimatedCost: 1, maxElapsedMs: 2_000 });
  assert.ok(capped.totalEstimatedCost <= capped.caps.maxEstimatedCost);
  assert.match(capped.stopReason, /cost cap/);

  const experiment = runEvolutionExperiment();
  const ids = new Set(experiment.generations.map(node => node.id));
  for (const node of experiment.generations.slice(1)) assert.ok(node.parentId && ids.has(node.parentId), `${node.id} has a valid parent`);
});
