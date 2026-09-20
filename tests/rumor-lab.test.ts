import test from 'node:test';import assert from 'node:assert/strict';import {rumorScenarios,runRumorScenario} from '../lib/rumor-lab';
test('rumor lab has ten synthetic scenarios and deterministic replay',()=>{assert.equal(rumorScenarios.length,10);assert.deepEqual(runRumorScenario(rumorScenarios[1]),runRumorScenario(rumorScenarios[1]));});
test('every node keeps lineage, labels, cost and latency',()=>{const r=runRumorScenario(rumorScenarios[2]);assert.ok(r.nodes.slice(1).every((n,i)=>n.parentId===r.nodes[i].id));assert.ok(r.totalCost>0&&r.totalLatencyMs>0);assert.ok(r.metrics.detectorAccuracy>=0&&r.metrics.detectorAccuracy<=1);});
test('budget stops propagation before overspend',()=>{const r=runRumorScenario(rumorScenarios[0],2);assert.equal(r.stopped,true);assert.ok(r.totalCost<=2);});

