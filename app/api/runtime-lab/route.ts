import { NextResponse } from 'next/server';
import { buildRuntimeJevRequest } from '../../../lib/runtime-jev-wire';
import { authorizeLiveRequest, liveErrorResponse, settleLiveRequest, verifiedUsage } from '../../../lib/live-gate';
const MAX_BYTES = 80_000;
export async function POST(request: Request) {
  let raw: string; try { raw = await request.text(); } catch { return NextResponse.json({ error: 'JSONが不正です。', code: 'invalid_json' }, { status: 400 }); }
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: '入力が大きすぎます。', code: 'body_too_large' }, { status: 413 });
  let body: unknown; try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'JSONが不正です。', code: 'invalid_json' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: '入力が不正です。', code: 'invalid_input' }, { status: 400 });
  const b = body as Record<string, unknown>, actionIds = b.actionIds;
  if (!Array.isArray(actionIds) || actionIds.length < 1 || actionIds.length > 16 || actionIds.some(x => typeof x !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(x))) return NextResponse.json({ error: 'actionIds が不正です。', code: 'invalid_actions' }, { status: 400 });
  if (!b.snapshot || typeof b.snapshot !== 'object' || Array.isArray(b.snapshot)) return NextResponse.json({ error: 'snapshot が必要です。', code: 'invalid_snapshot' }, { status: 400 });
  const requestId = request.headers.get('x-jev-request-id') ?? undefined; let reservation: ReturnType<typeof authorizeLiveRequest>['reservation'];
  try { reservation = authorizeLiveRequest(request, raw.length, requestId).reservation; } catch (e) { const x = liveErrorResponse(e); return NextResponse.json(x, { status: (e as { status?: number }).status ?? 503 }); }
  const token = process.env.TACHYON_API_TOKEN, tenant = process.env.TACHYON_TENANT_ID; if (!token || !tenant) { settleLiveRequest(reservation, {}); return NextResponse.json({ error: 'Jev live はサーバー設定後に利用できます。', code: 'missing_configuration' }, { status: 503 }); }
  const controller = new AbortController(); let timedOut = false; const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 8000); const cancel = () => controller.abort(); request.signal.addEventListener('abort', cancel, { once: true });
  try {
    const response = await fetch(`${process.env.TACHYON_API_URL ?? 'https://api.n1.tachy.one'}/v1/ai/judgments`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'x-operator-id': tenant, 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify(buildRuntimeJevRequest(b.snapshot as object, actionIds as string[])) });
    if (!response.ok) { settleLiveRequest(reservation, {}); return NextResponse.json({ error: 'Jev provider error.', code: 'provider_error' }, { status: 502 }); }
    const result = await response.json() as Record<string, unknown>; const answers = result.answers; const answer = answers && typeof answers === 'object' ? (answers as Record<string, unknown>).action : undefined;
    if (!answer || typeof answer !== 'object' || !actionIds.includes(String((answer as Record<string, unknown>).choice))) { settleLiveRequest(reservation, {}); return NextResponse.json({ error: 'Jev response did not select an allowed action.', code: 'malformed_response' }, { status: 502 }); }
    const cost = typeof result.cost_nanodollars === 'number' ? result.cost_nanodollars : undefined; settleLiveRequest(reservation, { costNanodollars: cost, usage: verifiedUsage(result.usage) });
    return NextResponse.json({ action: String((answer as Record<string, unknown>).choice), usage: result.usage ?? { status: 'unavailable' }, cost: cost === undefined ? { status: 'unavailable' } : { status: 'measured', nanodollars: cost } });
  } catch { settleLiveRequest(reservation, {}); return NextResponse.json({ error: request.signal.aborted ? 'Jev request canceled.' : timedOut ? 'Jev request timed out.' : 'Jev request failed.', code: request.signal.aborted ? 'canceled' : timedOut ? 'timeout' : 'provider_error' }, { status: request.signal.aborted ? 499 : timedOut ? 504 : 502 }); }
  finally { clearTimeout(timer); request.signal.removeEventListener('abort', cancel); }
}
