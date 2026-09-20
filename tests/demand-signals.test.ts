import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeDemandMemo, demandEvaluationCases, demandMemos, demandMetrics, dictionaryBaseline, parseDemandCsv } from '../lib/demand-signals';

test('fixed demand examples preserve unknowns and negative language', () => {
  const negative = analyzeDemandMemo(demandMemos[0].text);
  assert.equal(negative.find(item => item.key === 'purchaseIntent')?.score, 0.05);
  assert.equal(negative.find(item => item.key === 'supplyConcern')?.status, 'unknown');
  const irony = analyzeDemandMemo(demandMemos[1].text);
  assert.equal(irony.find(item => item.key === 'supplyConcern')?.score, 0.85);
  assert.equal(irony.find(item => item.key === 'deliveryUrgency')?.status, 'unknown');
});

test('CSV memo import and dictionary baseline stay local and deterministic', () => {
  const parsed = parseDemandCsv('memo,source\n"至急で供給不足",demo');
  assert.match(parsed.text, /至急/);
  assert.equal(dictionaryBaseline(parsed.text).find(item => item.key === 'deliveryUrgency')?.score, 0.8);
});

test('demand evaluation has 50 cases and finite rubric metrics', () => {
  assert.equal(demandEvaluationCases.length, 50);
  const metrics = demandMetrics(demandEvaluationCases);
  assert.equal(Number.isFinite(metrics.rubricError), true);
  assert.equal(Number.isFinite(metrics.agreementRate), true);
  assert.equal(Number.isFinite(metrics.missingRate), true);
});
