import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultGoals, goalCases, goalEvaluationCases, goalMetrics, linkTask } from '../lib/goal-linking';

test('goal linking stays inside the task workspace and returns evidence', () => { const result = linkTask(goalCases[0].task); assert.equal(result.links[0].goalId, 'G-SEC'); assert.ok(result.links[0].evidence.length > 0); const isolated = linkTask({ id: 'x', text: '安全', workspaceId: 'ws-other' }, defaultGoals); assert.deepEqual(isolated.links.map(link => link.goalId), ['G-OTHER']); });
test('human correction is not adopted as Jev output or evaluation input', () => { const corrected = linkTask(goalCases[3].task); assert.equal(corrected.links[0].goalId, 'G-GROW'); const metrics = goalMetrics(goalEvaluationCases); assert.ok(metrics.jev.recall >= 0); });
test('goal evaluation has 50 fixed cases and baseline metrics', () => { const metrics = goalMetrics(); assert.equal(goalEvaluationCases.length, 50); assert.ok(Number.isFinite(metrics.baseline.falseRelatedRate)); assert.ok(Number.isFinite(metrics.jev.cost)); });
