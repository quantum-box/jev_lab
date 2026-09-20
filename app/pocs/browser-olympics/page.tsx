'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import {
  browserTasks,
  BrowserAction,
  BrowserMetrics,
  BrowserOlympicsRuntime,
  BrowserSnapshot,
  BrowserState,
  candidateActions,
  createBrowserState,
  runAllBaselines,
  runBaseline,
  snapshotFor,
} from '../../../lib/browser-olympics';

function actionText(action: BrowserAction) {
  return `${action.kind} · ${action.target}${action.value === undefined ? '' : ` = ${action.value}`}`;
}

function Metrics({ metrics }: { metrics: BrowserMetrics }) {
  return <div className="browser-metrics">
    <div><small>SUCCESS</small><strong>{metrics.success ? 'yes' : 'no'}</strong></div>
    <div><small>STEPS</small><strong>{metrics.stepCount}</strong></div>
    <div><small>INVALID / RECOVERY</small><strong>{metrics.invalidActionCount} / {metrics.recoveryCount}</strong></div>
    <div><small>NO PROGRESS</small><strong>{metrics.noProgressCount}</strong></div>
    <div><small>COST</small><strong>unavailable</strong></div>
  </div>;
}

export default function BrowserOlympics() {
  const firstTask = browserTasks[0];
  const [taskId, setTaskId] = useState(firstTask.id);
  const runtime = useRef(new BrowserOlympicsRuntime(firstTask));
  const [state, setState] = useState<BrowserState>(() => createBrowserState(firstTask));
  const [snapshot, setSnapshot] = useState<BrowserSnapshot>(() => snapshotFor(state));
  const [metrics, setMetrics] = useState(runtime.current.metrics);
  const [lastAction, setLastAction] = useState<BrowserAction | null>(null);
  const [lastChanges, setLastChanges] = useState<string[]>([]);
  const [lastReason, setLastReason] = useState('');
  const [traceInput, setTraceInput] = useState('');

  const task = useMemo(() => browserTasks.find((entry) => entry.id === taskId) ?? firstTask, [taskId, firstTask]);
  const candidates = candidateActions(state);

  function sync(nextSnapshot = snapshotFor(runtime.current.state, runtime.current.stepCount)) {
    setState(runtime.current.state);
    setSnapshot(nextSnapshot);
    setMetrics(runtime.current.metrics);
  }

  function changeTask(nextId: string) {
    const nextTask = browserTasks.find((entry) => entry.id === nextId) ?? firstTask;
    runtime.current = new BrowserOlympicsRuntime(nextTask);
    setTaskId(nextTask.id);
    setLastAction(null);
    setLastChanges([]);
    setLastReason('');
    setTraceInput('');
    sync(snapshotFor(runtime.current.state));
  }

  function observe() {
    sync(runtime.current.observe());
    setLastReason('Observed the synthetic DOM and accessibility tree.');
  }

  function step(action?: BrowserAction) {
    const result = runtime.current.step(action, 'manual');
    setLastAction(result.action);
    setLastChanges(result.changes);
    setLastReason(result.reason ?? (result.recovery ? `Recovered with ${actionText(result.recovery)}` : 'Action accepted by the code-owned validator.'));
    sync(result.snapshot);
  }

  function reset() {
    runtime.current.reset();
    setLastAction(null);
    setLastChanges([]);
    setLastReason('Reset to the deterministic task seed.');
    sync(snapshotFor(runtime.current.state));
  }

  function replayCurrent() {
    const serialized = runtime.current.exportTrace();
    setTraceInput(serialized);
    const result = runtime.current.replay(serialized);
    setLastReason('Replayed only recorded decisions through the validator.');
    setLastChanges([]);
    sync(snapshotFor(runtime.current.state, runtime.current.stepCount));
    setMetrics(result);
  }

  function runFixedReplay() {
    const baseline = runBaseline(task.id, 'replay');
    setTraceInput(baseline.trace);
    const replayRuntime = new BrowserOlympicsRuntime(task);
    const result = replayRuntime.replay(baseline.trace);
    runtime.current = replayRuntime;
    setLastReason('Fixed replay baseline completed with the independent validator.');
    setLastChanges([]);
    sync(snapshotFor(replayRuntime.state, replayRuntime.stepCount));
    setMetrics(result);
  }

  const allMetrics = runAllBaselines('replay');

  return <div className="browser-page"><style>{`.browser-page{max-width:1240px;margin:auto;padding:28px 22px 80px}.browser-top,.browser-toolbar,.browser-hero,.browser-layout{display:grid;gap:20px}.browser-top{display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:18px}.browser-hero{grid-template-columns:1.25fr .75fr;align-items:end;padding:38px 0 30px}.browser-hero h1{font-size:clamp(2.5rem,5vw,4.8rem);letter-spacing:-.08em;line-height:1;margin:12px 0 17px}.browser-hero p{color:var(--muted);line-height:1.8}.browser-callout{border:1px solid #efd9d0;border-radius:16px;background:#fff8f5;padding:18px;line-height:1.65;font-size:.83rem;color:#79554b}.browser-callout strong{display:block;color:#a64d3a;margin-bottom:7px}.browser-layout{grid-template-columns:1.3fr .7fr}.browser-layout main,.browser-side{display:grid;gap:18px;align-content:start}.browser-toolbar{grid-template-columns:1fr .8fr}.browser-toolbar label{display:grid;gap:6px;font-size:.74rem;color:var(--muted);font-weight:800}.browser-toolbar select{font:inherit;background:#fbfdfb;border:1px solid var(--line);border-radius:8px;padding:10px}.browser-seed,.mock-control,.browser-metrics div{border:1px solid var(--line);border-radius:9px;padding:9px 10px}.browser-seed{display:grid;gap:4px}.browser-seed small{color:var(--muted);font-size:.65rem}.mock-browser{border:1px solid #c9d9d2;border-radius:14px;overflow:hidden;background:#fcfefd}.mock-chrome{height:34px;padding:0 11px;display:flex;align-items:center;gap:7px;background:#e9f0ed;color:#7c918a;font-size:.63rem}.mock-chrome code{margin-left:8px;overflow:hidden;text-overflow:ellipsis}.mock-body{padding:21px;min-height:310px}.mock-brand{font-size:.65rem;font-weight:900;letter-spacing:.15em;color:var(--teal)}.mock-notice{color:#5b7169;min-height:22px;font-size:.75rem}.mock-controls{display:flex;flex-wrap:wrap;gap:8px}.mock-control small{display:block;color:#84968f;font-size:.6rem}.mock-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.mock-card{display:grid;gap:7px;border:1px solid #d8e4df;border-radius:9px;padding:11px;background:#fff;min-height:65px;font-size:.75rem}.mock-card span{color:#788b83;font-size:.65rem}.mock-card.chosen{border-color:var(--teal);background:#effaf5}.mock-disabled{margin-top:15px;padding:9px;border:1px dashed #e0bfb5;color:#95665d;font-size:.67rem}.browser-metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:15px}.browser-metrics small{display:block;color:var(--muted);font-size:.56rem}.browser-metrics strong{display:block;font-size:.77rem;margin-top:5px}.browser-candidates{display:grid;gap:7px}.browser-action{display:flex;gap:10px;text-align:left;border:1px solid var(--line);border-radius:8px;padding:9px 11px;background:#fbfdfb;font-size:.76rem}.browser-action:hover,.browser-action.chosen{border-color:var(--teal);background:#effaf5}.browser-action span,.browser-trace-row>b{color:var(--muted)}.browser-feedback,.browser-changes{font-size:.78rem;color:var(--teal)}.browser-trace-row{display:grid;grid-template-columns:70px 1fr 1fr;gap:9px;border-top:1px solid #edf1ee;padding:9px 0;font-size:.73rem}.browser-trace-row small{color:var(--muted)}.snapshot-code,.trace-json{background:#10221f;color:#daf0e8;padding:12px;border-radius:9px;font-size:.63rem;line-height:1.5;max-height:240px;overflow:auto;white-space:pre-wrap;word-break:break-word}.trace-json{width:100%;min-height:170px}.scoreboard div{display:flex;justify-content:space-between;border-bottom:1px solid #edf1ee;padding:7px 0;font-size:.65rem}.safety ul{padding-left:18px;color:var(--muted);font-size:.78rem;line-height:1.9}@media(max-width:850px){.browser-hero,.browser-layout{grid-template-columns:1fr}}@media(max-width:600px){.browser-page{padding:20px 14px 55px}.browser-hero{padding-top:25px}.browser-toolbar,.browser-metrics{grid-template-columns:1fr 1fr}.mock-cards{grid-template-columns:1fr 1fr}.browser-top{display:block}}`}</style>
    <div className="browser-top"><Link className="back" href="/pocs/browser-olympics">← Browser Olympics</Link><span className="eyebrow">PLT-4893 · SYNTHETIC ONLY</span></div>
    <section className="browser-hero"><div><div className="eyebrow">A SMALL BROWSER, A HARD ALLOWLIST</div><h1>Browser Olympics</h1><p>EC、図書館、フォームの3つのモックサイトで、エージェントの「見る → 候補を出す → 1 actionを選ぶ → 状態が変わる」を再生します。すべてのURL・データ・判定はこのアプリ内の決定的なコードが所有します。</p></div><div className="browser-callout"><strong>Real web access is impossible here</strong><span>mock:// の内部ページだけ。購入・送信・外部通信・任意JSは allowlist に存在しません。料金は実測できないため unavailable です。</span></div></section>
    <div className="browser-layout"><main>
      <section className="panel browser-panel"><div className="browser-toolbar"><label>Task<select value={task.id} onChange={(event) => changeTask(event.target.value)}>{browserTasks.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {entry.variant}</option>)}</select></label><div className="browser-seed"><small>SEED</small><strong>{task.seed}</strong><small>{task.goal}</small></div></div>
        <div className={`mock-browser mock-${task.site} mock-${task.variant}`}><div className="mock-chrome"><span>●</span><span>●</span><span>●</span><code>{snapshot.url}</code></div><div className="mock-body"><div className="mock-brand">{task.site === 'ec' ? 'MORI MARKET' : task.site === 'library' ? 'CITY LIBRARY' : 'DEMO CONTACT'}</div><h2>{snapshot.title}</h2><p className="mock-notice">{state.notice}</p><div className="mock-controls">{snapshot.dom.filter((node) => ['textbox', 'combobox'].includes(node.role)).map((node) => <div className="mock-control" key={node.id}><small>{node.name}</small><div>{node.text || '—'}</div></div>)}</div><div className="mock-cards">{snapshot.dom.filter((node) => node.role === 'button' && node.id !== 'submit-disabled').map((node) => <div className={`mock-card ${state.selectedId === node.id.split(':').slice(1).join(':') ? 'chosen' : ''}`} key={node.id}><strong>{node.name}</strong><span>{node.text}</span></div>)}</div><div className="mock-disabled">Submit / purchase capabilities are not implemented in this synthetic site.</div></div></div>
        <Metrics metrics={metrics} />
        <div className="actions"><button className="primary" onClick={observe}>Observe</button><button className="secondary" onClick={() => step()}>1 step</button><button className="secondary" onClick={replayCurrent}>Replay trace</button><button className="secondary" onClick={runFixedReplay}>Run fixed replay</button><button className="secondary" onClick={reset}>Reset</button></div>
        {lastReason && <p className="browser-feedback">{lastReason}</p>}
      </section>
      <section className="panel"><div className="section-title"><div><div className="eyebrow">CANDIDATE ACTIONS</div><h2>Explicit allowlisted choices</h2></div><span className="count">{candidates.length} candidates</span></div><p className="muted">候補はコードが現在の task/state から生成します。ページ上の文言やDOM属性を読んで権限を増やすことはありません。</p><div className="browser-candidates">{candidates.map((candidate, index) => <button className={`browser-action ${lastAction && actionText(lastAction) === actionText(candidate) ? 'chosen' : ''}`} key={`${candidate.kind}-${candidate.target}-${candidate.value ?? ''}`} onClick={() => step(candidate)}><span>#{index + 1}</span>{actionText(candidate)}</button>)}</div>{lastChanges.length > 0 && <p className="browser-changes">State changes: {lastChanges.join(', ')}</p>}</section>
      <section className="panel browser-trace"><div className="section-title"><div><div className="eyebrow">TRACE</div><h2>Chosen action → state change</h2></div><span className="count">{runtime.current.trace.filter((event) => event.type === 'decision').length} decisions</span></div>{runtime.current.trace.length === 0 ? <p className="muted">Observe or step to create an inspectable trace.</p> : <div className="trace-list">{runtime.current.trace.slice().reverse().filter((event) => event.type === 'decision' || event.type === 'invalid' || event.type === 'apply').slice(0, 12).map((event, index) => <div className="browser-trace-row" key={`${event.type}-${index}`}><b>{event.type}</b><span>{event.type === 'decision' || event.type === 'invalid' ? actionText(event.action) : event.type === 'apply' ? actionText(event.action) : ''}</span><small>{event.type === 'apply' ? event.changes.join(', ') || 'no state change' : event.type === 'invalid' ? `recovery: ${actionText(event.recovery)}` : ''}</small></div>)}</div>}</section>
    </main><aside className="browser-side"><section className="panel"><h2>Snapshot evidence</h2><p className="muted">DOM snapshot + accessibility snapshot</p><details open><summary>DOM ({snapshot.dom.length})</summary><pre className="snapshot-code">{JSON.stringify(snapshot.dom, null, 2)}</pre></details><details><summary>Accessibility ({snapshot.accessibility.length})</summary><pre className="snapshot-code">{JSON.stringify(snapshot.accessibility, null, 2)}</pre></details></section><section className="panel"><h2>Baseline scoreboard</h2><div className="scoreboard">{allMetrics.map((entry) => <div key={entry.taskId}><span>{entry.taskId}</span><b>{entry.success ? '✓' : '—'} · {entry.stepCount} steps · {entry.invalidActionCount} invalid</b></div>)}</div><p className="muted">Replay / Rule metrics are deterministic. Live model cost is not fabricated.</p></section><section className="panel safety"><h2>Guardrails</h2><ul><li>3 mock sites, 10 fixed tasks, 4 layout variants</li><li>hard action allowlist; no arbitrary JS</li><li>no real URL, network, purchase, or submit</li><li>validator owns completion, not model claim</li><li>max 30 steps / 3 invalid streak / 4 no-progress</li></ul></section>{traceInput && <section className="panel"><h2>Trace JSON</h2><textarea className="trace-json" readOnly value={traceInput} aria-label="Trace JSON" /></section>}</aside></div>
  </div>;
}
