'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DecisionLog, JevDecision, type DecisionView } from '../../../components/JevDecision';
import { THEATER_DATA_VERSION, THEATER_RULES_VERSION, compareTheaterModes, fixedTheaterResponse, inspectTheaterTrace, replayTheaterTrace, runTheater, theaterScenarios, interventions, type TheaterMode, type TheaterTrace } from '../../../lib/ai-theater';

const modeLabels: Record<TheaterMode, string> = { rule: 'ルール', jev: 'Jev', intervention: '観客介入' };
const actionLabels = { ask: '尋ねる', offer: '提案する', wait: '様子を見る', move: '先へ進む' } as const;
// Every mode here is a local deterministic formula; only 'rule' is labeled as a rule, the rest as fixed replay.
const decisionSource = (mode: TheaterMode) => (mode === 'rule' ? 'rule' as const : 'replay' as const);

export default function AiTheaterPage() {
  const [scenarioId, setScenarioId] = useState(theaterScenarios[0].id);
  const [mode, setMode] = useState<TheaterMode>('jev');
  const [interventionId, setInterventionId] = useState(interventions[0].id);
  const [budget, setBudget] = useState(6);
  const [trace, setTrace] = useState<TheaterTrace>();
  const [shown, setShown] = useState(0);
  const [focusTurn, setFocusTurn] = useState<number | null>(null);
  // Reveal turns one at a time so each decision → dialogue step is visible as it happens.
  useEffect(() => {
    if (!trace || trace.stopped && trace.stopReason === 'stopped by operator' || shown >= trace.events.length) return;
    const timer = setTimeout(() => setShown(count => count + 1), shown === 0 ? 150 : 900);
    return () => clearTimeout(timer);
  }, [trace, shown]);
  const scenario = theaterScenarios.find(item => item.id === scenarioId) ?? theaterScenarios[0];
  const intervention = scenario.interventions.find(item => item.id === interventionId) ?? scenario.interventions[0];
  const quality = useMemo(() => trace ? inspectTheaterTrace(trace, scenario) : null, [trace, scenario]);
  const comparison = useMemo(() => compareTheaterModes(scenario, intervention), [scenario, intervention]);
  function show(next: TheaterTrace | undefined) { setTrace(next); setShown(0); setFocusTurn(null); }
  function run() { show(runTheater(scenario, mode, mode === 'intervention' ? intervention : undefined, budget)); }
  function stop() { setTrace(current => current ? { ...current, stopped: true, stopReason: 'stopped by operator' } : current); }
  function replay() { if (trace) show(replayTheaterTrace(trace, scenario)); }

  const visible = trace ? trace.events.slice(0, shown) : [];
  const focused = visible.find(event => event.decision.turn === focusTurn) ?? visible.at(-1);
  const focusedActor = focused ? scenario.actors.find(actor => actor.id === focused.decision.actorId) : undefined;
  const traceIntervention = trace?.interventionId ? scenario.interventions.find(item => item.id === trace.interventionId) : undefined;
  const decisionView: DecisionView | null = focused && focusedActor && trace ? {
    question: `${focusedActor.name}の次の一手は？`, type: 'choice', source: decisionSource(trace.mode),
    state: [['役', `${focusedActor.name}（目的: ${focusedActor.goal}）`], ['見えている世界', scenario.world], ['自分だけの秘密', focusedActor.secret], ['観客の介入', traceIntervention ? traceIntervention.label : 'なし'], ['ターン', `${focused.decision.turn} / ${trace.events.length}`]],
    options: (Object.keys(actionLabels) as Array<keyof typeof actionLabels>).map(key => ({ key, label: actionLabels[key] })),
    picked: focused.decision.action,
    effect: `→ 判断をもとに台詞を生成：「${focused.dialogue.text}」`,
  } : null;
  const logItems = visible.slice().reverse().slice(0, 12).map(event => ({ id: event.decision.id, who: `T${event.decision.turn} ${scenario.actors.find(actor => actor.id === event.decision.actorId)?.name ?? event.decision.actorId}`, question: '次の一手', answer: actionLabels[event.decision.action], source: decisionSource(event.decision.source === 'rule' ? 'rule' : 'jev') }));

  return <div className="detail-head" style={{ maxWidth: 1180, margin: 'auto' }}>
    <style>{`.theater-grid .jd .jp-flow{grid-template-columns:1fr 1fr;gap:10px}.theater-grid .jd .jp-arrow{display:none}.theater-grid .jd .jp-s1{grid-column:1/-1}.theater-grid .jd .jp-state{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.theater-grid>*{min-width:0}.theater-grid .badge{white-space:normal}.theater-grid>main,.theater-grid>aside{grid-template-columns:minmax(0,1fr)}.theater-grid .jd .jp-flow{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}@media(max-width:600px){.theater-grid .jd .jp-flow{grid-template-columns:minmax(0,1fr)}}.theater-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:20px;margin-top:20px}.theater-actors{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.theater-controls{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:900px){.theater-grid{grid-template-columns:1fr}.theater-actors{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.theater-controls{grid-template-columns:1fr}}`}</style>
    <Link className="back" href="/">← Back to gallery</Link>
    <div className="eyebrow">PLT-4909 · FIXED MULTI-AGENT SIMULATION</div>
    <h1>秘密と目的を抱えた、<br />5人の舞台を観察する。</h1>
    <p>Jevの決定と生成台詞を分離した決定論的なAI Theaterです。各エージェントは世界・公開事実・自分の秘密だけを見て、観客介入は別経路で反映します。</p>
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="section-title"><h2>Scene controls</h2><span className="badge">10 fixed settings · budgeted</span></div>
      <div className="theater-controls">
        <label style={{ display: 'grid', gap: 6, color: 'var(--muted)', fontSize: '.75rem' }}>Scene<select aria-label="Scene" value={scenarioId} onChange={event => { setScenarioId(event.target.value); show(undefined); }} style={{ font: 'inherit', padding: 9, border: '1px solid var(--line)', borderRadius: 8 }}>{theaterScenarios.map(item => <option key={item.id} value={item.id}>{item.id} · {item.title}</option>)}</select></label>
        <label style={{ display: 'grid', gap: 6, color: 'var(--muted)', fontSize: '.75rem' }}>Mode<select aria-label="Mode" value={mode} onChange={event => setMode(event.target.value as TheaterMode)} style={{ font: 'inherit', padding: 9, border: '1px solid var(--line)', borderRadius: 8 }}>{Object.entries(modeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      </div>
      <label style={{ display: 'grid', gap: 6, marginTop: 12, color: 'var(--muted)', fontSize: '.75rem' }}>Spectator intervention<select aria-label="Spectator intervention" value={interventionId} onChange={event => setInterventionId(event.target.value)} style={{ font: 'inherit', padding: 9, border: '1px solid var(--line)', borderRadius: 8 }}>{interventions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, color: 'var(--muted)', fontSize: '.75rem' }}>Turn budget <input aria-label="Turn budget" type="range" min="1" max="6" value={budget} onChange={event => setBudget(Number(event.target.value))} /><b>{budget}</b></label>
      <div className="actions"><button className="primary" onClick={run}>Run scene</button><button className="secondary" onClick={stop}>Stop</button><button className="secondary" onClick={replay} disabled={!trace}>Replay trace</button><button className="secondary" onClick={() => show(fixedTheaterResponse(scenario, intervention))}>Fixed 2-turn response</button></div>
    </section>
    <div className="theater-grid">
      <main style={{ display: 'grid', gap: 18 }}>
        {decisionView ? <JevDecision view={decisionView} title={focusTurn === null ? 'いまの判断（最新ターン）' : `ターン ${focused?.decision.turn} の判断`} id="theater-decision" /> : <section className="jd"><div className="jd-head"><span className="jd-title">いまの判断</span></div><p className="muted" style={{ margin: 0 }}>Run sceneを押すと、各ターンで「誰が・何を見て・どの一手を選んだか」がここに順番に表示されます。</p></section>}
        <section className="panel"><div className="section-title"><h2>World / information boundary</h2><span className="badge">{scenario.world}</span></div><div className="theater-actors">{scenario.actors.map(actor => <article key={actor.id} style={{ border: '1px solid var(--line)', borderRadius: 9, padding: 10 }}><strong>{actor.name}</strong><small style={{ display: 'block', color: 'var(--muted)', marginTop: 5 }}>{actor.goal}</small><small style={{ display: 'block', color: 'var(--teal)', marginTop: 7 }}>secret: own only</small></article>)}</div><p className="muted">公開世界と各自の秘密を分離。ほかのエージェントの秘密や観客の未指定情報はdecision contextに入りません。</p></section>
        <section className="panel"><div className="section-title"><h2>Decision → generated dialogue</h2><span className="badge">{trace ? `${trace.events.length} turns` : 'ready'}</span></div>{!trace ? <p className="muted">Run sceneすると、Jev decisionと生成台詞を別々に記録します。</p> : <div style={{ display: 'grid', gap: 8 }}>{visible.map(event => <article key={event.decision.id} tabIndex={0} aria-label={`ターン ${event.decision.turn} の判断を表示`} onClick={() => setFocusTurn(event.decision.turn)} onKeyDown={keyEvent => { if (keyEvent.key === 'Enter' || keyEvent.key === ' ') { keyEvent.preventDefault(); setFocusTurn(event.decision.turn); } }} style={{ borderTop: '1px solid #edf1ee', padding: '10px 0', cursor: 'pointer', background: focused?.decision.id === event.decision.id ? '#f4faf7' : undefined }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>Turn {event.decision.turn} · {event.decision.actorId}</strong><span className="badge">{event.decision.source}</span></div><small style={{ display: 'block', color: 'var(--teal)', marginTop: 5 }}>decision: {event.decision.action} · {event.decision.reason}</small><small style={{ display: 'block', marginTop: 5 }}>dialogue: {event.dialogue.text}</small><small style={{ display: 'block', color: 'var(--muted)', marginTop: 5 }}>visible context: {event.decision.visibleContext.join(' / ')}</small></article>)}</div>}</section>
        {quality && trace && <section className="panel" data-testid="theater-quality"><div className="section-title"><h2>Trace quality</h2><span className="badge">{quality.consistent ? 'consistent' : 'review'}</span></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>{[['整合', quality.consistent ? 'OK' : 'review'], ['矛盾', quality.contradictions], ['秘密漏れ', quality.secretLeakage], ['反復率', `${(quality.repetitionRate * 100).toFixed(1)}%`]].map(([label, value]) => <div key={label} style={{ border: '1px solid var(--line)', borderRadius: 9, padding: 10 }}><small className="muted">{label}</small><strong style={{ display: 'block', marginTop: 6 }}>{value}</strong></div>)}</div><p className="muted">cost estimate: ${quality.cost.toFixed(3)} · mode={trace.mode} · stop={trace.stopReason}</p></section>}
      </main>
      <aside style={{ display: 'grid', gap: 18, alignContent: 'start' }}><DecisionLog items={logItems} title="ターンごとの判断ログ" /><section className="panel"><h2>Rule / Jev / intervention</h2>{Object.entries(comparison).map(([key, item]) => <div key={key} style={{ borderBottom: '1px solid #edf1ee', padding: '9px 0', fontSize: '.74rem' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{modeLabels[key as TheaterMode]}</span><b>{item.consistent ? 'consistent' : 'review'}</b></div><small className="muted">leak {item.secretLeakage} · contradiction {item.contradictions} · repeat {(item.repetitionRate * 100).toFixed(0)}% · ${item.cost.toFixed(3)}</small></div>)}</section><section className="panel"><h2>Safety / replay boundary</h2><ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', fontSize: '.78rem', lineHeight: 1.8 }}><li>5 actors / fixed 10 scenes</li><li>turn budget and Stop</li><li>decisionと台詞を分離</li><li>秘密漏れを検査</li><li>trace replayは同じseed</li><li>外部API・永続化なし</li></ul></section><section className="panel"><h2>Version & license</h2><p className="muted">合成キャラクター・世界設定のみ。rules: {THEATER_RULES_VERSION}<br />data: {THEATER_DATA_VERSION}</p></section></aside>
    </div>
  </div>;
}
