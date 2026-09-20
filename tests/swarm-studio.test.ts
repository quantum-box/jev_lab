import test from 'node:test';import assert from 'node:assert/strict';import {createSwarm,runSwarm,stepSwarm,swarmSeeds} from '../lib/swarm-studio';
test('swarm creates twenty robots and ten fixed seeds',()=>{const r=createSwarm();assert.equal(r.robots.length,20);assert.equal(swarmSeeds.length,10);});
test('code layer prevents duplicate assignment per step and stops failed robots',()=>{const r=stepSwarm(createSwarm());const assignments=r.events.filter(e=>e.type==='assign');assert.equal(new Set(assignments.map(e=>e.jobId)).size,assignments.length);assert.ok(r.events.some(e=>e.type==='failure'));});
test('replay is deterministic and capped',()=>{const a=runSwarm();assert.deepEqual(a,runSwarm());assert.ok(a.step<=20);assert.ok(a.estimatedCost<=16.1);});

