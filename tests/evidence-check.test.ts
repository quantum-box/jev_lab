import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVIDENCE_CHECK_VERSION, checkEvidence, evidenceEvaluationCases, evidenceExamples, evidenceMetrics } from '../lib/evidence-check';

test('five evidence examples classify support, contradiction, insufficiency, injection and multiple citations', () => {
  assert.deepEqual(evidenceExamples.map(item => checkEvidence(item).status), ['supported', 'contradicted', 'insufficient', 'contradicted', 'supported']);
  assert.equal(checkEvidence(evidenceExamples[4]).citations.length, 2);
  assert.equal(checkEvidence(evidenceExamples[3]).ignoredPromptInstructions, 1);
});

test('citations point to existing source text and fixed evaluation has 50 claims', () => {
  assert.equal(evidenceEvaluationCases.length, 50);
  for (const item of evidenceExamples) {
    const result = checkEvidence(item);
    for (const citation of result.citations) {
      const document = item.documents.find(doc => doc.id === citation.documentId)!;
      assert.equal(document.text.slice(citation.start, citation.end), citation.quote);
    }
  }
  const metrics = evidenceMetrics();
  assert.equal(metrics.total, 50);
  assert.ok(metrics.falseSupport >= 0 && metrics.holdRate >= 0);
});

test('evidence version is explicit and text is treated as data', () => {
  assert.match(EVIDENCE_CHECK_VERSION, /evidence-check-rules/);
  assert.equal(checkEvidence(evidenceExamples[3]).status, 'contradicted');
});
