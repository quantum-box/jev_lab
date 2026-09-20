import assert from 'node:assert/strict';
import { test } from 'node:test';
import { incidentCases, incidentEvaluationCases, incidentMetrics, maskSecrets, triageIncident } from '../lib/incident-triage';

test('incident triage selects category and runbook without executing it', () => { const result = triageIncident(incidentCases[0].log); assert.equal(result.category, 'auth'); assert.equal(result.runbooks[0].id, 'RB-AUTH-01'); assert.match(result.fixedResponse, /execute=false/); });
test('unknown or insufficient logs are held and secrets are masked', () => { const result = triageIncident(incidentCases[5].log); assert.equal(result.category, 'unknown'); assert.equal(result.needsInfo, true); assert.equal(maskSecrets('api_key=secret sk-abc123').includes('secret'), false); });
test('short classified logs do not leak a runbook in the fixed response', () => { const result = triageIncident({ id: 'short-401', service: 'api', message: '401' }); assert.equal(result.needsInfo, true); assert.equal(result.category, 'unknown'); assert.deepEqual(result.runbooks, []); assert.match(result.fixedResponse, /category=unknown; runbook=unknown/); });
test('incident evaluation has 50 cases and dangerous misroute metric', () => { const metrics = incidentMetrics(incidentEvaluationCases); assert.equal(incidentEvaluationCases.length, 50); assert.equal(metrics.dangerousMisrouteRate, 0); assert.ok(Number.isFinite(metrics.topRunbookFit)); });
