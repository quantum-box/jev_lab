'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { JevDecision, type DecisionView } from '../../../components/JevDecision';
import './mapping.css';
import { buildConfig, COLUMN_MAPPING_INPUT_VERSION, COLUMN_MAPPING_SCHEMA_VERSION, inferMappings, interactionSamples, parseCsv, targetSchema, validateMappings } from '../../../lib/column-mapping';

export default function CsvColumnMappingPage() {
  const [sampleId, setSampleId] = useState<string>(interactionSamples[0].id);
  const [raw, setRaw] = useState<string>(interactionSamples[0].csv);
  const [excluded, setExcluded] = useState<string[]>([]);
  const parsed = useMemo(() => parseCsv(raw), [raw]);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const inferred = useMemo(() => inferMappings(parsed.headers), [parsed.headers]);
  const rows = inferred.map(row => corrections[row.source] === '__exclude' ? ({ ...row, target: undefined, status: 'unmatched' as const, reason: 'excluded by reviewer' }) : corrections[row.source] ? ({ ...row, target: corrections[row.source], status: 'matched' as const, reason: 'human correction' }) : row);
  const errors = useMemo(() => validateMappings(parsed, rows), [parsed, rows]);
  const config = useMemo(() => buildConfig(rows, excluded), [rows, excluded]);
  const selected = rows.find(row => row.source === selectedSource) ?? rows.find(row => row.status !== 'matched') ?? rows[0];
  const selectedIndex = selected ? parsed.headers.indexOf(selected.source) : -1;
  const otherTargets = rows.filter(row => row !== selected && row.target).map(row => row.target).join(', ');
  const decision: DecisionView | null = selected ? {
    question: 'この列はどの標準項目？', type: 'choice', source: 'rule',
    state: [['列名', selected.source || '(empty)'], ['値の例', parsed.rows.slice(0, 2).map(values => values[selectedIndex] ?? '').filter(Boolean).join(' / ') || '—'], ['他の列の割当', otherTargets || 'なし']],
    options: [...targetSchema.map(target => { const hit = selected.candidates.find(c => c.target === target.id); return { key: target.id, label: `${target.label}${hit ? `（一致 ${hit.score.toFixed(2)}）` : ''}` }; }), { key: '__none', label: '対応なし / 除外' }],
    picked: selected.target ?? '__none',
    effect: corrections[selected.source] ? '→ 担当者の訂正をそのまま設定に反映' : selected.status === 'matched' ? `→ ${selected.target} として設定JSONに書き出す` : selected.status === 'needs-review' ? `→ ${selected.target ?? '候補'} を仮置きし、担当者の確認待ち（${selected.reason}）` : '→ どの項目にも割り当てず、担当者の判断を待つ',
  } : null;
  function chooseSample(id: string) { const sample = interactionSamples.find(item => item.id === id)!; setSampleId(id); setSelectedSource(null); setRaw(sample.csv); setCorrections({}); setExcluded([]); }
  function download() { if (errors.length > 0) return; const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'csv-column-mapping-config.json'; a.click(); URL.revokeObjectURL(url); }
  return <div className="mapping-page"><div className="detail-head"><Link className="back" href="/">← Back to gallery</Link><div className="eyebrow">業務 · Recommend · replay-only</div><h1>CSV列を、壊さず標準スキーマへ。</h1><p>CSVの元データを保持したまま、候補マッピング・未一致・要確認を並べ、担当者の訂正と除外を設定として書き出します。</p></div>
    <div className="mapping-toolbar panel"><label>Interaction sample<select aria-label="Interaction sample" value={sampleId} onChange={e => chooseSample(e.target.value)}>{interactionSamples.map(sample => <option key={sample.id} value={sample.id}>{sample.label}</option>)}</select></label><span className="badge">50-case fixture</span><Link className="secondary" href="/pocs/csv-column-mapping/eval">Open evaluation</Link><span className="muted">No upload · no external API · no transform code</span></div>
    <div className="mapping-layout"><main>{decision && <div style={{ marginBottom: 18 }}><JevDecision view={decision} title={`列「${selected.source || '(empty)'}」の判断 — 下の表の行をクリックで切り替え`} id="mapping-decision" /></div>}<section className="panel"><div className="section-title"><h2>1. Paste CSV sample</h2><span className="count">{parsed.headers.length} columns · {parsed.rows.length} rows</span></div><textarea aria-label="CSV input" value={raw} onChange={e => { setRaw(e.target.value); setCorrections({}); setExcluded([]); }} rows={7} className="mapping-input"/><div className="version-row"><span>Input version <b>{COLUMN_MAPPING_INPUT_VERSION}</b></span><span>Schema version <b>{COLUMN_MAPPING_SCHEMA_VERSION}</b></span></div>{parsed.warnings.length > 0 && <div className="error" role="alert">{parsed.warnings.map(w => <div key={w}>{w}</div>)}</div>}</section>
      <section className="panel"><div className="section-title"><h2>2. Review candidates</h2><span className="count">original values preserved</span></div><div className="mapping-table" role="table"><div className="mapping-row mapping-head"><span>Source header</span><span>Target field</span><span>Status / reason</span><span>Sample value</span></div>{rows.map(row => <div className="mapping-row" role="row" key={row.source} aria-selected={row === selected} onClick={() => setSelectedSource(row.source)} style={{ cursor: 'pointer', ...(row === selected ? { background: 'var(--mint)', boxShadow: 'inset 3px 0 0 var(--teal)' } : {}) }}><div><strong>{row.source || '(empty)'}</strong><small>{row.candidates.slice(0, 2).map(c => `${c.target} ${(c.score * 100).toFixed(0)}%`).join(' · ') || 'no candidate'}</small></div><div><select aria-label={`${row.source || 'empty'} target`} value={row.target ?? ''} onChange={e => { const value = e.target.value; setCorrections(current => ({ ...current, [row.source]: value || '__exclude' })); setExcluded(current => value ? current.filter(x => x !== row.source) : [...new Set([...current, row.source])]); }}><option value="">— Exclude / unmapped —</option>{targetSchema.map(target => <option key={target.id} value={target.id}>{target.label} ({target.type})</option>)}</select></div><div><span className={`status status-${row.status}`}>{row.status}</span><small>{row.reason}</small></div><code>{parsed.rows[0]?.[parsed.headers.indexOf(row.source)] ?? '—'}</code></div>)}</div>{errors.length > 0 ? <div className="error" role="alert">{errors.map(error => <div key={error}>{error}</div>)}</div> : <div className="success">All required targets mapped; type checks passed.</div>}</section></main>
      <aside className="mapping-side"><section className="panel"><h2>3. Mapping config</h2><button className="primary" onClick={download} disabled={errors.length > 0}>Download JSON config</button>{errors.length > 0 && <p className="muted">Resolve validation errors before downloading.</p>}<pre className="config-json" aria-label="JSON config">{JSON.stringify(config, null, 2)}</pre></section><section className="panel"><h2>Safety boundary</h2><ul className="safety-list"><li>元のヘッダー・セル値は変更しません</li><li>必須項目・型・重複割当を検証します</li><li>任意の変換コードや外部書き込みはありません</li></ul></section></aside>
    </div></div>;
}
