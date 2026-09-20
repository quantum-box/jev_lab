import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkToolCall, toolCases, toolEvaluationCases, toolMetrics } from '../lib/tool-call-check';

test('tool safety fixed examples are deterministic and code prohibition wins', () => { for (const item of toolCases) assert.equal(checkToolCall(item.request).status, item.expected, item.category); assert.equal(checkToolCall({ tool: 'shell', args: { query: 'anything' } }).status, 'deny'); });
test('tool evaluation exposes dangerous misses, false alarms, hold rate and cost', () => { const metrics = toolMetrics(toolEvaluationCases); assert.equal(toolEvaluationCases.length, 50); assert.equal(metrics.dangerousMissRate, 0); assert.ok(Number.isFinite(metrics.falseAlarmRate)); assert.ok(Number.isFinite(metrics.cost)); });
test('argument mismatch and missing arguments never execute', () => { assert.equal(checkToolCall({ tool: 'weather', args: { city: 'Tokyo', command: 'run' } }).status, 'deny'); assert.equal(checkToolCall({ tool: 'weather', args: {} }).status, 'review'); });
