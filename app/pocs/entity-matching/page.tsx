'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { JevDecision, type DecisionView } from '../../../components/JevDecision';
import { ENTITY_MATCHING_CORRECTION_RULE, ENTITY_MATCHING_DATA_VERSION, ENTITY_MATCHING_VERSION, matchingEvaluationPairs, matchingExamples, matchingFailureExamples, matchPair, matchingMetrics, parseMatchingCorrections, idBaseline, stringBaseline, type EntityRecord, type MatchStatus } from '../../../lib/entity-matching';

const labels: Record<MatchStatus, string> = { match: '一致候補', mismatch: '不一致', missing: '不足', 'needs-review': '要確認' };
export default function EntityMatchingPage() {
  const [selectedId, setSelectedId] = useState(matchingExamples[0].id);
  const [threshold, setThreshold] = useState(0.75);
  const [corrections, setCorrections] = useState<Record<string, MatchStatus>>({});
  useEffect(() => {
    setCorrections(parseMatchingCorrections(localStorage.getItem('jev-entity-matching-corrections')));
  }, []);
  const pair = matchingExamples.find(item => item.id === selectedId) ?? matchingExamples[0];
  const result = useMemo(() => matchPair(pair, threshold), [pair, threshold]);
  const metrics = useMemo(() => matchingMetrics(matchingEvaluationPairs, threshold), [threshold]);
  const corrected = corrections[pair.id] ?? result.overall;
  const [focusField, setFocusField] = useState<keyof EntityRecord | 'overall'>('overall');
  const fieldFocus = focusField === 'overall' ? undefined : result.fields.find(field => field.field === focusField);
  const short = (record: EntityRecord) => Object.values(record).filter(Boolean).slice(0, 2).join(' · ') || '（値なし）';
  const matchView: DecisionView = fieldFocus ? {
    question: `項目「${fieldFocus.field}」は同じ値？`, type: 'choice', source: 'rule',
    state: [['左', fieldFocus.left ?? '—'], ['右', fieldFocus.right ?? '—'], ['類似度', fieldFocus.score.toFixed(2)], ['閾値', String(threshold)]],
    options: (['match', 'needs-review', 'mismatch', 'missing'] as MatchStatus[]).map(key => ({ key, label: labels[key] })),
    picked: fieldFocus.status,
    effect: `→ ${fieldFocus.reason}`,
  } : {
    question: 'この2レコードは同じ取引先？', type: 'choice', source: 'rule',
    state: [
      ['左', short(pair.left)], ['右', short(pair.right)],
      ['項目の内訳', (['match', 'needs-review', 'mismatch', 'missing'] as MatchStatus[]).map(key => `${labels[key]} ${result.fields.filter(field => field.status === key).length}`).join(' / ')],
      ['平均類似度 / 閾値', `${result.score.toFixed(2)} / ${threshold}`],
    ],
    options: (['match', 'needs-review', 'mismatch'] as MatchStatus[]).map(key => ({ key, label: labels[key] })),
    picked: result.overall,
    effect: `→ 自動統合はせず、候補として人のレビューへ（IDだけの比較なら「${labels[idBaseline(pair)]}」、社名の文字列だけなら「${labels[stringBaseline(pair)]}」）`,
  };
  function saveCorrection(value: MatchStatus) {
    setCorrections(current => ({ ...current, [pair.id]: value }));
    localStorage.setItem('jev-entity-matching-corrections', JSON.stringify({ version: ENTITY_MATCHING_VERSION, rule: ENTITY_MATCHING_CORRECTION_RULE, corrections: { ...corrections, [pair.id]: value } }));
  }
  return <div className="account-page">
    <div className="detail-head"><Link className="back" href="/">← Back to gallery</Link><div className="eyebrow">業務 · Classify · deterministic replay</div><h1>左右のレコードを、項目ごとに照合する。</h1><p>一致・不一致・不足を項目単位で示し、全体候補と根拠を分けて表示します。自動統合は行わず、人の修正とルール版を保存します。</p></div>
    <div className="account-toolbar panel"><label>Pair sample<select aria-label="Pair sample" value={selectedId} onChange={e => setSelectedId(e.target.value)}>{matchingExamples.map(item => <option key={item.id} value={item.id}>{item.id} · {item.label}</option>)}</select></label><label>Similarity threshold<select aria-label="Similarity threshold" value={threshold} onChange={e => setThreshold(Number(e.target.value))}><option value={0.65}>0.65</option><option value={0.75}>0.75</option><option value={0.9}>0.90</option></select></label><span className="badge">5 operation examples · 50 pairs</span></div>
    <div style={{ margin: '18px 0' }}><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }} role="group" aria-label="判断を選ぶ"><button type="button" className={`chip ${focusField === 'overall' ? 'active' : ''}`} aria-pressed={focusField === 'overall'} onClick={() => setFocusField('overall')}>全体の判断</button>{result.fields.map(field => <button type="button" key={field.field} className={`chip ${focusField === field.field ? 'active' : ''}`} aria-pressed={focusField === field.field} onClick={() => setFocusField(field.field)}>項目: {field.field}</button>)}</div><JevDecision view={matchView} title={fieldFocus ? '選んだ項目の判断' : 'いま下している判断'} id="matching-decision" /></div>
    <div className="account-layout"><main>
      <section className="panel"><div className="section-title"><h2>左右レコード</h2><span className="count">original values preserved</span></div><div className="account-table"><div className="account-row account-head"><span>Field</span><span>Left</span><span>Right</span><span>Result</span></div>{result.fields.map(field => <div className="account-row" key={field.field} onClick={() => setFocusField(field.field)} style={{ cursor: 'pointer', outline: focusField === field.field ? '2px solid var(--teal)' : undefined, outlineOffset: -2 }}><strong>{field.field}</strong><span>{field.left ?? '—'}</span><span>{field.right ?? '—'}</span><span className={'status status-' + (field.status === 'match' ? 'matched' : field.status === 'needs-review' ? 'needs-review' : 'unmatched')}>{labels[field.status]}<small>{field.reason}</small></span></div>)}</div><div className="comparison"><div><span>全体候補</span><strong>{labels[result.overall]} · {(result.score * 100).toFixed(0)}%</strong></div><div><span>閾値</span><strong>{threshold}</strong></div></div></section>
      <section className="panel"><div className="section-title"><h2>人による修正</h2><span className={corrected === result.overall ? 'match-label' : 'mismatch-label'}>{corrected === result.overall ? '未修正' : '修正済み'}</span></div><p className="muted">候補を確定せず、レビュー結果だけを version {ENTITY_MATCHING_VERSION} として保存します。</p><div className="actions">{(['match', 'mismatch', 'needs-review'] as MatchStatus[]).map(value => <button className={corrected === value ? 'primary' : 'secondary'} key={value} onClick={() => saveCorrection(value)}>{labels[value]}</button>)}</div><p data-testid="matching-correction">reviewed: {labels[corrected]}</p></section>
      <section className="panel"><div className="section-title"><h2>50ペア評価</h2><span className="badge">{metrics.total} fixed</span></div><div className="paper-metrics"><div><span>precision</span><strong>{(metrics.precision * 100).toFixed(1)}%</strong><small>一致候補の適合率</small></div><div><span>recall</span><strong>{(metrics.recall * 100).toFixed(1)}%</strong><small>一致候補の再現率</small></div><div><span>誤統合</span><strong>{metrics.falseMerge}</strong><small>non-match を match</small></div><div><span>見逃し / 保留</span><strong>{metrics.missedMatch} / {metrics.needsReview}</strong><small>match miss · needs review</small></div></div><div className="comparison"><div><span>ID baseline</span><strong>誤統合 {metrics.baseline.id.falseMerge} · 見逃し {metrics.baseline.id.missedMatch} · 費用 {'$' + metrics.baseline.id.cost.toFixed(3)}</strong></div><div><span>文字列 baseline</span><strong>誤統合 {metrics.baseline.string.falseMerge} · 見逃し {metrics.baseline.string.missedMatch} · 費用 {'$' + metrics.baseline.string.cost.toFixed(3)}</strong></div><div><span>Jev fixed</span><strong>費用 {'$' + metrics.cost.toFixed(3)} · threshold {metrics.threshold}</strong></div></div></section>
    </main><aside className="account-side"><section className="panel"><h2>評価境界 / version</h2><dl className="meta"><div><dt>rules</dt><dd>{ENTITY_MATCHING_VERSION}</dd></div><div><dt>dataset</dt><dd>{ENTITY_MATCHING_DATA_VERSION}</dd></div><div><dt>decision</dt><dd>候補表示のみ。全体の統合を自動確定しない</dd></div></dl><div className="notice">IDがない、連絡先が不足、または重要項目が不一致なら要確認へ戻します。</div></section><section className="panel"><h2>失敗例</h2>{matchingFailureExamples.map(item => <div className="trace-list" key={item.pair.id}><div><span>{item.pair.id}</span><strong>{item.pair.failure}</strong><small>Jev {labels[item.result.overall]} · ID {labels[item.idBaseline]} · string {labels[item.stringBaseline]}</small></div></div>)}</section><section className="panel safety"><h2>対象外</h2><ul><li>レコードの自動統合・削除</li><li>外部マスタ照会・書き込み</li><li>個人情報の補完・推測</li></ul></section></aside></div>
  </div>;
}
