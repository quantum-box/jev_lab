import { NextRequest, NextResponse } from 'next/server';
import { normalizePlaygroundAnswer, PlaygroundValidationError, validatePlaygroundInput, wireRequest } from '../../../lib/playground';

export const runtime = 'nodejs';
const endpoint = () => `${process.env.TACHYON_API_URL ?? 'https://api.n1.tachy.one'}/v1/ai/judgments`;

export async function POST(request: NextRequest) {
  if (Number(request.headers.get('content-length') ?? 0) > 900_000) return NextResponse.json({ code: 'body_too_large', error: '入力が大きすぎます。' }, { status: 413 });
  let input: ReturnType<typeof validatePlaygroundInput>;
  try { input = validatePlaygroundInput(await request.json()); }
  catch (e) { const x = e instanceof PlaygroundValidationError ? e : new PlaygroundValidationError('invalid_json', 'JSONを読み取れません。'); return NextResponse.json({ code: x.code, error: x.message }, { status: x.code === 'body_too_large' ? 413 : 400 }); }
  const token = process.env.TACHYON_API_TOKEN;
  const operator = process.env.TACHYON_TENANT_ID;
  if (!token || !operator) return NextResponse.json({ code: 'missing_configuration', error: 'Jev live modeはサーバー設定が必要です。' }, { status: 503 });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  request.signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(), 8_000);
  const started = Date.now();
  try {
    const response = await fetch(endpoint(), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'x-operator-id': operator, 'content-type': 'application/json' }, body: JSON.stringify(wireRequest(input)), signal: controller.signal });
    if (!response.ok) return NextResponse.json({ code: 'provider_error', error: 'Jev provider returned an error.' }, { status: 502 });
    const body = await response.json() as Record<string, unknown>;
    const answers = body.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers) || Object.keys(answers).length !== 1) throw new PlaygroundValidationError('malformed_response', 'Jevの回答形式が不正です。');
    const answer = normalizePlaygroundAnswer((answers as Record<string, unknown>)[input.question.id], input.question);
    return NextResponse.json({ runId: `play_${Date.now()}`, provider: 'jev', model: typeof body.model === 'string' ? body.model : 'typesafe/jev-latest', durationMs: Date.now() - started, answer, usage: body.usage && typeof body.usage === 'object' ? body.usage : { status: 'unavailable' }, cost: typeof body.cost_nanodollars === 'number' ? { cost_nanodollars: body.cost_nanodollars } : { status: 'unavailable' }, priceBasisVersion: process.env.TACHYON_JEV_PRICING_VERSION ?? 'unavailable' });
  } catch (e) {
    if (e instanceof PlaygroundValidationError) return NextResponse.json({ code: e.code, error: e.message }, { status: 502 });
    return NextResponse.json({ code: request.signal.aborted ? 'canceled' : controller.signal.aborted ? 'timeout' : 'provider_error', error: request.signal.aborted ? 'リクエストをキャンセルしました。' : controller.signal.aborted ? 'Jevへの接続がタイムアウトしました。' : 'Jevへ接続できませんでした。' }, { status: request.signal.aborted ? 499 : 504 });
  } finally { clearTimeout(timer); request.signal.removeEventListener('abort', cancel); }
}
