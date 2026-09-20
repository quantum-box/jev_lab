import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConfig, evaluationFixture, evaluateFixtureCase, inferMappings, parseCsv, targetSchema, typeCompatible, validateMappings } from '../lib/column-mapping';

test('CSV parser rejects duplicate and empty headers while preserving values', () => {
  const parsed = parseCsv('name,,name\nA,"",A');
  assert.ok(parsed.warnings.some(w => w.includes('duplicate header')));
  assert.ok(parsed.warnings.some(w => w.includes('empty column')));
  assert.equal(parsed.rows[0][0], 'A');
});
test('CSV parser keeps quoted multiline cells in one record', () => {
  const parsed = parseCsv('name,notes\nA,"line one\nline two"\nB,done');
  assert.deepEqual(parsed.headers, ['name', 'notes']);
  assert.deepEqual(parsed.rows, [['A', 'line one\nline two'], ['B', 'done']]);
  assert.equal(parsed.warnings.length, 0);
});
test('mapping validates required fields, types, and duplicate targets', () => {
  const parsed = parseCsv('name,email\nA,not-an-email');
  const rows = inferMappings(parsed.headers);
  const errors = validateMappings(parsed, rows);
  assert.ok(errors.some(error => error.includes('required target')));
  assert.ok(errors.some(error => error.includes('type compatibility')));
  assert.equal(typeCompatible('a@example.com', 'email'), true);
  assert.equal(typeCompatible('nope', 'email'), false);
  assert.equal(targetSchema.length, 5);
});
test('50-case fixture and config are deterministic', () => {
  assert.equal(evaluationFixture.length, 50);
  assert.ok(new Set(evaluationFixture.map(item => item.category)).size >= 6);
  assert.equal(evaluationFixture.filter(item => evaluateFixtureCase(item).passed).length, 50);
  const rows = inferMappings(['name', 'email', 'created_at']);
  const config = buildConfig(rows, ['created_at']);
  assert.equal(config.inputVersion, 'csv-column-mapping-input-1.0');
  assert.deepEqual(config.mappings, { name: 'customer_name', email: 'email' });
});
