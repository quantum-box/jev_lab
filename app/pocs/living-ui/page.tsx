'use client';

import {FormEvent, useMemo, useState} from 'react';
import {
  DISPLAY_COMPONENT_REGISTRY,
  LIVING_EVALUATION_CASES,
  LIVING_OPERATION_SAMPLES,
  LIVING_RECORDS,
  type DisplayComponentId,
  type LivingRecord,
  type LivingResolution,
  resolveLivingUi,
  validateComposition,
} from '../../../lib/living-ui';

type HistoryEntry = {prompt: string; resolution: LivingResolution};

function priorityRank(priority: LivingRecord['priority']): number {
  return priority === '高' ? 0 : priority === '中' ? 1 : 2;
}

function sourceLabel(records: readonly LivingRecord[]): string {
  return records.length === 0 ? '対応する固定レコードなし' : records.map((record) => record.id).join(' · ');
}

function TableDisplay({records}: {records: readonly LivingRecord[]}) {
  return <div className="living-component-scroll"><table className="living-table"><caption>仕事の一覧。各行の ID は固定元レコードに対応</caption><thead><tr><th scope="col">仕事 / ID</th><th scope="col">担当</th><th scope="col">状態</th><th scope="col">優先</th><th scope="col">期限</th><th scope="col">進捗</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><th scope="row"><strong>{record.title}</strong><small>{record.id}</small></th><td>{record.owner}</td><td><span className={`living-status living-status-${record.status}`}>{record.status}</span></td><td>{record.priority}</td><td>{record.due}</td><td>{record.progress}%</td></tr>)}</tbody></table></div>;
}

function ComparisonDisplay({records}: {records: readonly LivingRecord[]}) {
  const pair = [...records].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.progress - a.progress).slice(0, 2);
  if (pair.length < 2) return <p className="living-empty">比較には 2 件以上の元レコードが必要です。</p>;
  const rows: Array<[string, string, string]> = [
    ['優先度', pair[0].priority, pair[1].priority],
    ['進捗', `${pair[0].progress}%`, `${pair[1].progress}%`],
    ['期限', pair[0].due, pair[1].due],
    ['担当', pair[0].owner, pair[1].owner],
  ];
  return <div className="living-comparison"><div className="living-compare-head"><div><small>{pair[0].id}</small><strong>{pair[0].title}</strong></div><span aria-hidden="true">vs</span><div><small>{pair[1].id}</small><strong>{pair[1].title}</strong></div></div>{rows.map(([label, left, right]) => <div className="living-compare-row" key={label}><span>{label}</span><strong>{left}</strong><strong>{right}</strong></div>)}<p className="living-component-note">優先度、期限、進捗を並べ、確認対象を選べるようにしています。これは固定ルールの説明であり、承認ではありません。</p></div>;
}

