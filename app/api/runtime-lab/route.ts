import { NextResponse } from 'next/server';
import { buildRuntimeJevRequest } from '../../../lib/runtime-jev-wire';

const MAX_BYTES = 80_000;
export async function POST(request: Request) {
  let body: unknown;
  try { const text = await request.text(); if (text.length > MAX_BYTES) return NextResponse.json({ error: '入力が大きすぎます。' }, { status: 413 }); body = JSON.parse(text); } catch { return NextResponse.json({ error: 'JSONが不正です。' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: '入力が不正です。' }, { status: 400 });
  const b = body as Record<string, unknown>; const actionIds = b.actionIds;
  if (!Array.isArray(actionIds) || actionIds.length < 1 || actionIds.length > 16 || actionIds.some(x => typeof x !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(x))) return NextResponse.json({ error: 'actionIds が不正です。' }, { status: 400 });
  if (!b.snapshot || typeof b.snapshot !== 'object') return NextResponse.json({ error: 'snapshot が必要です。' }, { status: 400 });
  const token = process.env.TACHYON_API_TOKEN, tenant = process.env.TACHYON_TENANT_ID;
  if (!token || !tenant) return NextResponse.json({ error: 'Jev live はサーバー設定後に利用できます。', code: 'missing_configuration' }, { status: 503 });
  const controller = new AbortController(); let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 8000);
  const cancel = () => controller.abort();
  request.signal.addEventListener('abort', cancel, { once: true });
  try {
    const endpoint = `${process.env.TACHYON_API_URL ?? 'https://api.n1.tachy.one'}/v1/ai/judgments`;
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'x-operator-id': tenant, 'content-type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify(buildRuntimeJevRequest(b.snapshot as object, actionIds as string[])) });
    if (!response.ok) return NextResponse.json({ error: 'Jev provider error.', code: 'provider_error' }, { status: 502 });
    const result = await response.json() as Record<string, unknown>; const answers = result.answers; const answer = answers && typeof answers === 'object' ? (answers as Record<string, unknown>).action : undefined;
    if (!answer || typeof answer !== 'object' || !actionIds.includes(String((answer as Record<string, unknown>).choice))) return NextResponse.json({ error: 'Jev response did not select an allowed action.', code: 'malformed_response' }, { status: 502 });
    return NextResponse.json({ action: String((answer as Record<string, unknown>).choice), usage: result.usage ?? { status: 'unavailable' }, cost: typeof result.cost_nanodollars === 'number' ? { status: 'measured', nanodollars: result.cost_nanodollars } : { status: 'unavailable' } });
  } catch (error) { if (request.signal.aborted) return NextResponse.json({ error: 'Jev request canceled.', code: 'canceled' }, { status: 499 }); if (timedOut) return NextResponse.json({ error: 'Jev request timed out.', code: 'timeout' }, { status: 504 }); return NextResponse.json({ error: 'Jev request failed.', code: 'provider_error' }, { status: 502 }); } finally { clearTimeout(timer); request.signal.removeEventListener('abort', cancel); }
}
