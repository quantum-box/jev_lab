'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  defaultCandidates,
  defaultCriteria,
  fixedRoutingCases,
  MODEL_ROUTING_PRICE_BASIS,
  MODEL_ROUTING_RULES_VERSION,
  routeRequest,
  routingEvaluationCases,
  routingMetrics,
  validateCandidates,
  validateCriteria,
  type Candidate,
  type DataSensitivity,
  type RequestProfile,
  type RouteTarget,
  type RoutingCriteria,
} from '../../../lib/model-routing';

const targetLabels: Record<RouteTarget, string> = {
  rules: 'ルール処理',
  light: '軽量モデル',
  'high-performance': '高性能モデル',
  'human-review': '人への確認',
};
const categoryLabels = ['定型', '曖昧', '長い推論', '機密', '情報不足'];

const guardrailExamples = [
  { label: '候補IDの重複', candidate: { ...defaultCandidates[0], id: defaultCandidates[1].id }, expected: '候補IDが重複しています。' },
  { label: '矛盾した制約', candidate: { ...defaultCandidates[1], constraints: ['requires-tools'], supportsTools: false }, expected: '矛盾した制約' },
  { label: '長い文脈の不足', candidate: { ...defaultCandidates[0], constraints: ['requires-long-context'], maxContext: 4000 }, expected: 'requires-long-context' },
];

function formatCost(cost: number) { return `$${cost.toFixed(4)}`; }
function cloneCandidates() { return defaultCandidates.map(candidate => ({ ...candidate, capabilities: [...candidate.capabilities], constraints: [...candidate.constraints] })); }

