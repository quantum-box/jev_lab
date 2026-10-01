import Link from 'next/link';
import { evaluateSemanticCase, semanticEvaluationFixture, semanticEvaluationMetrics, type SemanticLintStatus } from '../../../../lib/semantic-lint';
import { CaseExplorer, type ExplorerCase } from '../../csv-column-mapping/eval/CaseExplorer';
import '../../csv-column-mapping/mapping.css';

const statusLabel: Record<SemanticLintStatus, string> = { suspected_violation: '違反疑い', no_issue_detected: '問題検出なし', insufficient_information: '情報不足' };

export default function SemanticLintEvaluation() {
  const rows = semanticEvaluationFixture.map(evaluateSemanticCase);
  const metrics = semanticEvaluationMetrics(rows);
  const passed = rows.filter(row => row.passed).length;
  const cases: ExplorerCase[] = rows.map(row => ({ id: row.id, pass: row.passed, group: row.category, view: {
    question: 'この差分の総合判定は？', type: 'choice', source: 'rule',
    state: [['コード', row.code.split(/\r?\n/).find(line => line.trim() && !/^fn /.test(line.trim()))?.trim() ?? row.code.slice(0, 60)], ['キーワード判定', statusLabel[row.baseline]], ['人手の期待', statusLabel[row.expected]]],
    options: (Object.keys(statusLabel) as SemanticLintStatus[]).map(key => ({ key, label: statusLabel[key] })),
    picked: row.actual,
    effect: row.passed ? (row.baseline === row.expected ? '→ 期待と一致（キーワード判定も一致）' : '→ 期待と一致（キーワード判定は外れ）') : `→ 期待「${statusLabel[row.expected]}」と食い違い`,
  } }));
  return <div className="eval semantic-eval" style={{ maxWidth: 1040 }}><Link className="back" href="/pocs/semantic-lint">← コードの意味的lint</Link><div className="eyebrow">Evaluation · semantic-lint-fixture-50-v1</div><h1>固定応答・一括評価</h1><div className="panel"><p>規約準拠、違反、周辺情報不足、コメント内の誘導を含む 50 件を静的ルールで再生します。入力コードは実行せず、結果は per-rule に保存可能です。</p><div className="mapping-eval-summary"><strong>{passed} / {rows.length}</strong><span>cases passed</span></div><div className="semantic-metrics"><div><b>{(metrics.precision * 100).toFixed(0)}%</b><small>precision</small></div><div><b>{(metrics.recall * 100).toFixed(0)}%</b><small>recall</small></div><div><b>{metrics.falsePositive}</b><small>false positives</small></div><div><b>{metrics.falseNegative}</b><small>false negatives</small></div><div><b>{metrics.reviewCost}</b><small>review cost</small></div></div><h2>Semantic rules vs keyword baseline</h2><div className="comparison"><div><span>precision</span><strong>{(metrics.precision * 100).toFixed(0)}% vs {(metrics.baseline.precision * 100).toFixed(0)}%</strong></div><div><span>recall</span><strong>{(metrics.recall * 100).toFixed(0)}% vs {(metrics.baseline.recall * 100).toFixed(0)}%</strong></div><div><span>false positives / negatives</span><strong>{metrics.falsePositive} / {metrics.falseNegative} vs {metrics.baseline.falsePositive} / {metrics.baseline.falseNegative}</strong></div><div><span>cost (cases requiring review)</span><strong>{metrics.reviewCost} vs {metrics.baseline.reviewCost}</strong></div></div><CaseExplorer cases={cases} title="1件ずつ判断を見る" /><details><summary>全ケースの一覧</summary><div className="eval-list">{rows.map(row => <div key={row.id}><strong>{row.id}</strong><span>{row.passed ? 'pass' : 'fail'}</span><small>{row.category} · expected {row.expected} · actual {row.actual} · keyword {row.baseline}</small></div>)}</div></details><div className="notice">評価結果は検出器の比較用です。コード全体の出荷可否を自動決定しません。誤警報・見逃しを含むため、人手確認が必要です。</div></div></div>;
}

