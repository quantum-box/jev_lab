'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  PAPER_SCREENING_CRITERIA_VERSION,
  PAPER_SCREENING_DATA_VERSION,
  criterionDefinitions,
  criterionLabels,
  evaluationCases,
  evaluationMetrics,
  screenPaper,
  screeningFailureExamples,
  screeningSamples,
  type ScreeningDecision,
} from '../../../lib/paper-screening';

const decisionLabels: Record<ScreeningDecision, string> = { include: '採用候補', exclude: '除外候補', 'needs-review': '要確認' };
const criterionStatusLabels = { yes: '記載あり', no: '不一致', unknown: '不明' } as const;

export default function PaperScreeningPage() {
  const [selectedId, setSelectedId] = useState(screeningSamples[0].id);
  const [reviewerDecisions, setReviewerDecisions] = useState<Record<string, ScreeningDecision>>({});
  const [evaluated, setEvaluated] = useState(false);
  const paper = screeningSamples.find(item => item.id === selectedId) ?? screeningSamples[0];
  const result = useMemo(() => screenPaper(paper), [paper]);
  const metrics = useMemo(() => evaluationMetrics(evaluationCases), []);
  const grouped = useMemo(() => screeningSamples.reduce<Record<ScreeningDecision, typeof screeningSamples>>((groups, item) => {
    const decision = screenPaper(item).decision;
    groups[decision].push(item);
    return groups;
  }, { include: [], exclude: [], 'needs-review': [] }), []);
  const humanDecision = reviewerDecisions[paper.id] ?? paper.humanDecision;
  const isCompared = humanDecision === result.decision;

  function setHumanDecision(value: ScreeningDecision) {
    setReviewerDecisions(current => ({ ...current, [paper.id]: value }));
  }

  return <div className="paper-page">
    <div className="paper-top"><Link className="back" href="/">← Back to gallery</Link><span className="eyebrow">PLT-4907 · ABSTRACT-ONLY SCREENING</span></div>
    <section className="paper-hero">
      <div><div className="eyebrow">PAPER SCREENING / JEV FIXED REPLAY</div><h1>論文要旨から、<br />レビュー候補を整える。</h1><p>研究テーマと採用・除外条件を分解し、要旨に書かれている範囲だけを条件別に判定します。採用・除外を自動確定せず、根拠と「不明」を残して人の採否と比較できます。</p></div>
      <div className="paper-callout"><strong>要旨だけで品質を断定しない</strong><span>全文の内容、研究品質、臨床判断は対象外。公開利用可能な合成要旨を使う固定応答PoCで、外部Web収集やResearchFund本番更新は行いません。</span></div>
    </section>

    <div className="paper-toolbar panel">
      <label>Screening sample<select aria-label="Screening sample" value={selectedId} onChange={event => setSelectedId(event.target.value)}>{screeningSamples.map(item => <option key={item.id} value={item.id}>{item.id} · {item.title}</option>)}</select></label>
      <span className="badge">5 operation examples</span><button className="secondary" onClick={() => setEvaluated(true)}>Run 50-case evaluation</button><span className="muted">fixed response · no external API · no secrets</span>
    </div>

    <div className="paper-layout"><main>
      <section className="panel paper-abstract"><div className="section-title"><div><div className="eyebrow">SELECTED ABSTRACT</div><h2>{paper.title}</h2></div><span className="badge">{paper.language}</span></div><p className="paper-byline">{paper.authors} · {paper.year} · {paper.id}</p><p className="abstract-text">{paper.abstract}</p><div className="paper-source"><span>Source: <a href={paper.source.url} target="_blank" rel="noreferrer">{paper.source.label}</a></span><span>{paper.source.license}</span><span>{paper.source.provenance}</span></div></section>

      <section className="panel"><div className="section-title"><div><div className="eyebrow">JEV CRITERIA TRACE</div><h2>条件別の判定と根拠</h2></div><span className={`paper-decision decision-${result.decision}`}>{decisionLabels[result.decision]}</span></div><div className="criteria-grid">{result.criteria.map(item => <article className="criterion-card" key={item.key}><div className="criterion-head"><strong>{item.label}</strong><span className={`criterion-status criterion-${item.status}`}>{criterionStatusLabels[item.status]}</span></div><p>{criterionDefinitions[item.key]}</p><blockquote>{item.evidence}</blockquote><small>{item.rationale}</small></article>)}</div><div className="paper-decision-line"><span>Jev判定</span><strong>{decisionLabels[result.decision]}</strong><span>{result.reason}</span></div></section>

      <section className="panel"><div className="section-title"><div><div className="eyebrow">HUMAN CHECK</div><h2>人の採否との比較</h2></div><span className={isCompared ? 'match-label' : 'mismatch-label'}>{isCompared ? '一致' : '差分あり'}</span></div><div className="human-row"><div><span>Jev fixed replay</span><strong>{decisionLabels[result.decision]}</strong></div><div><label>Human adjudication<select aria-label="Human adjudication" value={humanDecision} onChange={event => setHumanDecision(event.target.value as ScreeningDecision)}>{Object.entries(decisionLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div></div><p className="muted">人の判断は合成データの参照値です。判定が一致しても、全文確認や研究品質評価の代わりにはなりません。</p></section>

      {evaluated && <section className="panel" data-testid="paper-evaluation"><div className="section-title"><div><div className="eyebrow">FIXED 50-CASE EVALUATION</div><h2>候補の取りこぼしを測る</h2></div><span className="badge">{metrics.total} cases · fixed</span></div><div className="paper-metrics"><div><span>採用候補再現率</span><strong>{(metrics.candidateRecall * 100).toFixed(1)}%</strong><small>人の採用を除外しなかった割合</small></div><div><span>誤除外率</span><strong>{(metrics.falseExclusionRate * 100).toFixed(1)}%</strong><small>採用を除外候補にした割合</small></div><div><span>要確認率</span><strong>{(metrics.needsReviewRate * 100).toFixed(1)}%</strong><small>不明を人へ戻した割合</small></div><div><span>費用比較</span><strong>$0 / $0 / $0.10</strong><small>keyword / Jev replay / live estimate</small></div></div><div className="baseline-compare"><strong>Keyword baseline comparison</strong><span>採用候補再現率 {(metrics.baselineCandidateRecall * 100).toFixed(1)}% · 誤除外率 {(metrics.baselineFalseExclusionRate * 100).toFixed(1)}% · 要確認率 {(metrics.baselineNeedsReviewRate * 100).toFixed(1)}%</span></div><div className="confusion" aria-label="Evaluation confusion matrix"><strong>Jev × human reference</strong><div className="confusion-head"><span>human \ Jev</span><span>採用</span><span>除外</span><span>要確認</span></div>{(['include', 'exclude', 'needs-review'] as ScreeningDecision[]).map(expected => <div className="confusion-row" key={expected}><span>{decisionLabels[expected]}</span><span>{metrics.confusion[expected].include}</span><span>{metrics.confusion[expected].exclude}</span><span>{metrics.confusion[expected]['needs-review']}</span></div>)}</div><p className="muted">キーワード一致は意味的なテーマ適合を保証しないため、失敗例を下に固定表示しています。</p></section>}
    </main><aside className="paper-side">
      <section className="panel"><h2>候補一覧</h2>{(['include', 'exclude', 'needs-review'] as ScreeningDecision[]).map(decision => <div className="candidate-group" key={decision}><div><span className={`paper-decision decision-${decision}`}>{decisionLabels[decision]}</span><b>{grouped[decision].length}</b></div>{grouped[decision].map(item => <button className={`candidate-item ${item.id === selectedId ? 'selected' : ''}`} onClick={() => setSelectedId(item.id)} key={item.id}><strong>{item.id}</strong><span>{item.title}</span></button>)}</div>)}</section>
      <section className="panel"><h2>基準と境界</h2><dl className="paper-meta"><div><dt>Theme</dt><dd>{criterionDefinitions.theme}</dd></div><div><dt>Include</dt><dd>4条件が記載あり</dd></div><div><dt>Exclude</dt><dd>必須条件の不一致</dd></div><div><dt>Unknown</dt><dd>要旨に未記載なら不明</dd></div></dl><div className="notice">採否の最終決定は人が行います。要旨にない全文情報を補完しません。</div></section>
      <section className="panel"><h2>失敗例（固定）</h2>{screeningFailureExamples.map(item => <div className="failure-row" key={item.paper.id}><strong>{item.tag}</strong><span>{item.paper.id} · Jev {decisionLabels[item.jev.decision]} / baseline {decisionLabels[item.baseline]}</span></div>)}</section>
      <section className="panel paper-disclosure"><h2>Data & version</h2><p>出典: {screeningSamples[0].source.provenance}。実在論文の本文・個人情報・臨床データは含みません。</p><p className="muted">criteria: {PAPER_SCREENING_CRITERIA_VERSION}<br />dataset: {PAPER_SCREENING_DATA_VERSION}<br />mode: jev-fixed-replay</p></section>
    </aside></div>
  </div>;
}
