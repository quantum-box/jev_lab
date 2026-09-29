import { DurableObject } from 'cloudflare:workers';

type Limits = {
  globalRequests: number; globalInflight: number; globalCost: number;
  keyRequests: number; keyInflight: number; keyCost: number;
  estimatedCost: number; timeoutMs: number; maxInputBytes: number;
};
type Counter = { requests: number; inFlight: number; reservedCost: number; settledCost: number; blockedUnknown: boolean };
type Pending = { keyId: string; requestId: string; estimatedCost: number; expiresAt: number; day: string };
type Ledger = { version: 1; day: string; global: Counter; keys: Record<string, Counter>; pending: Record<string, Pending>; usedRequestIds: Record<string, number> };
type LedgerError = { code: string; error: string; status: number };

const newCounter = (blockedUnknown = false): Counter => ({ requests: 0, inFlight: 0, reservedCost: 0, settledCost: 0, blockedUnknown });
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const reservationId = (keyId: string, requestId: string) => `${keyId}:${requestId}`;

function error(code: string): LedgerError {
  const entries: Record<string, Omit<LedgerError, 'code'>> = {
    invalid_request_id: { error: 'A valid live request ID is required.', status: 400 },
    body_too_large: { error: 'Input exceeds the configured live limit.', status: 413 },
    duplicate_request: { error: 'This live request ID was already used.', status: 409 },
    quota_exceeded: { error: 'The daily live request quota has been reached.', status: 429 },
    inflight_exceeded: { error: 'Live in-flight capacity has been reached.', status: 429 },
    cost_exceeded: { error: 'The live cost budget is exhausted or locked pending verified usage.', status: 429 },
    live_disabled: { error: 'The durable live quota ledger is unavailable.', status: 503 },
  };
  return { code, ...(entries[code] ?? entries.live_disabled) };
}

function validLimits(value: unknown): value is Limits {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const l = value as Record<string, unknown>;
  return ['globalRequests', 'globalInflight', 'globalCost', 'keyRequests', 'keyInflight', 'keyCost', 'estimatedCost', 'timeoutMs', 'maxInputBytes']
    .every(k => Number.isSafeInteger(l[k]) && (l[k] as number) > 0);
}

function emptyLedger(day: string): Ledger {
  return { version: 1, day, global: newCounter(), keys: {}, pending: {}, usedRequestIds: {} };
}

function rollover(ledger: Ledger, day: string) {
  if (ledger.day === day) return;
  const keysWithUnsettledRequests = new Set<string>();
  for (const pending of Object.values(ledger.pending)) {
    keysWithUnsettledRequests.add(pending.keyId);
  }
  ledger.pending = {};
  ledger.global = newCounter(keysWithUnsettledRequests.size > 0);
  for (const keyId of Object.keys(ledger.keys)) ledger.keys[keyId] = newCounter(keysWithUnsettledRequests.has(keyId));
  ledger.day = day;
}

function expire(ledger: Ledger, now: number) {
  for (const [id, pending] of Object.entries(ledger.pending)) {
    if (pending.expiresAt > now) continue;
    ledger.global.blockedUnknown = true;
    const key = ledger.keys[pending.keyId];
    if (key) key.blockedUnknown = true;
    ledger.global.inFlight = Math.max(0, ledger.global.inFlight - 1);
    ledger.global.reservedCost = Math.max(0, ledger.global.reservedCost - pending.estimatedCost);
    if (key) {
      key.inFlight = Math.max(0, key.inFlight - 1);
      key.reservedCost = Math.max(0, key.reservedCost - pending.estimatedCost);
    }
    delete ledger.pending[id];
  }
  for (const [id, expiresAt] of Object.entries(ledger.usedRequestIds)) if (expiresAt <= now) delete ledger.usedRequestIds[id];
}