export default function ModelRoutingPage() {
  const [candidates, setCandidates] = useState<Candidate[]>(cloneCandidates);
  const [criteria, setCriteria] = useState<RoutingCriteria>({ ...defaultCriteria, longReasoningWords: [...defaultCriteria.longReasoningWords] });
  const [request, setRequest] = useState<RequestProfile>({ text: fixedRoutingCases[0].input.text, estimatedTokens: fixedRoutingCases[0].input.estimatedTokens, dataSensitivity: 'public', needsTools: false });
  const [selectedExample, setSelectedExample] = useState(fixedRoutingCases[0].id);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [fixedNotice, setFixedNotice] = useState('');
  const candidateIssues = useMemo(() => validateCandidates(candidates), [candidates]);
  const criteriaIssues = useMemo(() => validateCriteria(criteria), [criteria]);
  const decision = useMemo(() => candidateIssues.length || criteriaIssues.length ? undefined : routeRequest(request, candidates, criteria), [request, candidates, criteria, candidateIssues.length, criteriaIssues.length]);
  const metrics = useMemo(() => routingMetrics(routingEvaluationCases, input => routeRequest(input, candidates, criteria)), [candidates, criteria]);
  const baseline = useMemo(() => routingMetrics(routingEvaluationCases, input => routeRequest({ ...input, text: `定型 ${input.text}` }, defaultCandidates, { ...defaultCriteria, longReasoningTokens: 999999, incompleteNeedsHuman: false, ambiguityNeedsHuman: false })), []);

  function loadExample(id: string) {
    const example = fixedRoutingCases.find(item => item.id === id);
    if (!example) return;
    setSelectedExample(id);
    setRequest({ ...example.input });
    setFixedNotice('');
  }
  function updateCandidate(id: string, patch: Partial<Candidate>) {
    setCandidates(rows => rows.map(candidate => candidate.id === id ? { ...candidate, ...patch } : candidate));
  }
  function updateCriteria(patch: Partial<RoutingCriteria>) { setCriteria(current => ({ ...current, ...patch })); }
  function runFixedResponse() {
    const example = fixedRoutingCases.find(item => item.id === selectedExample);
    const actual = decision?.target;
    setFixedNotice(example && actual === example.expected ? `固定応答OK: ${example.fixedResponse}` : `固定応答FAIL: expected=${example?.expected ?? 'unknown'}, actual=${actual ?? 'blocked'}`);
  }
  const invalidCount = candidateIssues.length + criteriaIssues.length;

  return <div className="router-page">
    <div className="detail-head"><Link className="back" href="/">← Back to gallery</Link><div className="eyebrow">業務 · Recommend · simulation-only</div><h1>Jevが、依頼の重さに合わせて経路を選ぶ。</h1><p>依頼の難しさ、情報不足、機密性を判断項目として表示し、ルール処理・軽量モデル・高性能モデル・人への確認から経路をシミュレーションします。実際の外部モデルは実行しません。</p></div>

    <div className="router-toolbar panel"><div><span className="badge">{MODEL_ROUTING_RULES_VERSION}</span><span className="router-chip">fixed response / no external model</span></div><p>{MODEL_ROUTING_PRICE_BASIS}</p><a className="secondary" href="#routing-evaluation">50-case evaluation ↓</a></div>

    <section className="router-layout">
      <main className="router-main" id="routing-evaluation">
        <section className="panel router-editor"><div className="section-title"><h2>1. 依頼を編集</h2><span className="count">Jev simulation</span></div>
          <div className="router-examples" aria-label="操作例">{fixedRoutingCases.map(example => <button key={example.id} className={`chip ${selectedExample === example.id ? 'active' : ''}`} onClick={() => loadExample(example.id)}>{example.label}</button>)}</div>
          <label className="router-label">Request<textarea aria-label="Request" rows={4} value={request.text} onChange={event => setRequest(current => ({ ...current, text: event.target.value }))} /></label>
          <div className="router-form-grid"><label className="router-label">Data sensitivity<select aria-label="Data sensitivity" value={request.dataSensitivity ?? 'public'} onChange={event => setRequest(current => ({ ...current, dataSensitivity: event.target.value as DataSensitivity }))}><option value="public">public</option><option value="internal">internal</option><option value="restricted">restricted / 機密</option></select></label><label className="router-label">Estimated tokens<input aria-label="Estimated tokens" type="number" min="1" value={request.estimatedTokens ?? 0} onChange={event => setRequest(current => ({ ...current, estimatedTokens: Number(event.target.value) }))} /></label></div>
          <label className="router-check"><input type="checkbox" checked={Boolean(request.needsTools)} onChange={event => setRequest(current => ({ ...current, needsTools: event.target.checked }))} /> ツール・検索が必要</label>
          <div className="actions"><button className="primary" onClick={() => setRequest(current => ({ ...current }))}>判定を更新</button><button className="secondary" onClick={() => { setRequest({ ...fixedRoutingCases[0].input }); setSelectedExample(fixedRoutingCases[0].id); }}>Reset example</button></div>
        </section>

        <section className="panel router-result"><div className="section-title"><h2>2. 選ばれた処理先</h2><span className="count">{invalidCount ? 'blocked by validation' : 'deterministic'}</span></div>{decision ? <><div className="route-result-head"><div><span className="router-kicker">Jev chooses</span><strong>{targetLabels[decision.target]}</strong><small>{decision.modelLabel ?? decision.modelId ?? '候補なし'} · confidence {(decision.confidence * 100).toFixed(0)}%</small></div><span className={`route-pill route-${decision.target}`}>{decision.target}</span></div><p className="router-reason">{decision.reason}</p><div className="judgment-grid">{decision.judgmentItems.map(item => <div key={item.label} className={`judgment-item judgment-${item.result}`}><span>{item.label}</span><b>{item.value}</b><small>{item.result === 'hold' ? '保留' : item.result === 'warn' ? '要確認' : '問題なし'}</small></div>)}</div><div className="router-cost"><span>仮想判定費用</span><strong>{formatCost(decision.estimatedCost)}</strong><small>{MODEL_ROUTING_PRICE_BASIS}</small></div></> : <div className="router-blocked">候補または基準に不正・矛盾があるため、判定を停止しました。右のエラーを修正してください。</div>}</section>

        <section className="panel router-eval"><div className="section-title"><h2>3. 50件評価とルールbaseline比較</h2><button className="secondary" onClick={() => setShowEvaluation(current => !current)}>{showEvaluation ? '評価を隠す' : 'Run 50-case evaluation'}</button></div><p className="muted">定型・曖昧・長い推論・機密・情報不足を各10件。正解は固定された期待ルートで、単価は仮定です。</p><div className="category-counts">{categoryLabels.map(category => <span key={category}>{category} <b>{routingEvaluationCases.filter(item => item.category === category).length}</b></span>)}</div>{showEvaluation && <div className="metrics-table"><div className="metrics-row metrics-head"><span>指標</span><span>Jev simulation</span><span>ルールbaseline</span></div>{[['規定ルート適合率', metrics.accuracy, baseline.accuracy, true], ['過小振り分け率', metrics.underRoutingRate, baseline.underRoutingRate, true], ['過大振り分け率', metrics.overRoutingRate, baseline.overRoutingRate, true], ['保留率', metrics.holdRate, baseline.holdRate, true], ['判定費用（仮）', metrics.decisionCost, baseline.decisionCost, false]].map(([label, current, base, percentage]) => <div className="metrics-row" key={String(label)}><span>{label}</span><b>{percentage ? `${(Number(current) * 100).toFixed(1)}%` : formatCost(Number(current))}</b><b>{percentage ? `${(Number(base) * 100).toFixed(1)}%` : formatCost(Number(base))}</b></div>)}</div>}</section>
      </main>

      <aside className="router-side">
        <section className="panel"><div className="section-title"><h2>候補能力と制約</h2><span className="count">編集可能</span></div>{candidates.map(candidate => <div className="candidate-editor" key={candidate.id}><div className="candidate-title"><strong>{candidate.label}</strong><code>{candidate.id}</code></div><label>能力<input aria-label={`${candidate.id} capabilities`} value={candidate.capabilities.join(', ')} onChange={event => updateCandidate(candidate.id, { capabilities: event.target.value.split(',').map(value => value.trim()).filter(Boolean) })} /></label><label>制約<input aria-label={`${candidate.id} constraints`} value={candidate.constraints.join(', ')} onChange={event => updateCandidate(candidate.id, { constraints: event.target.value.split(',').map(value => value.trim()).filter(Boolean) })} /></label><div className="candidate-mini-grid"><label>context<input aria-label={`${candidate.id} max context`} type="number" value={candidate.maxContext} onChange={event => updateCandidate(candidate.id, { maxContext: Number(event.target.value) })} /></label><label>in $/1K<input aria-label={`${candidate.id} input cost`} type="number" step="0.001" value={candidate.inputCostPer1k} onChange={event => updateCandidate(candidate.id, { inputCostPer1k: Number(event.target.value) })} /></label><label>out $/1K<input aria-label={`${candidate.id} output cost`} type="number" step="0.001" value={candidate.outputCostPer1k} onChange={event => updateCandidate(candidate.id, { outputCostPer1k: Number(event.target.value) })} /></label></div><label className="router-check"><input type="checkbox" checked={candidate.supportsTools} onChange={event => updateCandidate(candidate.id, { supportsTools: event.target.checked })} /> tools</label></div>)}</section>
        <section className="panel"><div className="section-title"><h2>判断基準</h2><span className="count">編集可能</span></div><div className="criteria-form"><label>長い推論の閾値<input aria-label="Long reasoning tokens" type="number" value={criteria.longReasoningTokens} onChange={event => updateCriteria({ longReasoningTokens: Number(event.target.value) })} /></label><label>軽量モデル上限 tokens<input aria-label="Light token limit" type="number" value={criteria.maxLightTokens} onChange={event => updateCriteria({ maxLightTokens: Number(event.target.value) })} /></label><label>軽量モデル上限 USD<input aria-label="Light cost limit" type="number" step="0.001" value={criteria.maxLightCost} onChange={event => updateCriteria({ maxLightCost: Number(event.target.value) })} /></label><label>キーワード（カンマ区切り）<input aria-label="Reasoning keywords" value={criteria.longReasoningWords.join(', ')} onChange={event => updateCriteria({ longReasoningWords: event.target.value.split(',').map(value => value.trim()).filter(Boolean) })} /></label><label>通常時の経路<select aria-label="Default route" value={criteria.defaultRoute} onChange={event => updateCriteria({ defaultRoute: event.target.value as RouteTarget })}>{Object.entries(targetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="router-check"><input type="checkbox" checked={criteria.sensitiveNeedsHuman} onChange={event => updateCriteria({ sensitiveNeedsHuman: event.target.checked })} /> 機密は人へ</label><label className="router-check"><input type="checkbox" checked={criteria.incompleteNeedsHuman} onChange={event => updateCriteria({ incompleteNeedsHuman: event.target.checked })} /> 情報不足は人へ</label><label className="router-check"><input type="checkbox" checked={criteria.ambiguityNeedsHuman} onChange={event => updateCriteria({ ambiguityNeedsHuman: event.target.checked })} /> 曖昧は人へ</label></div></section>
        {(candidateIssues.length > 0 || criteriaIssues.length > 0) && <section className="panel router-error"><h2>入力を拒否しました</h2>{[...candidateIssues, ...criteriaIssues].map((issue, index) => <p key={`${issue.field}-${index}`}><strong>{issue.field}</strong> {issue.message}</p>)}</section>}
        <section className="panel"><div className="section-title"><h2>固定応答 / 失敗例</h2><span className="count">E2E-ready</span></div><p className="muted">外部モデルの代わりに固定応答を検証します。候補設定の不正はコードで拒否します。</p><button className="secondary" onClick={runFixedResponse}>Run fixed response</button>{fixedNotice && <div className={`fixed-notice ${fixedNotice.includes('FAIL') ? 'fixed-fail' : ''}`} data-testid="fixed-response">{fixedNotice}</div>}<div className="guardrail-list">{guardrailExamples.map(example => { const issues = validateCandidates([example.candidate]); return <div key={example.label}><span>{example.label}</span><b>{issues.some(issue => issue.message.includes(example.expected)) ? '拒否' : '要確認'}</b></div>; })}</div></section>
      </aside>
    </section>
    <div className="notice">この画面は判断経路の説明用シミュレーションです。実際のモデル呼び出し、機密情報の送信、業務上の承認は行いません。</div>
  </div>;
}
