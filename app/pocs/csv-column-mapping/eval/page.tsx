import Link from 'next/link';
import { evaluationFixture, parseCsv, inferMappings } from '../../../../lib/column-mapping';

export default function ColumnMappingEvaluation() {
  const rows = evaluationFixture.map(item => { const parsed = parseCsv(item.csv); const mappings = inferMappings(parsed.headers); return { ...item, passed: mappings.filter(x => x.target).map(x => x.target).join(',') === item.expected }; });
  const passed = rows.filter(row => row.passed).length;
  return <div className="eval"><Link className="back" href="/pocs/csv-column-mapping">← CSV列マッピング</Link><div className="eyebrow">Evaluation · mapping-fixture-50-v1</div><h1>Deterministic 50-case evaluation</h1><div className="panel"><p>同じ固定入力を毎回リプレイし、ヘッダー候補の決定性だけを検証します。外部データ・アップロード・モデル呼び出しはありません。</p><div className="mapping-eval-summary"><strong>{passed} / {rows.length}</strong><span>cases passed</span></div><div className="eval-list">{rows.map(row => <div key={row.id}><strong>{row.id}</strong><span>{row.passed ? 'pass' : 'needs review'}</span><small>{row.expected}</small></div>)}</div><div className="notice">評価 fixture: 50件固定 · input version csv-column-mapping-input-1.0 · schema customer-import-schema-2026.09</div></div></div>;
}
