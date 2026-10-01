'use client';
import { type LensType, typeLabel } from '../lib/jev-lens';

export type DecisionOption = { key: string; label: string; p?: number };
export type DecisionSource = 'rule' | 'replay' | 'jev';
export type DecisionView = {
  question: string;
  type: LensType;
  state: [string, string][];
  options: DecisionOption[];
  // choice/score: the picked option key; noul: 0..1 or null (not applicable / undecidable)
  picked: string | number | null;
  source: DecisionSource;
  // What the app does with the answer, e.g. "→ 住民ハナが交易を実行"
  effect?: string;
  // Label for p values when they are not probabilities (e.g. rule scores)
  scoreLabel?: string;
};

const sourceLabel: Record<DecisionSource, string> = {
  rule: 'いまの判断 · ローカルのルール',
  replay: 'いまの判断 · 固定リプレイ',
  jev: 'いまの判断 · Jev live',
};
const pct = (p: number) => `${Math.round(p * 100)}%`;

// Live, state-driven view of the decision an app just made, in the same shape Jev answers in.
// Re-animates whenever the state or answer changes, so each decision is visible as it happens.
export function JevDecision({ view, title = 'この画面の判断', id }: { view: DecisionView; title?: string; id?: string }) {
  const animKey = JSON.stringify([view.state, view.picked]);
  const hasP = view.options.some(o => o.p !== undefined);
  const options = view.type === 'choice' && hasP ? [...view.options].sort((a, b) => (b.p ?? 0) - (a.p ?? 0)) : view.options;
  const pickedLabel = view.type === 'noul'
    ? (view.picked === null ? '該当なし / 判断保留（null）' : Number(view.picked).toFixed(2))
    : view.options.find(o => o.key === String(view.picked))?.label ?? '—';
  return <section className="jd" aria-label={title} data-testid={id}>
    <header className="jd-head"><span className="jd-title">{title}</span><span className={`jd-source jd-${view.source}`}>{sourceLabel[view.source]}</span></header>
    <div className="jp jp-compact jd-body" key={animKey}>
      <div className="jp-flow">
        <section className="jp-stage jp-s1"><div className="jp-label"><span className="jp-num">1</span>状態 <small>state</small></div>
          <dl className="jp-state">{view.state.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>
        <div className="jp-arrow" aria-hidden="true" />
        <section className="jp-stage jp-s2"><div className="jp-label"><span className="jp-num">2</span>問い <small>question</small></div>
          <p className="jp-question">{view.question}</p><span className="jp-type">{typeLabel[view.type]}</span></section>
        <div className="jp-arrow jp-arrow-core" aria-hidden="true"><span className="jp-core">{view.source === 'jev' ? 'Jev' : view.source === 'rule' ? 'Rule' : 'Replay'}</span></div>
        <section className="jp-stage jp-s3"><div className="jp-label"><span className="jp-num">3</span>答え <small>answer</small></div>
          {view.type === 'noul'
            ? <div className="jp-gauge"><div className="jp-gauge-track"><i style={{ width: view.picked === null ? '0%' : pct(Number(view.picked)) }} /></div><div className="jp-gauge-row"><span>該当度</span><b>{view.picked === null ? 'null' : pickedLabel}</b></div></div>
            : hasP
              ? <ol className="jp-bars">{options.map((o, i) => <li key={o.key} className={o.key === String(view.picked) ? 'jp-top' : ''} style={{ ['--d' as string]: `${i * 70}ms` }}><span className="jp-bar-label">{o.label}</span><span className="jp-bar"><i style={{ width: pct(o.p ?? 0) }} /></span><b>{pct(o.p ?? 0)}</b></li>)}</ol>
              : <ul className="jd-options">{options.map(o => <li key={o.key} className={o.key === String(view.picked) ? 'on' : ''}>{o.key === String(view.picked) ? '● ' : ''}{o.label}</li>)}</ul>}
          {hasP && view.scoreLabel && <p className="jd-note">{view.scoreLabel}</p>}
          <p className="jp-verdict">→ <strong>{pickedLabel}</strong></p>
        </section>
      </div>
      {view.effect && <p className="jd-effect">{view.effect}</p>}
    </div>
  </section>;
}

// Scrolling log of recent decisions for continuous simulations (newest first).
export type DecisionLogItem = { id: string; who?: string; question: string; answer: string; source: DecisionSource; ok?: boolean };
export function DecisionLog({ items, title = '判断ログ' }: { items: DecisionLogItem[]; title?: string }) {
  return <section className="jd-log" aria-label={title}><header className="jd-head"><span className="jd-title">{title}</span><span className="jd-count">{items.length}件</span></header>
    {items.length === 0 ? <p className="jd-empty">まだ判断はありません。開始すると、ここに1件ずつ流れます。</p>
      : <ol>{items.map(x => <li key={x.id} className={x.ok === false ? 'ng' : ''}><span className={`jd-dot jd-${x.source}`} />{x.who && <b>{x.who}</b>}<span className="jd-q">{x.question}</span><span className="jd-a">→ {x.answer}</span>{x.ok === false && <em>適用時に却下</em>}</li>)}</ol>}
  </section>;
}
