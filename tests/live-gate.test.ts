import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test, afterEach } from 'node:test';
import { authorizeLiveRequest, resetLiveGateForTests, settleLiveRequest, LiveGateError } from '../lib/live-gate';

const key = 'ephemeral-test-key';
const hash = createHash('sha256').update(key).digest('hex');
const base = { JEV_LIVE_ACCESS_KEY_HASHES: hash, JEV_LIVE_EXECUTION_MODE: 'single-instance', JEV_LIVE_SINGLE_INSTANCE: 'true', JEV_LIVE_MAX_GLOBAL_REQUESTS: '2', JEV_LIVE_MAX_GLOBAL_INFLIGHT: '1', JEV_LIVE_MAX_GLOBAL_COST_NANODOLLARS: '100', JEV_LIVE_MAX_KEY_REQUESTS: '2', JEV_LIVE_MAX_KEY_INFLIGHT: '1', JEV_LIVE_MAX_KEY_COST_NANODOLLARS: '100', JEV_LIVE_ESTIMATED_COST_NANODOLLARS: '10', JEV_LIVE_MAX_INPUT_BYTES: '1000' };
const old: Record<string, string | undefined> = {};
afterEach(() => { resetLiveGateForTests(); for (const [k, v] of Object.entries(old)) v === undefined ? delete process.env[k] : process.env[k] = v; for (const k of Object.keys(base)) { if (!(k in old)) delete process.env[k]; } });
function setup() { for (const [k, v] of Object.entries(base)) { old[k] = process.env[k]; process.env[k] = v; } }
function req(id = 'request-001', withKey = true) { return new Request('http://localhost', { headers: { 'x-jev-request-id': id, ...(withKey ? { 'x-jev-live-access-key': key } : {}) } }); }

test('missing key is unauthorized and never reserves', async () => { setup(); await assert.rejects(authorizeLiveRequest(req('request-001', false), 10, 'request-001'), (e: any) => e instanceof LiveGateError && e.code === 'unauthorized'); });
test('single-instance key is accepted and duplicate id is denied', async () => { setup(); const a = await authorizeLiveRequest(req(), 10, 'request-001'); await assert.rejects(authorizeLiveRequest(req(), 10, 'request-001'), (e: any) => e.code === 'duplicate_request'); await settleLiveRequest(a.reservation, { costNanodollars: 10, usage: { input_tokens: 1, output_tokens: 1 } }); });
test('inflight and cost caps fail closed', async () => { setup(); const a = await authorizeLiveRequest(req(), 10, 'request-001'); await assert.rejects(authorizeLiveRequest(req('request-002'), 10, 'request-002'), (e: any) => e.code === 'inflight_exceeded'); await settleLiveRequest(a.reservation, { costNanodollars: 1000, usage: { input_tokens: 1, output_tokens: 1 } }); await assert.rejects(authorizeLiveRequest(req('request-003'), 10, 'request-003'), (e: any) => e.code === 'cost_exceeded' || e.code === 'duplicate_request'); });
test('unknown provider cost locks future reservations', async () => { setup(); const a = await authorizeLiveRequest(req(), 10, 'request-001'); await settleLiveRequest(a.reservation, {}); await assert.rejects(authorizeLiveRequest(req('request-002'), 10, 'request-002'), (e: any) => e.code === 'cost_exceeded'); });
test('settled costs count toward cumulative budget', async () => { setup(); const a = await authorizeLiveRequest(req('request-001'), 10, 'request-001'); await settleLiveRequest(a.reservation, { costNanodollars: 95, usage: { input_tokens: 1, output_tokens: 1 } }); await assert.rejects(authorizeLiveRequest(req('request-002'), 10, 'request-002'), (e: any) => e.code === 'cost_exceeded'); });
test('unknown usage locks future reservations', async () => { setup(); const a = await authorizeLiveRequest(req(), 10, 'request-001'); await settleLiveRequest(a.reservation, { costNanodollars: 10 }); await assert.rejects(authorizeLiveRequest(req('request-002'), 10, 'request-002'), (e: any) => e.code === 'cost_exceeded'); });
