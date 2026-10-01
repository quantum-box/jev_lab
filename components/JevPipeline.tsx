'use client';
import { useState } from 'react';
import { type Lens, ruleLabel, topOption, typeLabel } from '../lib/jev-lens';

const pct = (p: number) => `${Math.round(p * 100)}%`;

// State → typed question → Jev → distribution, with a typical rule's answer for contrast.
export function JevPipeline({ lens, compact = false }: { lens: Lens; compact?: boolean }) {
  const [run, setRun] = useState(0);
  const top = topOption(lens);
  const options = lens.type === 'choice' ? [...lens.options].sort((a, b) => b.p - a.p) : lens.options;
  const ruleIsTop = lens.type !== 'noul' && lens.rule.pick === top.key;
  return <div className={`jp ${compact ? 'jp-compact' : ''}`} key={run}>
    <div className="jp-flow">
      <section className="jp-stage jp-s1" aria-label="Jevに渡す状態">
        <div className="jp-label"><span className="jp-num">1</span>状態 <small>state</small></div>
        <dl className="jp-state">{lens.state.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </section>
      <div className="jp-arrow" aria-hidden="true" />
      <section className="jp-stage jp-s2" aria-label="型付きの問い">
        <div className="jp-label"><span className="jp-num">2</span>型付きの問い <small>question</small></div>
        <p className="jp-question">{lens.question}</p>
        <span className="jp-type">{typeLabel[lens.type]}</span>
        {lens.type !== 'noul' && <ul className="jp-criteria">{lens.options.map(x => <li key={x.key}>{x.label}</li>)}</ul>}
      </section>
      <div className="jp-arrow jp-arrow-core" aria-hidden="true"><span className="jp-core">Jev</span></div>
      <section className="jp-stage jp-s3" aria-label="Jevの答え">
        <div className="jp-label"><span className="jp-num">3</span>Jevの答え <small>answer</small></div>
        {lens.type === 'noul'
          ? <div className="jp-gauge"><div className="jp-gauge-track"><i style={{ width: pct(top.p) }} /></div><div className="jp-gauge-row"><span>{top.label}</span><b>{top.p.toFixed(2)}</b></div></div>
          : <ol className="jp-bars">{options.map((x, i) => <li key={x.key} className={x.key === top.key ? 'jp-top' : ''} style={{ ['--d' as string]: `${i * 90}ms` }}>
            <span className="jp-bar-label">{x.label}</span><span className="jp-bar"><i style={{ width: pct(x.p) }} /></span><b>{pct(x.p)}</b></li>)}</ol>}
        <p className="jp-verdict">→ <strong>{lens.type === 'noul' ? `${top.label} ${top.p.toFixed(2)}` : top.label}</strong>{lens.type !== 'noul' && top.p < .7 && <span className="jp-hint">確率が割れている分は、人の確認に回せる</span>}</p>
      </section>
    </div>
    <div className="jp-contrast">
      <div className={`jp-rule ${ruleIsTop ? 'same' : ''}`}><span className="jp-tag">よくあるルール実装</span><span>{lens.rule.why} → <b>{ruleLabel(lens)}</b></span></div>
      <div className="jp-point"><span className="jp-tag jp-tag-jev">Jevの見どころ</span><span>{lens.point}</span></div>
      <button type="button" className="jp-replay" onClick={() => setRun(n => n + 1)} aria-label="アニメーションをもう一度再生">↻ 再生</button>
    </div>
  </div>;
}

export function MiniBars({ lens }: { lens: Lens }) {
  const top = topOption(lens);
  if (lens.type === 'noul') return <div className="mini-bars" aria-hidden="true"><span className="mini-gauge"><i style={{ width: pct(top.p) }} /></span></div>;
  return <div className="mini-bars" aria-hidden="true">{lens.options.map(x => <span key={x.key} className={x.key === top.key ? 'on' : ''} style={{ height: `${Math.max(8, x.p * 100)}%` }} />)}</div>;
}
