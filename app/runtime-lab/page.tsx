'use client';
import { useEffect, useRef, useState } from 'react';
import { ContinuousRuntime, type RuntimeTraceEvent } from '../../lib/runtime';
import { JevDecision, DecisionLog, type DecisionLogItem, type DecisionView } from '../../components/JevDecision';

type Arena = { x: number; energy: number; ticks: number };
const actions = ['left', 'wait', 'right'] as const;
function createRuntime(adapter: 'replay' | 'rule' | 'jev', liveKey = ''): ContinuousRuntime<Arena, typeof actions[number]> {
  return new ContinuousRuntime({ initialState: { x: 0, energy: 5, ticks: 0 }, seed: 4886, allowedActions: actions,
    updateEnvironment: (s) => ({ ...s, ticks: s.ticks + 1, energy: Math.max(0, s.energy - .02) }),
    applyAction: (s, a) => ({ ...s, x: Math.max(-4, Math.min(4, s.x + (a === 'left' ? -1 : a === 'right' ? 1 : 0))), energy: Math.max(0, s.energy - (a === 'wait' ? .05 : .15)) }),
    validateAction: (s, a) => a === 'wait' || (a === 'left' && s.x > -4) || (a === 'right' && s.x < 4) ? { ok: true } : { ok: false, reason: 'arena boundary' },
    safeAction: 'wait', adapterName: adapter, decisionCadenceMs: 500, caps: { maxSteps: 20, maxElapsedMs: 20_000, maxConcurrency: 1 },
    decide: async ({ snapshot }) => { if (adapter === 'jev') { const response = await fetch('/api/runtime-lab', { method: 'POST', headers: { 'content-type': 'application/json', 'x-jev-live-access-key': liveKey, 'x-jev-request-id': crypto.randomUUID() }, body: JSON.stringify({ snapshot, actionIds: actions }) }); const body = await response.json() as { error?: string; action: typeof actions[number] }; if (!response.ok) throw new Error(body.error ?? 'Jev live failed'); return { action: body.action }; } return { action: adapter === 'replay' ? (snapshot.x < 0 ? 'right' : 'left') : snapshot.energy < 2 ? 'wait' : snapshot.x < 2 ? 'right' : 'left' }; } });
}
const actionJa: Record<typeof actions[number], string> = { left: '← left', wait: '· wait', right: 'right →' };
type Ev = RuntimeTraceEvent<Arena, typeof actions[number]>;
// One row per decided step, reconstructed from the runtime's real trace.
function stepsFromTrace(trace: string) {
  let events: Ev[] = []; try { events = (JSON.parse(trace) as { events: Ev[] }).events ?? []; } catch { return []; }
  const rows = new Map<number, { step: number; snapshot?: Arena; decided?: typeof actions[number]; applied?: typeof actions[number]; rejected?: string; error?: string }>();
  for (const e of events) {
    if (!('step' in e) || e.step === 0) continue;
    const row = rows.get(e.step) ?? { step: e.step }; rows.set(e.step, row);
    if (e.type === 'snapshot') row.snapshot = e.state;
    if (e.type === 'decision') row.decided = e.action;
    if (e.type === 'safe-action') row.rejected = e.reason;
    if (e.type === 'error') row.error = e.reason;
    if (e.type === 'apply') row.applied = e.action;
  }
  return [...rows.values()].filter(r => r.snapshot && r.applied);
}
export default function RuntimeLab() { const ref = useRef<ContinuousRuntime<Arena, typeof actions[number]> | null>(null); const [mode, setMode] = useState<'replay'|'rule'|'jev'>('replay'); const [liveKey, setLiveKey] = useState(''); const [replayed, setReplayed] = useState(''); const [view, setView] = useState({ status: 'idle', x: 0, energy: 5, steps: 0, trace: '' });
  const modeRef = useRef(mode); function ensure() { if (!ref.current || modeRef.current !== mode) { ref.current = createRuntime(mode, liveKey); modeRef.current = mode; } return ref.current; }
  async function act(fn: (r: ContinuousRuntime<Arena, typeof actions[number]>) => Promise<void> | void) { const r = ensure(); await fn(r); setView({ status: r.status, x: r.state.x, energy: Number(r.state.energy.toFixed(2)), steps: r.stepCount, trace: r.exportTrace() }); }
  const sourceMode = modeRef.current;
  useEffect(() => { if (view.status !== 'running' || mode === 'jev') return; const t = setInterval(() => { void act(r => r.tick(500)); }, 700); return () => clearInterval(t); });
  const steps = stepsFromTrace(view.trace); const last = steps.at(-1);
  const source = sourceMode === 'jev' ? 'jev' as const : sourceMode === 'rule' ? 'rule' as const : 'replay' as const;
  const decision: DecisionView | null = last?.snapshot ? { question: '次のアクションは？（許可された action ID から1つ）', type: 'choice', state: [['位置 x', `${last.snapshot.x}（範囲 -4〜4）`], ['energy', last.snapshot.energy.toFixed(2)], ['環境tick', String(last.snapshot.ticks)], ['step', `${last.step} / 20`]], options: actions.map(a => ({ key: a, label: actionJa[a] })), picked: last.decided ?? last.applied ?? null, source, effect: last.error ? `→ 判断に失敗（${last.error}）。安全な wait を適用して一時停止` : last.rejected ? `→ validatorが却下（${last.rejected}）。安全な wait を適用` : `→ validator OK。${actionJa[last.applied!]} を適用し、位置 ${last.snapshot.x} から動きます` } : null;
  const log: DecisionLogItem[] = steps.slice(-12).reverse().map(r => ({ id: `s${r.step}`, who: `step ${r.step}`, question: `x=${r.snapshot!.x}`, answer: r.error ? `失敗 → wait` : r.rejected ? `${r.decided ?? '?'} → wait` : actionJa[r.applied!], source, ok: r.error || r.rejected ? false : undefined }));
  return <div className="playground"><section className="pg-hero"><div className="eyebrow">RUNTIME LAB · PLT-4886</div><h1>判断が動く世界を、止めて覗く。</h1><p>環境の更新とAI判断の cadence を分離した、安全な小さなアリーナです。同じseedはコードシミュレーションの再現性を作りますが、liveモデルの出力の再現性を保証しません。</p></section><section className="panel"><h2>操作</h2><label>Decision adapter <select value={mode} onChange={e => { setMode(e.target.value as typeof mode); ref.current = null; }}><option value="replay">Replay</option><option value="rule">Rule baseline</option><option value="jev">Jev live（明示操作のみ）</option></select></label>{mode === "jev" && <label>Jev live access key（保存しません）<input type="password" value={liveKey} onChange={e => setLiveKey(e.target.value)} autoComplete="off" /></label>}<div className="actions"><button className="primary" onClick={() => act(r => { r.start(); })}>開始 / resume</button><button className="secondary" onClick={() => act(r => { r.pause(); })}>一時停止</button><button className="secondary" onClick={() => act(r => r.step())}>1 step</button><button className="secondary" onClick={() => act(r => { r.reset(); })}>reset</button><button className="secondary" onClick={() => act(r => r.tick(500))}>環境tick +500ms</button><button className="secondary" onClick={() => { try { const replay = ContinuousRuntime.replay(view.trace); setReplayed(`replayed ${replay.events.filter(e => e.type === 'apply').length} steps`); } catch { setReplayed('replay unavailable'); } }}>Replay trace</button></div><div className="result"><div className="result-badge" data-testid="runtime-status">{view.status}</div><strong>位置 {view.x} / energy {view.energy} / action {view.steps}</strong><p className="muted">並列上限1 · step上限20 · time上限20秒 · costは測定時のみ表示</p></div><div className="runtime-track" aria-label={`アリーナ上の位置 ${view.x}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(9,1fr)', gap: 4, margin: '14px 0' }}>{Array.from({ length: 9 }, (_, i) => i - 4).map(x => <div key={x} style={{ height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: '.7rem', background: x === view.x ? 'var(--teal)' : 'var(--paper)', color: x === view.x ? '#fff' : 'var(--muted)', border: '1px solid var(--line)', transition: 'background .3s' }}>{x === view.x ? '●' : x}</div>)}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'start', margin: '0 0 14px' }}><div style={{ flex: '1 1 100%', minWidth: 0 }}>{decision ? <JevDecision view={decision} title="いまの判断（runtime trace から）" /> : <p className="muted">1 step か 開始 を押すと、snapshot → 判断 → validator → apply の結果がここに出ます。</p>}</div><div style={{ flex: '1 1 100%', minWidth: 0 }}><DecisionLog title="stepごとの判断ログ" items={log} /></div></div><details><summary>trace JSON（保存・replay用）</summary><textarea data-testid="runtime-trace" readOnly value={view.trace} rows={8} style={{ width: '100%', marginTop: 12 }} /></details>{replayed && <p data-testid="replay-result" className="notice">{replayed}</p>}<p className="notice">Jev live はサーバーrouteに対する明示的な操作だけで実行されます。未設定ならフォールバックしません。</p></section></div> }