export class JevLiveLedger extends DurableObject<{}> {
  async fetch(request: Request): Promise<Response> {
    const action = new URL(request.url).pathname.slice(1);
    if (request.method !== 'POST' || (action !== 'reserve' && action !== 'settle')) return Response.json(error('live_disabled'), { status: 404 });
    let body: Record<string, unknown>;
    try {
      const value = await request.json();
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid body');
      body = value as Record<string, unknown>;
    } catch { return Response.json(error('live_disabled'), { status: 400 }); }

    const keyId = body.keyId, requestId = body.requestId;
    if (typeof keyId !== 'string' || !/^[a-f0-9]{24}$/.test(keyId) || typeof requestId !== 'string' || !/^[A-Za-z0-9._:-]{8,160}$/.test(requestId)) {
      return Response.json(error('invalid_request_id'), { status: 400 });
    }
    const now = Date.now(), day = utcDay(now), id = reservationId(keyId, requestId);
    const result = await this.ctx.storage.transaction(async txn => {
      const stored = await txn.get<Ledger>('ledger');
      const ledger = stored?.version === 1 ? stored : emptyLedger(day);
      rollover(ledger, day);
      expire(ledger, now);
      const existingKey = ledger.keys[keyId];
      const key = existingKey ?? newCounter();
      let outcome: { ok: true } | LedgerError = { ok: true };

      if (action === 'reserve') {
        const limits = body.limits;
        const inputBytes = body.inputBytes;
        if (!validLimits(limits) || !Number.isSafeInteger(inputBytes) || (inputBytes as number) < 0 || (inputBytes as number) > limits.maxInputBytes) {
          outcome = error('body_too_large');
        } else if (Object.hasOwn(ledger.usedRequestIds, id)) {
          outcome = error('duplicate_request');
        } else if (!existingKey && Object.keys(ledger.keys).length >= 64) {
          outcome = error('quota_exceeded');
        } else if (ledger.global.blockedUnknown || key.blockedUnknown) {
          outcome = error('cost_exceeded');
        } else if (ledger.global.requests >= limits.globalRequests || key.requests >= limits.keyRequests) {
          outcome = error('quota_exceeded');
        } else if (ledger.global.inFlight >= limits.globalInflight || key.inFlight >= limits.keyInflight) {
          outcome = error('inflight_exceeded');
        } else if (ledger.global.settledCost + ledger.global.reservedCost + limits.estimatedCost > limits.globalCost || key.settledCost + key.reservedCost + limits.estimatedCost > limits.keyCost) {
          outcome = error('cost_exceeded');
        } else {
          ledger.keys[keyId] = key;
          ledger.global.requests++; ledger.global.inFlight++; ledger.global.reservedCost += limits.estimatedCost;
          key.requests++; key.inFlight++; key.reservedCost += limits.estimatedCost;
          ledger.pending[id] = { keyId, requestId, estimatedCost: limits.estimatedCost, expiresAt: now + Math.max(60_000, limits.timeoutMs * 4), day };
          ledger.usedRequestIds[id] = now + 24 * 60 * 60 * 1000;
        }
      } else {
        const pending = ledger.pending[id];
        if (pending) {
          ledger.keys[keyId] = key;
          ledger.global.inFlight = Math.max(0, ledger.global.inFlight - 1);
          ledger.global.reservedCost = Math.max(0, ledger.global.reservedCost - pending.estimatedCost);
          key.inFlight = Math.max(0, key.inFlight - 1);
          key.reservedCost = Math.max(0, key.reservedCost - pending.estimatedCost);
          delete ledger.pending[id];
          const usage = body.usage as Record<string, unknown> | undefined;
          const cost = body.costNanodollars;
          const validUsage = usage && Number.isSafeInteger(usage.input_tokens) && (usage.input_tokens as number) >= 0 && Number.isSafeInteger(usage.output_tokens) && (usage.output_tokens as number) >= 0;
          if (!validUsage || !Number.isSafeInteger(cost) || (cost as number) < 0 || pending.day !== day) {
            ledger.global.blockedUnknown = true; key.blockedUnknown = true;
          } else {
            ledger.global.settledCost += cost as number;
            key.settledCost += cost as number;
          }
        }
      }
      await txn.put('ledger', ledger);
      return outcome;
    });
    return Response.json(result, { status: 'status' in result ? result.status : 200 });
  }
}
