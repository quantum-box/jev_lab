import Link from 'next/link';
import { evaluationFixture, evaluateFixtureCase, inferMappings, parseCsv } from '../../../../lib/column-mapping';
import { CaseExplorer, type ExplorerCase } from './CaseExplorer';
import '../mapping.css';

const outcomeLabel = { matched: 'そのまま取り込める', 'needs-review': '人の確認が必要', unmatched: '取り込めない' } as const;

export default function ColumnMappingEvaluation() {
  const rows = evaluationFixture.map(item => ({ ...item, ...evaluateFixtureCase(item) }));
  const passed = rows.filter(row => row.passed).length;
  const cases: ExplorerCase[] = rows.map(row => { const parsed = parseCsv(row.csv); const mapped = inferMappings(parsed.headers); return { id: row.id, pass: row.passed, group: row.category, view: {
    question: 'このCSVの取り込み判定は？', type: 'choice', source: 'replay',
    state: [['ヘッダー', parsed.headers.join(', ')], ['列ごとの割当', mapped.map(m => `${m.source}→${m.target ?? '—'}`).join(' · ')], ['人手の期待', outcomeLabel[row.expected]]],
    options: (Object.keys(outcomeLabel) as Array<keyof typeof outcomeLabel>).map(key => ({ key, label: outcomeLabel[key] })),
    picked: row.actual,
    effect: row.passed ? '→ 人手の期待ラベルと一致' : `→ 期待「${outcomeLabel[row.expected]}」と食い違い`,
  } }; });
  return <div className="eval" style={{ maxWidth: 1040 }}><Link className="back" href="/pocs/csv-column-mapping">← CSV列マッピング</Link><div className="eyebrow">Evaluation · mapping-fixture-50-v1</div><h1>Deterministic 50-case evaluation</h1><div className="panel"><p>英語・日本語・略語・曖昧・未対応・重複ヘッダーを含む固定入力をリプレイし、各ケースの期待 outcome と deterministic baseline を比較します。外部データ・アップロード・モデル呼び出しはありません。</p><div className="mapping-eval-summary"><strong>{passed} / {rows.length}</strong><span>cases passed</span></div><CaseExplorer cases={cases} title="1件ずつ判断を見る" /><details><summary>全ケースの一覧</summary><div className="eval-list">{rows.map(row => <div key={row.id}><strong>{row.id}</strong><span>{row.passed ? 'pass' : `fail: ${row.actual}`}</span><small>{row.category} · expected {row.expected} · baseline {row.actual}</small></div>)}</div></details><div className="notice">評価 fixture: 50件固定 · input version csv-column-mapping-input-1.0 · schema customer-import-schema-2026.09</div></div></div>;
}
