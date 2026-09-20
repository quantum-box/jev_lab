import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSemanticLint, evaluateSemanticCase, interactionSamples, semanticEvaluationFixture, semanticEvaluationMetrics } from '../lib/semantic-lint';

test('semantic lint classifies the five interaction samples without executing code', () => {
  assert.equal(analyzeSemanticLint(interactionSamples[0]).overall, 'no_issue_detected');
  assert.equal(analyzeSemanticLint(interactionSamples[1]).overall, 'suspected_violation');
  assert.equal(analyzeSemanticLint(interactionSamples[2]).overall, 'suspected_violation');
  assert.equal(analyzeSemanticLint(interactionSamples[3]).overall, 'insufficient_information');
  const injected = analyzeSemanticLint(interactionSamples[4]);
  assert.equal(injected.overall, 'no_issue_detected');
  assert.equal(injected.codeWasExecuted, false);
  assert.equal(injected.ignoredCommentInstructions, 1);
});

test('line references are always within the submitted snippet', () => {
  const result = analyzeSemanticLint({ code: 'fn f() { let _ = write_file(); }', diff: '' });
  assert.ok(result.findings.some(finding => finding.lineStart === 1));
  for (const finding of result.findings) assert.ok(!finding.lineStart || finding.lineStart <= result.lineCount);
});

test('fixed evaluation has 50 cases and reports comparison metrics', () => {
  assert.equal(semanticEvaluationFixture.length, 50);
  const rows = semanticEvaluationFixture.map(evaluateSemanticCase);
  assert.equal(rows.filter(row => row.passed).length, 50);
  const metrics = semanticEvaluationMetrics(rows);
  assert.equal(metrics.cases, 50);
  assert.ok(metrics.precision >= 0 && metrics.recall >= 0);
  assert.ok('falsePositive' in metrics.baseline && 'falseNegative' in metrics.baseline);
});

test('multiline block comments never become executable findings', () => {
  const result = analyzeSemanticLint({ code: 'fn safe() {\n/*\nlet _ = write_file();\nuse forbidden_crate;\n*/\nperform_checked()?;\n}', diff: '' });
  assert.equal(result.overall, 'no_issue_detected');
});
