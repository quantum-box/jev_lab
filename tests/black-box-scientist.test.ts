import test from 'node:test';import assert from 'node:assert/strict';import {devices,runScientist} from '../lib/black-box-scientist';
test('scientist uses ten fixed devices and respects budget',()=>{assert.equal(devices.length,10);const r=runScientist(devices[0],2);assert.ok(r.experiments.length<=2&&r.cost<=2);});
test('hidden device is deterministic and evaluated on unused inputs',()=>{const a=runScientist(devices[1]);assert.deepEqual(a,runScientist(devices[1]));assert.ok(a.unseenAccuracy>=0&&a.unseenAccuracy<=1);});
test('missing correct hypothesis is explicit',()=>{const r=runScientist(devices[0],5,false);assert.equal(r.candidateMissing,true);});

