import Link from 'next/link';
import { evaluationFixture, evaluateFixtureCase } from '../../../../lib/column-mapping';

export default function ColumnMappingEvaluation() {
  const rows = evaluationFixture.map(item => ({ ...item, ...evaluateFixtureCase(item) }));
  const passed = rows.filter(row => row.passed).length;
  return <div className="eval"><Link className="back" href="/pocs/csv-column-mapping">← CSV列マッピング</Link><div className="eyebrow">Evaluation · mapping-fixture-50-v1</div><h1>Deterministic 50-case evaluation</h1><div className="panel"><p>英語・日本語・略語・曖昧・未対応・重複ヘッダーを含む固定入力をリプレイし、各ケースの期待 outcome と deterministic baseline を比較します。外部データ・アップロード・モデル呼び出しはありません。</p><div className="mapping-eval-summary"><strong>{passed} / {rows.length}</strong><span>cases passed</span></div><div className="eval-list">{rows.map(row => <div key={row.id}><strong>{row.id}</strong><span>{row.passed ? 'pass' : `fail: ${row.actual}`}</span><small>{row.category} · expected {row.expected} · baseline {row.actual}</small></div>)}</div><div className="notice">評価 fixture: 50件固定 · input version csv-column-mapping-input-1.0 · schema customer-import-schema-2026.09</div></div></div>;
}
