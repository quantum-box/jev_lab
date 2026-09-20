import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISPLAY_COMPONENT_REGISTRY,
  LIVING_EVALUATION_CASES,
  LIVING_OPERATION_SAMPLES,
  LIVING_RECORDS,
  evaluateLivingCase,
  resolveLivingUi,
  validateComposition,
} from '../lib/living-ui';

test('Living UI registry is closed and schema versioned', () => {
  assert.deepEqual(DISPLAY_COMPONENT_REGISTRY.map((item) => item.id), ['table', 'comparison', 'cards', 'timeline', 'chart']);
  assert.ok(DISPLAY_COMPONENT_REGISTRY.every((item) => item.schemaVersion === 'living-ui-component-v1'));
  assert.equal(validateComposition({intent: 'scan', components: ['table'], reason: 'test', matchedKeywords: [], sourceRecordIds: ['work-101'], safeFallback: false}), true);
  assert.equal(validateComposition({intent: 'scan', components: ['arbitrary-html' as never], reason: 'test', matchedKeywords: [], sourceRecordIds: ['work-101'], safeFallback: false}), false);
});

test('five operation samples deterministically select their registered display', () => {
  assert.equal(LIVING_OPERATION_SAMPLES.length, 5);
  for (const sample of LIVING_OPERATION_SAMPLES) {
    const first = resolveLivingUi(sample.prompt);
    const second = resolveLivingUi(sample.prompt);
    assert.deepEqual(first.composition, second.composition);
    assert.equal(first.composition.intent, sample.intent);
    assert.ok(sample.expectedComponents.some((component) => first.composition.components.includes(component)));
  }
});

test('invalid intent and missing data fail safely to a read-only table/empty state', () => {
  const unknown = resolveLivingUi('何を表示すればいいか分からない');
  assert.equal(unknown.composition.safeFallback, true);
  assert.deepEqual(unknown.composition.components, ['table']);
  const missing = resolveLivingUi('進捗を見たい', []);
  assert.equal(missing.composition.safeFallback, true);
  assert.equal(missing.records.length, 0);
  assert.match(missing.warning ?? '', /固定レコード/);
});

test('evaluation fixture has 50 cases and supports multiple accepted outcomes', () => {
  assert.equal(LIVING_EVALUATION_CASES.length, 50);
  assert.equal(new Set(LIVING_EVALUATION_CASES.map((item) => item.id)).size, 50);
  assert.ok(LIVING_EVALUATION_CASES.every((item) => item.expectedIntents.length >= 1 && item.expectedComponents.length >= 1));
  const results = LIVING_EVALUATION_CASES.map(evaluateLivingCase);
  assert.ok(results.every((result) => result.intentAccepted && result.componentAccepted));
  assert.equal(LIVING_RECORDS.length, 6);
});

