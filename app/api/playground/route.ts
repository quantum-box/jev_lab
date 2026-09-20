import { NextRequest, NextResponse } from 'next/server';
import { normalizePlaygroundAnswer, PlaygroundValidationError, validatePlaygroundInput, wireRequest } from '../../../lib/playground';
import { authorizeLiveRequest, liveErrorResponse, settleLiveRequest, verifiedUsage } from '../../../lib/live-gate';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  let raw: string; try { raw = await request.text(); } catch { return NextResponse.json({ code: 'invalid_json', error: 'JSONを読み取れません。' }, { status: 400 }); }
  let value: unknown; try { value = JSON.parse(raw); } catch { return NextResponse.json({ code: 'invalid_json', error: 'JSONを読み取れません。' }, { status: 400 }); }
  let input: ReturnType<typeof validatePlaygroundInput>; try { input = validatePlaygroundInput(value); } catch (e) { const x = e instanceof PlaygroundValidationError ? e : new PlaygroundValidationError('invalid_json', 'JSONを読み取れません。'); return NextResponse.json({ code: x.code, error: x.message }, { status: x.code === 'body_too_large' ? 413 : 400 }); }
  const requestId = request.headers.get('x-jev-request-id') ?? undefined;
  let reservation: ReturnType<typeof authorizeLiveRequest>['reservation'];
  try { reservation = authorizeLiveRequest(request, raw.length, requestId).reservation; } catch (e) { const x = liveErrorResponse(e); return NextResponse.json(x, { status: (e as { status?: number }).status ?? 503 }); }
  const token = process.env.TACHYON_API_TOKEN, operator = process.env.TACHYON_TENANT_ID;
  if (!token || !operator) { settleLiveRequest(reservation, {}); return NextResponse.json({ code: 'live_disabled', error: 'Jev live modeはサーバー設定が必要です。' }, { status: 503 }); }
  const controller = new AbortController(); const cancel = () => controller.abort(); request.signal.addEventListener('abort', cancel, { once: true }); const timer = setTimeout(() => controller.abort(), 8000); const started = Date.now();
  try {
    const response = await fetch(`${process.env.TACHYON_API_URL ?? 'https://api.n1.tachy.one'}/v1/ai/judgments`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'x-operator-id': operator, 'content-type': 'application/json' }, body: JSON.stringify(wireRequest(input)), signal: controller.signal });
    if (!response.ok) return NextResponse.json({ code: 'provider_error', error: 'Jev provider returned an error.' }, { status: 502 });
    const body = await response.json() as Record<string, unknown>; const answers = body.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers) || Object.keys(answers).length !== 1) throw new PlaygroundValidationError('malformed_response', 'Jevの回答形式が不正です。');
    const answer = normalizePlaygroundAnswer((answers as Record<string, unknown>)[input.question.id], input.question); const cost = typeof body.cost_nanodollars === 'number' ? body.cost_nanodollars : undefined; settleLiveRequest(reservation, { costNanodollars: cost, usage: verifiedUsage(body.usage) });
    return NextResponse.json({ runId: `play_${Date.now()}`, provider: 'jev', model: 'typesafe/jev-latest', durationMs: Date.now() - started, answer, usage: body.usage && typeof body.usage === 'object' ? body.usage : { status: 'unavailable' }, cost: cost === undefined ? { status: 'unavailable' } : { cost_nanodollars: cost }, priceBasisVersion: process.env.TACHYON_JEV_PRICING_VERSION ?? 'unavailable' });
  } catch (e) { settleLiveRequest(reservation, {}); if (e instanceof PlaygroundValidationError) return NextResponse.json({ code: e.code, error: e.message }, { status: 502 }); return NextResponse.json({ code: request.signal.aborted ? 'canceled' : controller.signal.aborted ? 'timeout' : 'provider_error', error: request.signal.aborted ? 'リクエストをキャンセルしました。' : 'Jevへ接続できませんでした。' }, { status: request.signal.aborted ? 499 : 504 }); }
  finally { clearTimeout(timer); request.signal.removeEventListener('abort', cancel); }
}