function CardsDisplay({records}: {records: readonly LivingRecord[]}) {
  return <div className="living-cards">{records.map((record) => <article className="living-record-card" key={record.id}><div className="living-card-top"><span className={`living-status living-status-${record.status}`}>{record.status}</span><small>{record.id}</small></div><h3>{record.title}</h3><p>{record.summary}</p><div className="living-tags">{record.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div><footer><span>{record.owner} · 期限 {record.due}</span><strong>{record.progress}%</strong></footer></article>)}</div>;
}

function TimelineDisplay({records}: {records: readonly LivingRecord[]}) {
  const events = records.flatMap((record) => record.events.map((event) => ({...event, title: record.title, recordId: record.id}))).sort((a, b) => a.date.localeCompare(b.date));
  return <ol className="living-timeline">{events.map((event) => <li key={event.id}><span className={`living-timeline-dot living-dot-${event.tone}`} aria-hidden="true" /><div><small>{event.date} · {event.recordId}</small><strong>{event.label}</strong><span>{event.title}</span></div></li>)}</ol>;
}

function ChartDisplay({records}: {records: readonly LivingRecord[]}) {
  return <div className="living-chart" role="img" aria-label="各仕事の進捗を表す棒グラフ">{records.map((record) => <div className="living-bar-row" key={record.id}><span title={record.id}>{record.title}</span><div className="living-bar-track"><div className="living-bar" style={{width: `${record.progress}%`}}><span>{record.progress}%</span></div></div></div>)}</div>;
}

const DISPLAY_RENDERERS: Record<DisplayComponentId, (props: {records: readonly LivingRecord[]}) => JSX.Element> = {
  table: TableDisplay,
  comparison: ComparisonDisplay,
  cards: CardsDisplay,
  timeline: TimelineDisplay,
  chart: ChartDisplay,
};

function ComponentDisplay({component, records}: {component: DisplayComponentId; records: readonly LivingRecord[]}) {
  const Renderer = DISPLAY_RENDERERS[component];
  return <section className="living-result-component" data-testid={`display-${component}`}><div className="living-component-title"><div><span className="living-component-kicker">Registered display</span><h3>{DISPLAY_COMPONENT_REGISTRY.find((definition) => definition.id === component)?.label}</h3></div><span className="living-schema-badge">schema v1</span></div><p className="living-component-description">{DISPLAY_COMPONENT_REGISTRY.find((definition) => definition.id === component)?.description}</p><Renderer records={records}/><p className="living-source-line">元レコード: <code>{sourceLabel(records)}</code></p></section>;
}

function initialEntry(): HistoryEntry {
  const prompt = LIVING_OPERATION_SAMPLES[0].prompt;
  return {prompt, resolution: resolveLivingUi(prompt)};
}

export default function LivingUiPage() {
  const initial = useMemo(initialEntry, []);
  const [prompt, setPrompt] = useState(initial.prompt);
  const [current, setCurrent] = useState(initial);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [notice, setNotice] = useState('固定ルールでリプレイ中。');

  function applyPrompt(nextPrompt: string, preserveInput = true) {
    const nextResolution = resolveLivingUi(nextPrompt, LIVING_RECORDS);
    if (!validateComposition(nextResolution.composition)) {
      setNotice('構成設定が不正なため、安全な表示へフォールバックしました。');
      return;
    }
    setHistory((previous) => [...previous, current].slice(-8));
    setCurrent({prompt: nextPrompt, resolution: nextResolution});
    if (preserveInput) setPrompt(nextPrompt);
    setNotice(nextResolution.composition.safeFallback ? '意図を特定できなかったため、安全な一覧へフォールバック中。' : '固定ルールでリプレイ中。');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyPrompt(prompt);
  }

  function goBack() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((items) => items.slice(0, -1));
    setCurrent(previous);
    setPrompt(previous.prompt);
    setNotice('履歴から前のビューを復元しました。');
  }

  function replay() {
    const replayed = resolveLivingUi(current.prompt, LIVING_RECORDS);
    setCurrent({prompt: current.prompt, resolution: replayed});
    setNotice('同じ入力を同じ固定ルールで再生しました。');
  }

  const {resolution} = current;
  const selectedDefinitions = resolution.composition.components.map((id) => DISPLAY_COMPONENT_REGISTRY.find((definition) => definition.id === id)).filter(Boolean);

  return <div className="living-page">
    <section className="living-hero">
      <div>
        <span className="eyebrow">PLT-4892 · Fixed replay lab</span>
        <h1>プロンプトで、<em>見え方</em>が変わる。</h1>
        <p>Living UI は、同じ固定レコードを意図に合わせた表示へ組み替える小さな実験です。選ばれた UI と元レコードの対応を、いつでも確認できます。</p>
      </div>
      <div className="living-hero-note"><strong>安全な実行境界</strong><span>固定データ · 固定ルール · 外部 API なし</span><span>表示は登録済みの 5 コンポーネントのみ</span><span>Jev live / 課金 / 書き込みは未使用</span></div>
    </section>

    <div className="living-stat-strip" aria-label="Living UI fixture summary"><div><small>固定レコード</small><strong>{LIVING_RECORDS.length}</strong></div><div><small>操作サンプル</small><strong>{LIVING_OPERATION_SAMPLES.length}</strong></div><div><small>intent/display eval</small><strong>{LIVING_EVALUATION_CASES.length} cases</strong></div><div><small>表示レジストリ</small><strong>{DISPLAY_COMPONENT_REGISTRY.length}</strong></div></div>

    <div className="living-workbench">
      <aside className="panel living-controls">
        <div className="living-panel-heading"><div><span className="living-component-kicker">01 · Prompt</span><h2>見たい形を伝える</h2></div><span className="living-mode-badge">Replay</span></div>
        <form onSubmit={submit}><label htmlFor="living-prompt">ユーザー意図 <span>固定ルールで解釈</span></label><textarea id="living-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} aria-describedby="living-prompt-help" /><p id="living-prompt-help" className="living-help">例：「期限を確認」「進捗の推移」「要点を読む」。入力は保存・送信されません。</p><button className="primary living-run-button" type="submit">この意図で表示を更新 →</button></form>
        <div className="living-samples"><div className="living-subheading"><h3>5 operation samples</h3><span>クリックでリプレイ</span></div>{LIVING_OPERATION_SAMPLES.map((sample) => <button className={`living-sample-button ${current.prompt === sample.prompt ? 'is-current' : ''}`} key={sample.id} type="button" onClick={() => applyPrompt(sample.prompt)}><span>{sample.label}</span><small>{sample.prompt}</small></button>)}</div>
        <div className="living-history-controls"><button className="secondary" type="button" onClick={goBack} disabled={history.length === 0}>← Back</button><button className="secondary" type="button" onClick={replay}>Replay current</button><span aria-live="polite">{notice}</span></div>
      </aside>

      <section className="living-stage" aria-label="Living UI output">
        <section className="panel living-composition-panel" data-testid="chosen-composition"><div className="living-panel-heading"><div><span className="living-component-kicker">02 · Decision trace</span><h2>Chosen UI composition</h2></div><span className={`living-intent-badge living-intent-${resolution.composition.intent}`}>{resolution.composition.intent}</span></div><p className="living-current-prompt">「{current.prompt || '（空の入力）'}」</p><div className="living-rule-line"><span>選択理由</span><strong>{resolution.composition.reason}</strong></div><div className="living-component-list">{selectedDefinitions.map((definition) => definition && <div key={definition.id}><strong>{definition.label}</strong><span>{definition.description}</span><code>{definition.id}</code></div>)}</div>{resolution.composition.matchedKeywords.length > 0 && <p className="living-match-line">Matched keywords: {resolution.composition.matchedKeywords.join(' / ')}</p>}{resolution.warning && <p className="living-warning" role="status">{resolution.warning}</p>}</section>

        <section className="panel living-output-panel"><div className="living-panel-heading"><div><span className="living-component-kicker">03 · Rendered output</span><h2>Registered components only</h2></div><span className="living-valid-badge">schema validated</span></div>{resolution.composition.components.map((component) => <ComponentDisplay key={component} component={component} records={resolution.records}/>)}</section>

        <section className="panel living-source-panel"><div className="living-panel-heading"><div><span className="living-component-kicker">04 · Provenance</span><h2>Original record correspondence</h2></div><span className="living-record-count">{resolution.records.length} records</span></div><p className="living-provenance-intro">表示の各要素は、下の固定レコード ID から派生しています。合成データの追加・変更や、根拠のない情報生成は行いません。</p><div className="living-provenance-grid">{resolution.records.map((record) => <div className="living-provenance-row" key={record.id} data-testid={`source-record-${record.id}`}><code>{record.id}</code><strong>{record.title}</strong><span>{record.owner} · {record.status} · {record.progress}%</span></div>)}</div></section>

        {history.length > 0 && <section className="panel living-history-panel"><div className="living-panel-heading"><div><span className="living-component-kicker">View history</span><h2>前の表示を再生</h2></div><span className="living-record-count">{history.length} snapshots</span></div><div className="living-history-list">{history.slice().reverse().map((entry, index) => <button type="button" key={`${entry.prompt}-${index}`} onClick={() => {setCurrent(entry); setPrompt(entry.prompt); setNotice('履歴のスナップショットを表示しました。');}}><span>{entry.resolution.composition.intent}</span><strong>{entry.prompt}</strong><small>{entry.resolution.composition.components.join(' + ')}</small></button>)}</div></section>}
      </section>
    </div>
  </div>;
}
