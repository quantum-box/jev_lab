'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { analyzeSemanticLint, interactionSamples, semanticLintRules, type SemanticLintStatus } from '../../../lib/semantic-lint';

const statusLabel: Record<SemanticLintStatus, string> = {
  suspected_violation: '違反疑い',
  no_issue_detected: '問題検出なし',
  insufficient_information: '情報不足',
};

export default function SemanticLintPage() {
  const [sampleId, setSampleId] = useState(interactionSamples[0].id);
  const [code, setCode] = useState(interactionSamples[0].code);
  const [diff, setDiff] = useState(interactionSamples[0].diff);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(Object.fromEntries(semanticLintRules.map(rule => [rule.id, true])));
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [review, setReview] = useState<Record<string, SemanticLintStatus>>({});
  const [saved, setSaved] = useState(false);
  const activeRules = useMemo(() => semanticLintRules.filter(rule => enabled[rule.id]), [enabled]);
  const result = useMemo(() => analyzeSemanticLint({ code, diff, rules: activeRules }), [code, diff, activeRules]);
  const lines = code.split(/\r?\n/);

  function chooseSample(id: string) {
    const sample = interactionSamples.find(item => item.id === id);
    if (!sample) return;
    setSampleId(id); setCode(sample.code); setDiff(sample.diff); setReview({}); setSaved(false);
  }
  function saveReview() {
    const payload = { ...result, code, diff, review, rules: activeRules, savedAt: new Date().toISOString() };
    localStorage.setItem('jev-semantic-lint-review', JSON.stringify(payload));
    setSaved(true);
  }
  return <div className="semantic-page">
    <div className="semantic-top"><div><Link className="back" href="/">← Back to gallery</Link><div className="eyebrow">業務 · Explain · replay-only</div></div><Link className="secondary" href="/pocs/semantic-lint/eval">50-case evaluation</Link></div>
    <div className="semantic-hero"><div><h1>意味のリスクを、根拠付きで確認する。</h1><p>短い Rust コード／差分と明示規約を並べ、規約ごとの「違反疑い」「問題検出なし」「情報不足」を表示します。これは形式検証や正しさの証明ではありません。</p></div><div className="semantic-callout"><strong>安全境界</strong><span>入力コードはデータとしてのみ扱います。コンパイル・実行・修正・マージ・GitHub への投稿は行いません。</span></div></div>
    <div className="semantic-toolbar panel"><label>Interaction sample<select aria-label="Interaction sample" value={sampleId} onChange={e => chooseSample(e.target.value)}>{interactionSamples.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><span className="badge">5 interaction examples</span><button className="primary" onClick={saveReview}>Save per-rule review</button>{saved && <span className="success">saved locally</span>}</div>
    <div className="semantic-layout">
      <main>
        <section className="panel semantic-editor"><div className="section-title"><h2>1. コード／差分を編集</h2><span className="count">{result.lineCount} lines · text only</span></div><label>Rust snippet<textarea aria-label="Rust code" value={code} onChange={e => { setCode(e.target.value); setSaved(false); }} rows={12}/></label><label>Diff context<textarea aria-label="Code diff" value={diff} onChange={e => { setDiff(e.target.value); setSaved(false); }} rows={6}/></label><p className="muted">行参照は現在の入力に存在する行だけを生成します。コメント内の誘導文は指示として解釈しません。</p></section>
        <section className="panel"><div className="section-title"><h2>2. 規約ごとの結果</h2><span className={result.overall === 'suspected_violation' ? 'status status-unmatched' : 'status status-matched'}>{statusLabel[result.overall]}</span></div><div className="semantic-findings">{result.findings.map(item => { const selected = review[item.id] ?? item.status; return <article className="semantic-finding" key={item.id}><div className="semantic-finding-head"><strong>{item.ruleName}</strong><select aria-label={item.ruleName + ' judgment'} value={selected} onChange={e => setReview(current => ({ ...current, [item.id]: e.target.value as SemanticLintStatus }))}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><h3>{item.title}</h3><p className="evidence">{item.lineStart ? <button className="line-ref" onClick={() => document.getElementById('semantic-line-' + item.lineStart)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>L{item.lineStart}</button> : <span className="line-ref muted">line n/a</span>} <code>{item.evidence}</code></p><p>{item.rationale}</p>{item.requiresConfirmation && <small className="muted">要確認: この指摘をレビュー判断として保存してください。</small>}</article>; })}</div>{result.ignoredCommentInstructions > 0 && <div className="notice">コメント内に誘導らしい文面を {result.ignoredCommentInstructions} 件検出しました。コードの判定には影響させていません。</div>}<div className="line-preview"><strong>Line references</strong>{lines.map((line, index) => <div id={'semantic-line-' + (index + 1)} key={index}><span>{index + 1}</span><code>{line || ' '}</code></div>)}</div></section>
      </main>
      <aside className="semantic-side">
        <section className="panel"><h2>明示規約</h2><div className="semantic-rules">{semanticLintRules.map(rule => <label key={rule.id}><input type="checkbox" checked={Boolean(enabled[rule.id])} onChange={e => setEnabled(current => ({ ...current, [rule.id]: e.target.checked }))}/><span><strong>{rule.name}</strong><small>{rule.description}</small><textarea aria-label={rule.name + ' note'} value={notes[rule.id] ?? ''} onChange={e => setNotes(current => ({ ...current, [rule.id]: e.target.value }))} placeholder={rule.guidance}/></span></label>)}</div></section>
        <section className="panel semantic-disclosure"><h2>判定の読み方</h2><dl><div><dt>違反疑い</dt><dd>静的な根拠があり、担当者の確認が必要</dd></div><div><dt>問題検出なし</dt><dd>検出範囲で該当なし。正しさの証明ではない</dd></div><div><dt>情報不足</dt><dd>呼び出し元・依存一覧などを追加確認</dd></div></dl></section>
        <section className="panel safety"><h2>対象外</h2><ul><li>コードの修正・マージ</li><li>GitHub レビュー投稿・PR 承認</li><li>コード全体の出荷可否の自動決定</li><li>形式検証・実行時テスト</li></ul></section>
      </aside>
    </div>
  </div>;
}
