import { NextResponse } from 'next/server';
import { runJudgment, JudgmentError, type ProviderMode, type JudgmentInput } from '../../../lib/judgments';
import { authorizeLiveRequest, liveErrorResponse, settleLiveRequest, verifiedUsage } from '../../../lib/live-gate';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  let body: { slug?: string; text?: string; mode?: ProviderMode; requestId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: { code: 'invalid_json', message: 'JSONが不正です。' } }, { status: 400 }); }
  try {
    if (body.mode !== 'jev' && body.mode !== 'rule' && body.mode !== 'replay') throw new JudgmentError('invalid_mode', 'Provider mode must be jev, rule, or replay.', 400);
    const input: JudgmentInput = { slug: body.slug ?? '', text: body.text ?? '', requestId: body.requestId };
    if (body.mode !== 'jev') return NextResponse.json(await runJudgment(input, body.mode, request.signal));
    const { reservation } = authorizeLiveRequest(request, JSON.stringify(body).length, body.requestId);
    try {
      const result = await runJudgment(input, 'jev', request.signal);
      settleLiveRequest(reservation, { costNanodollars: result.cost && 'cost_nanodollars' in result.cost ? result.cost.cost_nanodollars : undefined, usage: verifiedUsage(result.usage) });
      return NextResponse.json(result);
    } catch (error) { settleLiveRequest(reservation, {}); throw error; }
  } catch (error) {
    if (error instanceof JudgmentError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    const x = liveErrorResponse(error); return NextResponse.json({ error: x }, { status: (error as { status?: number }).status ?? 503 });
  }
}
