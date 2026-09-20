import { createHash, timingSafeEqual } from 'node:crypto';

export type LiveGateCode = 'live_disabled' | 'unauthorized' | 'quota_exceeded' | 'inflight_exceeded' | 'cost_exceeded' | 'body_too_large' | 'duplicate_request' | 'invalid_request_id';

export class LiveGateError extends Error {
  constructor(public code: LiveGateCode, message: string, public status = 403) { super(message); }
}

type Config = {
  hashes: Buffer[]; mode: 'single-instance'; maxInputBytes: number; timeoutMs: number;
  globalRequests: number; globalInflight: number; globalCost: number;
  keyRequests: number; keyInflight: number; keyCost: number; estimatedCost: number;
};
type KeyLedger = { requests: number; inFlight: number; reservedCost: number; settledCost: number; locked: boolean };
type Reservation = { keyId: string; requestId: string; estimatedCost: number; settled: boolean };
export type VerifiedUsage = { input_tokens: number; output_tokens: number };

const ledgers = new Map<string, KeyLedger>();
const active = new Map<string, Reservation>();
const completed = new Map<string, number>();
let global = { requests: 0, inFlight: 0, reservedCost: 0, settledCost: 0, locked: false };
const MAX_RETAINED = 2048;

function positive(name: string, fallback?: number) {
  const raw = process.env[name];
  if (raw === undefined && fallback !== undefined) return fallback;
  const n = Number(raw); return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}
function config(): Config {
  const hashes = (process.env.JEV_LIVE_ACCESS_KEY_HASHES ?? '').split(',').map(x => x.trim()).filter(Boolean);
  const mode = process.env.JEV_LIVE_EXECUTION_MODE;
  if (mode !== 'single-instance' || process.env.JEV_LIVE_SINGLE_INSTANCE !== 'true' || !hashes.length) throw new LiveGateError('live_disabled', 'Jev live execution is disabled or not explicitly configured.', 503);
  if (hashes.some(x => !/^[a-f0-9]{64}$/i.test(x))) throw new LiveGateError('live_disabled', 'Jev live access-key hashes are misconfigured.', 503);
  const vals = [positive('JEV_LIVE_MAX_GLOBAL_REQUESTS'), positive('JEV_LIVE_MAX_GLOBAL_INFLIGHT'), positive('JEV_LIVE_MAX_GLOBAL_COST_NANODOLLARS'), positive('JEV_LIVE_MAX_KEY_REQUESTS'), positive('JEV_LIVE_MAX_KEY_INFLIGHT'), positive('JEV_LIVE_MAX_KEY_COST_NANODOLLARS'), positive('JEV_LIVE_ESTIMATED_COST_NANODOLLARS'), positive('JEV_LIVE_MAX_INPUT_BYTES')];
  if (vals.some(x => x === undefined)) throw new LiveGateError('live_disabled', 'Jev live budget configuration is incomplete.', 503);
  return { hashes: hashes.map(x => Buffer.from(x, 'hex')), mode: 'single-instance', timeoutMs: positive('JEV_LIVE_TIMEOUT_MS', 8000)!, maxInputBytes: vals[7]!, globalRequests: vals[0]!, globalInflight: vals[1]!, globalCost: vals[2]!, keyRequests: vals[3]!, keyInflight: vals[4]!, keyCost: vals[5]!, estimatedCost: vals[6]! };
}
function digest(key: string) { return createHash('sha256').update(key, 'utf8').digest(); }
function keyId(key: string, hashes: Buffer[]) {
  const actual = digest(key); const match = hashes.find(h => h.length === actual.length && timingSafeEqual(h, actual));
  return match ? createHash('sha256').update(match).digest('hex').slice(0, 24) : undefined;
}
function remember(map: Map<string, number>, k: string) { map.set(k, Date.now()); while (map.size > MAX_RETAINED) map.delete(map.keys().next().value!); }

