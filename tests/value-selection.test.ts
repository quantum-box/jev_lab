import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyAndNormalizeSelection, extractValueCandidates, selectByJev, selectionExamples, selectionEvaluationCases, selectionMetrics, validateSelection } from '../lib/value-selection';

test('candidate IDs preserve source evidence and Jev selects a candidate, not a generated value', () => {
  const example = selectionExamples[0];
  const candidates = extractValueCandidates(example.text);
  const selected = copyAndNormalizeSelection(example.text, candidates, selectByJev(candidates, 'invoice-total'));
  assert.equal(selected.value, example.expectedTotal);
  assert.equal(selected.raw, '11,000');
  assert.equal(example.text.slice(candidates.find(item => item.id === selected.candidateId)!.start, candidates.find(item => item.id === selected.candidateId)!.end), selected.raw);
});

test('missing total, ambiguous due dates, and OCR-like text stay unknown', () => {
  for (const example of selectionExamples.slice(2)) {
    const candidates = extractValueCandidates(example.text);
    const total = selectByJev(candidates, 'invoice-total');
    const due = selectByJev(candidates, 'payment-due');
    if (example.expectedTotal === null) assert.equal(total.status, 'unknown', example.label);
    if (example.expectedDue === null) assert.equal(due.status, 'unknown', example.label);
  }
});

test('invalid candidate IDs, dates, and kinds are rejected', () => {
  const candidates = extractValueCandidates(selectionExamples[0].text);
  assert.ok(validateSelection(candidates, { target: 'invoice-total', candidateId: 'not-real', status: 'selected', value: 'USD 1.00', raw: '1', reason: '' }).length > 0);
  const invalidDate = [{ id: 'date-bad', kind: 'date' as const, raw: '2026年02月30日', normalized: '2026年02月30日', start: 0, end: 12, label: '支払期日', valid: false }];
  assert.ok(validateSelection(invalidDate, { target: 'payment-due', candidateId: 'date-bad', status: 'selected', value: '2026-02-30', raw: '2026年02月30日', reason: '' }).length > 0);
  assert.ok(validateSelection(candidates, { target: 'payment-due', candidateId: candidates.find(item => item.kind === 'amount')!.id, status: 'selected', value: 'JPY 1.00', raw: '1', reason: '' }).length > 0);
});

test('evaluation has 50 cases and separates extraction and selection metrics', () => {
  assert.equal(selectionEvaluationCases.length, 50);
  const metrics = selectionMetrics(selectionEvaluationCases);
  assert.equal(Number.isFinite(metrics.selectionAccuracy), true);
  assert.equal(Number.isFinite(metrics.extractionMissRate), true);
  assert.equal(Number.isFinite(metrics.selectionMissRate), true);
  assert.equal(Number.isFinite(metrics.holdRate), true);
});

