'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  VALUE_SELECTION_PRICE_BASIS,
  VALUE_SELECTION_RULES_VERSION,
  copyAndNormalizeSelection,
  extractValueCandidates,
  labelNearBaseline,
  selectByJev,
  selectionEvaluationCases,
  selectionExamples,
  selectionMetrics,
  validateSelection,
  type SelectionExample,
  type ValueKind,
} from '../../../lib/value-selection';

const targetLabels: Record<ValueKind, string> = { 'invoice-total': '請求総額', 'payment-due': '支払期日' };
const categoryLabels = ['複数通貨', '負数', '請求総額なし', '日付曖昧', 'OCR誤り風'];

function Evidence({ text, start, end }: { text: string; start?: number; end?: number }) {
  if (start === undefined || end === undefined) return <pre className="value-source">{text}</pre>;
  return <pre className="value-source">{text.slice(0, start)}<mark>{text.slice(start, end)}</mark>{text.slice(end)}</pre>;
}

function formatMetric(value: number) { return `${(value * 100).toFixed(1)}%`; }

export default function ValueSelectionPage() {
  const [exampleId, setExampleId] = useState(selectionExamples[0].id);
  const [text, setText] = useState(selectionExamples[0].text);
  const [target, setTarget] = useState<ValueKind>('invoice-total');
  const [highlightId, setHighlightId] = useState<string>();
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [fixedNotice, setFixedNotice] = useState('');
  const example = selectionExamples.find(item => item.id === exampleId) ?? selectionExamples[0];
  const candidates = useMemo(() => extractValueCandidates(text), [text]);
  const rawSelection = useMemo(() => selectByJev(candidates, target), [candidates, target]);
  const selection = useMemo(() => copyAndNormalizeSelection(text, candidates, rawSelection), [text, candidates, rawSelection]);
  const highlighted = candidates.find(candidate => candidate.id === (highlightId ?? selection.candidateId));
  const metrics = useMemo(() => selectionMetrics(selectionEvaluationCases), []);
  const baseline = useMemo(() => selectionMetrics(selectionEvaluationCases, labelNearBaseline), []);
  const failures = useMemo(() => [
    { label: '無効な候補ID', errors: validateSelection(candidates, { ...selection, candidateId: 'amount-999' }) },
    { label: '不正日付の候補', errors: validateSelection([{ id: 'date-bad', kind: 'date', raw: '2026年02月30日', normalized: '2026年02月30日', start: 0, end: 12, label: '支払期日', valid: false }], { target: 'payment-due', candidateId: 'date-bad', status: 'selected', value: '2026-02-30', raw: '2026年02月30日', reason: '' }) },
    { label: '対象種別の不一致', errors: validateSelection(candidates, { ...selection, target: 'payment-due', candidateId: candidates.find(item => item.kind === 'amount')?.id ?? null }) },
  ], [candidates, selection]);

  function loadExample(next: SelectionExample) {
    setExampleId(next.id);
    setText(next.text);
    setHighlightId(undefined);
    setFixedNotice('');
  }
  function runFixedResponse() {
    const expectedTotal = example.expectedTotal;
    const expectedDue = example.expectedDue;
    const actualTotal = copyAndNormalizeSelection(text, candidates, selectByJev(candidates, 'invoice-total')).value;
    const actualDue = copyAndNormalizeSelection(text, candidates, selectByJev(candidates, 'payment-due')).value;
    const ok = actualTotal === expectedTotal && actualDue === expectedDue;
    setFixedNotice(ok ? `固定応答OK: ${example.fixedResponse}` : `固定応答FAIL: expected=${example.fixedResponse}; actual=${actualTotal ?? 'unknown'} / ${actualDue ?? 'unknown'}`);
  }

  return <div className="value-page">
    <div className="detail-head"><Link className="back" href="/">← Back to gallery</Link><div className="eyebrow">業務 · Classify · simulation-only</div><h1>金額と日付は、文書の中から選ぶ。</h1><p>小計・税額・合計や複数の日付がある文書から、コードで候補と文字位置を抽出します。Jevは候補IDまたは不明だけを選び、値は元文書からコピー/正規化します。</p></div>
    <div className="value-toolbar panel"><div><span className="badge">{VALUE_SELECTION_RULES_VERSION}</span><span className="value-chip">fixed response / no OCR / no external write</span></div><p>{VALUE_SELECTION_PRICE_BASIS}</p><a className="secondary" href="#value-evaluation">50-case evaluation ↓</a></div>

    <section className="value-layout">
      <main className="value-main">
        <section className="panel"><div className="section-title"><h2>1. 文書と対象を編集</h2><span className="count">code → Jev → copy</span></div><div className="value-examples" aria-label="操作例">{selectionExamples.map(item => <button key={item.id} className={`chip ${exampleId === item.id ? 'active' : ''}`} onClick={() => loadExample(item)}>{item.label}</button>)}</div><label className="value-label">Document text<textarea aria-label="Document text" rows={10} value={text} onChange={event => { setText(event.target.value); setExampleId('custom'); setFixedNotice(''); }} /></label><div className="value-targets" role="group" aria-label="Selection target"><button className={target === 'invoice-total' ? 'active' : ''} onClick={() => setTarget('invoice-total')}>請求総額</button><button className={target === 'payment-due' ? 'active' : ''} onClick={() => setTarget('payment-due')}>支払期日</button></div><div className="actions"><button className="primary" onClick={() => setText(current => current)}>候補を再抽出</button><button className="secondary" onClick={runFixedResponse}>Run fixed response</button></div>{fixedNotice && <div className={`value-fixed ${fixedNotice.includes('FAIL') ? 'value-fixed-fail' : ''}`} data-testid="value-fixed-response">{fixedNotice}</div>}</section>

        <section className="panel"><div className="section-title"><h2>2. コード抽出候補</h2><span className="count">{candidates.length} candidates · source offsets</span></div><div className="value-candidate-list">{candidates.length === 0 ? <p className="muted">候補がありません。値を推測せず不明として扱います。</p> : candidates.map(candidate => <div className={`value-candidate ${candidate.id === selection.candidateId ? 'value-selected' : ''}`} key={candidate.id}><div><strong>{candidate.id}</strong><span className="value-kind">{candidate.kind === 'amount' ? '金額' : '日付'}</span><small>文字位置 {candidate.start}–{candidate.end} · {candidate.label}</small></div><b>{candidate.raw} → {candidate.normalized}</b><button className="secondary" onClick={() => setHighlightId(candidate.id)}>元箇所をハイライト</button></div>)}</div></section>

        <section className="panel value-output"><div className="section-title"><h2>3. Jev選択と元値の対応</h2><span className={`value-status ${selection.status === 'selected' ? '' : 'value-unknown'}`}>{selection.status === 'selected' ? 'selected' : 'unknown / 保留'}</span></div><div className="value-output-grid"><div><span className="value-kicker">Jev candidate ID</span><strong>{selection.candidateId ?? 'unknown'}</strong><small>{selection.reason}</small></div><div><span className="value-kicker">{targetLabels[target]}</span><strong>{selection.value ?? '不明'}</strong><small>raw: {selection.raw ?? '—'} · 正規化はコード処理</small></div></div><Evidence text={text} start={highlighted?.start} end={highlighted?.end} /><p className="muted">選択値に対応する元文書実在箇所をハイライトしています。OCR文字の訂正や資料にない値の推測は行いません。</p></section>

        <section className="panel" id="value-evaluation"><div className="section-title"><h2>4. 50件評価とbaseline比較</h2><button className="secondary" onClick={() => setShowEvaluation(current => !current)}>{showEvaluation ? '評価を隠す' : 'Run 50-case evaluation'}</button></div><p className="muted">複数通貨・負数・請求総額なし・日付曖昧・OCR誤り風を各10件。候補抽出漏れと候補選択ミスを分離して集計します。</p><div className="value-category-counts">{categoryLabels.map(category => <span key={category}>{category} <b>{selectionEvaluationCases.filter(item => item.category === category).length}</b></span>)}</div>{showEvaluation && <div className="value-metrics"><div className="value-metric-row value-metric-head"><span>指標</span><span>Jev候補選択</span><span>label近傍baseline</span></div>{[['候補選択精度', metrics.selectionAccuracy, baseline.selectionAccuracy, true], ['抽出漏れ率', metrics.extractionMissRate, baseline.extractionMissRate, true], ['候補選択ミス率', metrics.selectionMissRate, baseline.selectionMissRate, true], ['保留率', metrics.holdRate, baseline.holdRate, true], ['判定費用（仮）', metrics.cost, baseline.cost, false]].map(([label, current, base, percent]) => <div className="value-metric-row" key={String(label)}><span>{label}</span><b>{percent ? formatMetric(Number(current)) : `$${Number(current).toFixed(4)}`}</b><b>{percent ? formatMetric(Number(base)) : `$${Number(base).toFixed(4)}`}</b></div>)}</div>}</section>
      </main>

      <aside className="value-side"><section className="panel"><h2>Evidence contract</h2><dl className="value-contract"><div><dt>抽出</dt><dd>正規表現 + 文字位置</dd></div><div><dt>選択</dt><dd>候補ID / unknown</dd></div><div><dt>値生成</dt><dd>禁止（元値コピーのみ）</dd></div><div><dt>外部連携</dt><dd>なし</dd></div></dl><div className="notice">Jevの固定応答は候補IDだけです。金額・日付の中身をAIが生成する契約ではありません。</div></section><section className="panel"><div className="section-title"><h2>抽出・選択の失敗例</h2><span className="count">guarded in code</span></div>{failures.map(item => <div className="value-failure" key={item.label}><span>{item.label}</span><b>{item.errors.length > 0 ? '拒否' : '許可'}</b>{item.errors.length > 0 && <small>{item.errors[0]}</small>}</div>)}<p className="muted">OCR誤り風の文字を直せるとは扱わず、証拠がなければ不明にします。</p></section><section className="panel"><h2>Current target</h2><div className="value-target-summary"><span>{targetLabels[target]}</span><strong>{selection.status === 'selected' ? selection.value : '不明 / 保留'}</strong></div><p className="muted">候補一覧から元箇所を確認できます。</p></section></aside>
    </section><div className="notice">この画面は合成文書の説明用シミュレーションです。画像/OCR実行、資料外の推測、外部会計登録は行いません。</div>
  </div>;
}