export function resetLiveGateForTests() { ledgers.clear(); active.clear(); completed.clear(); global = { requests: 0, inFlight: 0, reservedCost: 0, settledCost: 0, locked: false }; }

export function authorizeLiveRequest(request: Request, inputBytes: number, requestId: string | undefined) {
  const c = config();
  if (!requestId || !/^[A-Za-z0-9._:-]{8,160}$/.test(requestId)) throw new LiveGateError('invalid_request_id', 'A valid request ID is required.', 400);
  if (!Number.isSafeInteger(inputBytes) || inputBytes < 0 || inputBytes > c.maxInputBytes) throw new LiveGateError('body_too_large', 'Input exceeds the configured live limit.', 413);
  const key = request.headers.get('x-jev-live-access-key');
  if (!key || key.length > 4096 || !keyId(key, c.hashes)) throw new LiveGateError('unauthorized', 'A valid Jev live access key is required.', 401);
  const id = keyId(key, c.hashes)!; const ledger = ledgers.get(id) ?? { requests: 0, inFlight: 0, reservedCost: 0, settledCost: 0, locked: false }; ledgers.set(id, ledger);
  if (completed.has(`${id}:${requestId}`) || active.has(`${id}:${requestId}`)) throw new LiveGateError('duplicate_request', 'This live request ID was already used.', 409);
  if (global.locked || ledger.locked) throw new LiveGateError('cost_exceeded', 'Live cost budget is locked pending verified usage.', 429);
  if (global.requests >= c.globalRequests || ledger.requests >= c.keyRequests) throw new LiveGateError('quota_exceeded', 'Live request quota has been reached.', 429);
  if (global.inFlight >= c.globalInflight || ledger.inFlight >= c.keyInflight) throw new LiveGateError('inflight_exceeded', 'Live in-flight capacity has been reached.', 429);
  if (global.settledCost + global.reservedCost + c.estimatedCost > c.globalCost || ledger.settledCost + ledger.reservedCost + c.estimatedCost > c.keyCost) throw new LiveGateError('cost_exceeded', 'Live cost budget has been reached.', 429);
  global.requests++; global.inFlight++; global.reservedCost += c.estimatedCost; ledger.requests++; ledger.inFlight++; ledger.reservedCost += c.estimatedCost;
  const reservation: Reservation = { keyId: id, requestId, estimatedCost: c.estimatedCost, settled: false }; active.set(`${id}:${requestId}`, reservation);
  return { reservation, timeoutMs: c.timeoutMs };
}

export function verifiedUsage(value: unknown): VerifiedUsage | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  return Number.isSafeInteger(v.input_tokens) && (v.input_tokens as number) >= 0 && Number.isSafeInteger(v.output_tokens) && (v.output_tokens as number) >= 0 ? { input_tokens: v.input_tokens as number, output_tokens: v.output_tokens as number } : undefined;
}
export function settleLiveRequest(reservation: Reservation, result: { costNanodollars?: number; usage?: VerifiedUsage }) {
  if (reservation.settled) return; reservation.settled = true; const c = config(); const ledger = ledgers.get(reservation.keyId)!; const k = `${reservation.keyId}:${reservation.requestId}`; active.delete(k); remember(completed, k);
  global.inFlight--; ledger.inFlight--; global.reservedCost -= reservation.estimatedCost; ledger.reservedCost -= reservation.estimatedCost;
  const cost = result.costNanodollars;
  if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0 || !result.usage) { global.locked = true; ledger.locked = true; return; }
  global.settledCost += cost; ledger.settledCost += cost;
  if (global.settledCost > c.globalCost || ledger.settledCost > c.keyCost) { global.locked = true; ledger.locked = true; }
}

export function cancelLiveRequest(reservation: Reservation) { settleLiveRequest(reservation, {}); }
export function liveErrorResponse(error: unknown) { const e = error instanceof LiveGateError ? error : new LiveGateError('live_disabled', 'Jev live execution is unavailable.', 503); return { code: e.code === 'live_disabled' ? 'missing_configuration' : e.code, error: e.message }; }
