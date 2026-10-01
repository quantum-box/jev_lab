'use client';
import { useState } from 'react';
import { JevDecision, type DecisionView } from '../../../../components/JevDecision';

export type ExplorerCase = { id: string; pass: boolean; group: string; view: DecisionView };

// 50-case grid: one cell per fixed case, click a cell to see that case's decision.
export function CaseExplorer({ cases, title }: { cases: ExplorerCase[]; title: string }) {
  const [selectedId, setSelectedId] = useState(cases.find(c => !c.pass)?.id ?? cases[0]?.id);
  const selected = cases.find(c => c.id === selectedId) ?? cases[0];
  const failed = cases.filter(c => !c.pass).length;
  return <section className="panel" style={{ margin: '18px 0', display: 'grid', gap: 14 }} aria-label={title}>
    <div className="section-title" style={{ margin: 0 }}><h2 style={{ fontSize: '1.05rem' }}>{title}</h2><span className="count">緑 = 期待どおり · 赤 = 期待と不一致（{failed}件）</span></div>
    <div role="listbox" aria-label="評価ケース" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(34px, 1fr))', gap: 5 }}>
      {cases.map(c => <button key={c.id} type="button" role="option" aria-selected={c.id === selected?.id} title={`${c.id} · ${c.group}`} onClick={() => setSelectedId(c.id)}
        style={{ height: 34, borderRadius: 7, border: c.id === selected?.id ? '2px solid var(--ink)' : '1px solid transparent', background: c.pass ? 'var(--mint)' : '#fbe3dc', color: c.pass ? 'var(--teal)' : '#a64d3a', fontSize: '.6rem', fontWeight: 800, padding: 0 }}>{c.id.replace(/^\D+-0*/, '')}</button>)}
    </div>
    {selected && <JevDecision view={selected.view} title={`${selected.id} · ${selected.group}${selected.pass ? '' : ' — 期待と不一致'}`} />}
  </section>;
}
