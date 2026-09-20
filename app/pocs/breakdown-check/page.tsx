'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BREAKDOWN_CRITERIA_VERSION, BREAKDOWN_DATA_VERSION, aspectDefinitions, aspectLabels, breakdownFailureExamples, breakdownMetrics, breakdownSamples, checkBreakdown, evaluationCases, type AspectKey, type CoverageStatus, type GoalTask } from '../../../lib/breakdown-check';

const statusLabels: Record<CoverageStatus, string> = { fulfilled: '充足', 'suspected-gap': '不足疑い', 'insufficient-info': '情報不足' };
const aspectOrder: AspectKey[] = ['verification', 'publication', 'dependency'];

export default function BreakdownCheckPage() {
  const [selectedId, setSelectedId] = useState(breakdownSamples[0].id);
  const sample = breakdownSamples.find(item => item.id === selectedId) ?? breakdownSamples[0];
  const [goalTitle, setGoalTitle] = useState(sample.goalTitle);
  const [outcome, setOutcome] = useState(sample.outcome);
  const [taskText, setTaskText] = useState(sample.tasks.map(task => `${task.title} — ${task.description}`).join('\n'));
  const [requiredAspects, setRequiredAspects] = useState<AspectKey[]>(sample.requiredAspects);
  const [evaluated, setEvaluated] = useState(false);
  const tasks = useMemo<GoalTask[]>(() => taskText.split('\n').map((line, index) => line.trim()).filter(Boolean).map((line, index) => { const [title, description] = line.split(' — '); return { id: `input-task-${index + 1}`, title: title || line, description: description || line, url: `#input-task-${index + 1}`, goalId: sample.id }; }), [taskText, sample.id]);
  const current = useMemo(() => checkBreakdown({ ...sample, goalTitle, outcome, tasks, requiredAspects }), [sample, goalTitle, outcome, tasks, requiredAspects]);
  const metrics = useMemo(() => breakdownMetrics(evaluationCases), []);

  function chooseSample(id: string) {
    const next = breakdownSamples.find(item => item.id === id) ?? breakdownSamples[0];
    setSelectedId(next.id); setGoalTitle(next.goalTitle); setOutcome(next.outcome); setTaskText(next.tasks.map(task => `${task.title} — ${task.description}`).join('\n')); setRequiredAspects(next.requiredAspects); setEvaluated(false);
  }
  function toggleAspect(aspect: AspectKey) { setRequiredAspects(current => current.includes(aspect) ? current.filter(item => item !== aspect) : [...current, aspect]); }

  return <div className="breakdown-page">
    <div className="breakdown-top"><Link className="back" href="/">← Back to gallery</Link><span className="eyebrow">PLT-4905 · COVERAGE CHECK</span></div>
    <section className="breakdown-hero"><div><div className="eyebrow">BREAKDOWN CHECK / JEV FIXED REPLAY</div><h1>分解の穴を、<br />観点別に確かめる。</h1><p>目標ツリーと既存タスクを、指定した検証・公開・依存解消の観点でcoverage測定します。新しいタスクを作ったり、任意の目標を完全分解したりせず、根拠と情報不足を残します。</p></div><div className="breakdown-callout"><strong>coverageは指定観点に限る</strong><span>未指定の観点まで網羅したとは主張しません。個人・組織データ、Basepath、Linear本番変更、自動タスク作成は対象外です。</span></div></section>

    <div className="breakdown-toolbar panel"><label>Operation sample<select aria-label="Operation sample" value={selectedId} onChange={event => chooseSample(event.target.value)}>{breakdownSamples.map(item => <option key={item.id} value={item.id}>{item.id} · {item.label}</option>)}</select></label><span className="badge">5 examples</span><button className="secondary" onClick={() => setEvaluated(true)}>Run 50-case evaluation</button><span className="muted">fixed response · no external API · no task writes</span></div>

    <div className="breakdown-layout"><main>
      <section className="panel breakdown-input"><div className="section-title"><div><div className="eyebrow">1. INPUT</div><h2>目標・成果条件・既存タスク</h2></div><span className="badge">local only</span></div><label>目標<input aria-label="Goal title" value={goalTitle} onChange={event => setGoalTitle(event.target.value)} /></label><label>成果条件<textarea aria-label="Outcome" rows={2} value={outcome} onChange={event => setOutcome(event.target.value)} /></label><label>既存タスク（1行1件）<textarea aria-label="Existing tasks" rows={5} value={taskText} onChange={event => setTaskText(event.target.value)} /></label><div className="aspect-picker"><strong>必要観点</strong>{aspectOrder.map(aspect => <label key={aspect}><input type="checkbox" checked={requiredAspects.includes(aspect)} onChange={() => toggleAspect(aspect)} />{aspectLabels[aspect]}</label>)}</div></section>

      <section className="panel"><div className="section-title"><div><div className="eyebrow">2. GOAL TREE</div><h2>既存ツリーと根拠タスク</h2></div><span className="count">{tasks.length} tasks · {requiredAspects.length} aspects</span></div><div className="goal-tree"><div className="goal-node"><span>GOAL</span><strong>{goalTitle || '目標未入力'}</strong><small>{outcome || '成果条件未入力'}</small></div><div className="task-branches">{tasks.length === 0 ? <p className="muted">既存タスクがありません。</p> : tasks.map(task => <a className="task-node" id={task.id} href={task.url} key={task.id}><span>TASK</span><strong>{task.title}</strong><small>{task.description}</small></a>)}</div></div></section>

      <section className="panel"><div className="section-title"><div><div className="eyebrow">3. SEMANTIC COVERAGE</div><h2>観点別の判定</h2></div><span className="badge">{current.mode}</span></div><div className="coverage-grid">{current.coverage.map(item => <article className="coverage-card" key={item.aspect}><div className="coverage-head"><strong>{item.label}</strong><span className={`coverage-status coverage-${item.status}`}>{statusLabels[item.status]}</span></div><p>{aspectDefinitions[item.aspect]}</p><div className="coverage-evidence">{item.evidence.length ? item.evidence.map(task => <a href={task.url} key={task.id}>↳ {task.id}: {task.title}</a>) : <span>根拠タスクなし</span>}</div><small>{item.reason}</small></article>)}</div><div className="coverage-note">判定は指定観点のcoverageのみ。情報不足は不足と断定せず、人が既存タスク・前提を確認してください。</div></section>

      {evaluated && <section className="panel" data-testid="breakdown-evaluation"><div className="section-title"><div><div className="eyebrow">FIXED 50-CASE EVALUATION</div><h2>不足検出の評価</h2></div><span className="badge">{evaluationCases.length} cases · {metrics.totalChecks} checks</span></div><div className="breakdown-metrics"><div><span>不足検出率</span><strong>{(metrics.gapDetectionRate * 100).toFixed(1)}%</strong><small>人の不足疑いを検出した割合</small></div><div><span>誤指摘率</span><strong>{(metrics.falsePositiveRate * 100).toFixed(1)}%</strong><small>充足を不足疑いにした割合</small></div><div><span>保留率</span><strong>{(metrics.holdRate * 100).toFixed(1)}%</strong><small>情報不足として人へ戻した割合</small></div><div><span>費用比較</span><strong>$0 / $0 / $0.10</strong><small>keyword / Jev fixed / live estimate</small></div></div><div className="baseline-line"><strong>Keyword baseline</strong><span>不足検出率 {(metrics.baselineGapDetectionRate * 100).toFixed(1)}% · 誤指摘率 {(metrics.baselineFalsePositiveRate * 100).toFixed(1)}% · 保留率 {(metrics.baselineHoldRate * 100).toFixed(1)}%</span></div><p className="muted">固定合成データと参照coverageによる比較です。実際のプロジェクト品質や完全な分解を保証しません。</p></section>}
    </main><aside className="breakdown-side">
      <section className="panel"><h2>5 operation examples</h2>{breakdownSamples.map(item => { const result = checkBreakdown(item); return <button className={`breakdown-sample ${item.id === selectedId ? 'selected' : ''}`} onClick={() => chooseSample(item.id)} key={item.id}><strong>{item.id}</strong><span>{item.label}</span><em>{result.coverage.map(row => `${row.label}:${statusLabels[row.status]}`).join(' · ')}</em></button>; })}</section>
      <section className="panel"><h2>判定ルール</h2><dl className="breakdown-meta">{aspectOrder.map(aspect => <div key={aspect}><dt>{aspectLabels[aspect]}</dt><dd>{aspectDefinitions[aspect]}</dd></div>)}<div><dt>Boundary</dt><dd>根拠タスクへのリンクを保持。新規タスクは生成しない。</dd></div></dl><div className="notice">「不足疑い」は指摘であり、目標の完全分解や優先度付けではありません。</div></section>
      <section className="panel"><h2>失敗例（固定）</h2>{breakdownFailureExamples.map(item => <div className="breakdown-failure" key={item.sample.id}><strong>{item.sample.failureTag}</strong><span>{item.sample.id} · Jev {item.jev.coverage.map(row => `${row.label}:${statusLabels[row.status]}`).join(' / ')}</span><small>keyword baselineとの差を確認</small></div>)}</section>
      <section className="panel breakdown-disclosure"><h2>Data & version</h2><p>公開利用可能な合成計画データのみ。個人・組織のタスク、外部Web、Linear/Basepathへの読み書きはありません。</p><p className="muted">criteria: {BREAKDOWN_CRITERIA_VERSION}<br />dataset: {BREAKDOWN_DATA_VERSION}<br />mode: jev-fixed-replay</p></section>
    </aside></div>
  </div>;
}
