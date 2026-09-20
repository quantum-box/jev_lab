'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { comparisonMetrics, DJ_LOOPS, DJ_SCENARIOS, makeDjTrace, replayDjTrace, selectDjLoop, type DjDecision, type DjLoop, type DjTrace } from '../../../lib/ai-dj';

const MAX_VOLUME = 0.35;
const MAX_DECISIONS = 24;

function noteFrequency(step: number, loop: DjLoop) {
  const scales: Record<DjLoop['pattern'], number[]> = { pulse: [220, 277, 330, 392], swing: [196, 247, 294, 370], break: [165, 220, 262, 330], ambient: [146, 185, 220, 277] };
  return scales[loop.pattern][step % 4] * (loop.energy === 'high' ? 1.5 : loop.energy === 'low' ? 0.75 : 1);
}

export default function AiDj() {
  const [scenarioId, setScenarioId] = useState(DJ_SCENARIOS[0].id);
  const scenario = DJ_SCENARIOS.find(item => item.id === scenarioId) ?? DJ_SCENARIOS[0];
  const [prompt, setPrompt] = useState(scenario.prompt);
  const promptRef = useRef(prompt);
  const [status, setStatus] = useState<'idle' | 'playing' | 'stopped'>('idle');
  const [audioMode, setAudioMode] = useState<'web-audio' | 'visual-fallback' | 'not-started'>('not-started');
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.24);
  const volumeRef = useRef(volume);
  const [bar, setBar] = useState(0);
  const [decision, setDecision] = useState<DjDecision>(() => selectDjLoop(scenario.seed, scenario.prompt, 0));
  const [decisions, setDecisions] = useState<DjDecision[]>([]);
  const [trace, setTrace] = useState<DjTrace>(() => makeDjTrace(scenario.seed, [scenario.prompt], 0));
  const [replayed, setReplayed] = useState(false);
  const statusRef = useRef<'idle' | 'playing' | 'stopped'>('idle');
  const mutedRef = useRef(muted);
  const masterConnectedRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const voicesRef = useRef<OscillatorNode[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);
  const tokenRef = useRef(0);
  const barRef = useRef(0);
  const decisionRef = useRef(decision);
  const traceRef = useRef(trace);
  const decisionsRef = useRef(decisions);

  useEffect(() => { promptRef.current = prompt; generationRef.current += 1; }, [prompt]);
  useEffect(() => { volumeRef.current = volume; mutedRef.current = muted; if (masterRef.current) masterRef.current.gain.value = muted ? 0 : Math.min(MAX_VOLUME, volume); }, [volume, muted]);
  useEffect(() => () => stopPlayback(), []);

  function stopTimer() { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } }
  function stopVoices() { voicesRef.current.forEach(voice => { try { voice.stop(); } catch { /* already stopped */ } }); voicesRef.current = []; }
  function stopPlayback() {
    stopTimer(); stopVoices(); tokenRef.current += 1;
    if (audioRef.current?.state === 'running') void audioRef.current.suspend();
    statusRef.current = 'stopped'; setStatus('stopped');
  }

  function playBar(loop: DjLoop) {
    const context = audioRef.current;
    const master = masterRef.current;
    if (!context || !master || mutedRef.current) return;
    const start = context.currentTime + 0.02;
    const beat = 60 / loop.bpm;
    const frequencies = [noteFrequency(0, loop), noteFrequency(1, loop), noteFrequency(2, loop), noteFrequency(3, loop)];
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator(); const gain = context.createGain();
      oscillator.type = loop.pattern === 'ambient' ? 'sine' : loop.pattern === 'break' ? 'triangle' : 'square';
      oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0.0001, start + index * beat); gain.gain.exponentialRampToValueAtTime(0.16, start + index * beat + 0.012); gain.gain.exponentialRampToValueAtTime(0.0001, start + index * beat + beat * 0.72);
      oscillator.connect(gain); gain.connect(master); oscillator.start(start + index * beat); oscillator.stop(start + index * beat + beat * 0.8); voicesRef.current.push(oscillator);
    });
  }

  function scheduleNext() {
    if (barRef.current >= MAX_DECISIONS || statusRef.current !== 'playing') { statusRef.current = 'stopped'; setStatus('stopped'); return; }
    const currentBar = barRef.current + 1; barRef.current = currentBar; setBar(currentBar);
    const requestGeneration = generationRef.current; const requestToken = ++tokenRef.current;
    // The delay models an async provider while keeping every decision local and deterministic.
    window.setTimeout(() => {
      if (requestToken !== tokenRef.current || statusRef.current !== 'playing') return;
      if (requestGeneration !== generationRef.current) {
        // A changed prompt invalidates this decision, but must not stop the bar chain.
        timerRef.current = setTimeout(scheduleNext, 0);
        return;
      }
      const next = selectDjLoop(scenario.seed, promptRef.current, currentBar);
      const previousPrompt = decisionRef.current.prompt;
      const transition = next.prompt !== previousPrompt ? [{ type: 'prompt' as const, bar: currentBar, prompt: next.prompt }] : [];
      decisionRef.current = next; decisionsRef.current = [...decisionsRef.current, next].slice(-MAX_DECISIONS); traceRef.current = { schema: 'jev-ai-dj-trace', version: 1, seed: scenario.seed, events: [...traceRef.current.events, ...transition, { type: 'decision', bar: currentBar, decision: next }, { type: 'bar', bar: currentBar, loopId: next.loop.id }] };
      setDecision(next); setDecisions(decisionsRef.current); setTrace(traceRef.current); playBar(next.loop);
      timerRef.current = setTimeout(scheduleNext, Math.max(500, (60 / next.loop.bpm) * 4 * 1000));
    }, 80);
  }

  async function startPlayback() {
    stopTimer(); tokenRef.current += 1; setReplayed(false); statusRef.current = 'playing'; setStatus('playing');
    barRef.current = 0; setBar(0); decisionsRef.current = []; setDecisions([]); decisionRef.current = selectDjLoop(scenario.seed, promptRef.current, 0); setDecision(decisionRef.current); traceRef.current = { schema: 'jev-ai-dj-trace', version: 1, seed: scenario.seed, events: [] }; setTrace(traceRef.current);
    const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextCtor) {
      try { const context = audioRef.current ?? new AudioContextCtor(); audioRef.current = context; masterRef.current = masterRef.current ?? context.createGain(); masterRef.current.gain.value = mutedRef.current ? 0 : Math.min(MAX_VOLUME, volumeRef.current); if (!masterConnectedRef.current) { masterRef.current.connect(context.destination); masterConnectedRef.current = true; } await context.resume(); setAudioMode('web-audio'); } catch { setAudioMode('visual-fallback'); }
    } else setAudioMode('visual-fallback');
    scheduleNext();
  }

  function changeScenario(id: string) { stopPlayback(); const next = DJ_SCENARIOS.find(item => item.id === id) ?? DJ_SCENARIOS[0]; setScenarioId(next.id); setPrompt(next.prompt); promptRef.current = next.prompt; const initial = selectDjLoop(next.seed, next.prompt, 0); setDecision(initial); decisionRef.current = initial; setBar(0); setDecisions([]); decisionsRef.current = []; const empty = { schema: 'jev-ai-dj-trace' as const, version: 1 as const, seed: next.seed, events: [] }; setTrace(empty); traceRef.current = empty; setAudioMode('not-started'); }
  function replayTrace() { const replay = replayDjTrace(traceRef.current); if (replay.state) { setDecision(replay.state); decisionRef.current = replay.state; setBar(replay.state.bar); setReplayed(true); } }
  const metrics = comparisonMetrics(trace);
  return <div className="dj-page">
    <div className="dj-top"><Link className="back" href="/">← Gallery</Link><span className="eyebrow">PLT-4891 · LOCAL DECISION POC</span></div>
    <section className="dj-hero"><div><div className="eyebrow">AI DJ / WEB AUDIO</div><h1>気分の変化を、<br />次の小節へ。</h1><p>Jevに渡す判断を小さく保ち、音の所有権をブラウザに戻したPoCです。プロンプトは次の小節のメタデータ（ループ、パターン、強度）だけを選びます。</p></div><div className="dj-callout"><strong>ユーザー操作でのみ再生</strong><span>ページ表示では音を鳴らしません。Play後も音量は最大35%に制限され、Stop / Muteで即時停止できます。</span></div></section>
    <div className="dj-layout"><main>
      <section className="panel dj-console"><div className="section-title"><div><div className="eyebrow">SCENARIO</div><h2>小さな選曲ブース</h2></div><span className="badge">10 deterministic seeds</span></div><label className="dj-label">Scenario<select value={scenarioId} onChange={e => changeScenario(e.target.value)}>{DJ_SCENARIOS.map(item => <option key={item.id} value={item.id}>{item.id} · {item.title}</option>)}</select></label><label className="dj-label">Mood / direction<textarea aria-label="Mood prompt" value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} maxLength={160} /></label><p className="muted">変更は即時に音を切り替えず、次の bar 境界でだけ反映します。非同期の古い判断は世代番号で破棄します。</p><div className="dj-controls"><button className="primary" onClick={() => void startPlayback()} disabled={status === 'playing'}>{status === 'playing' ? 'Playing…' : '▶ Play'}</button><button className="secondary" onClick={stopPlayback}>■ Stop</button><button className="secondary" onClick={() => changeScenario(scenario.id)}>↻ Reset</button><button className={`secondary ${muted ? 'muted-on' : ''}`} onClick={() => setMuted(value => !value)} aria-pressed={muted}>{muted ? '🔇 Unmute' : '🔊 Mute'}</button><Link className="secondary" href="/pocs/ai-dj/eval">Run evaluation</Link><label className="volume">Volume <input aria-label="Volume" type="range" min="0" max={MAX_VOLUME} step="0.01" value={volume} onChange={e => setVolume(Number(e.target.value))} /><span>{Math.round(volume / MAX_VOLUME * 100)}% / max 35%</span></label></div></section>
      <section className="panel dj-now"><div className="dj-now-head"><div><div className="eyebrow">NOW SELECTING</div><h2>{decision.loop.label}</h2><p>{decision.reason}</p></div><span className={`dj-status ${audioMode === 'visual-fallback' ? 'fallback' : status}`}>{status === 'playing' && audioMode === 'visual-fallback' ? 'VISUAL FALLBACK' : status === 'playing' ? 'LIVE' : 'READY'}</span></div><div className="dj-visual" aria-label="AI DJ visualizer"><div className="dj-orbit orbit-a" /><div className="dj-orbit orbit-b" /><div className="dj-core" style={{ transform: `scale(${decision.loop.energy === 'high' ? 1.18 : decision.loop.energy === 'low' ? .82 : 1})` }}><span>{decision.loop.pattern}</span><strong>{decision.loop.bpm}</strong><small>BPM</small></div><div className="dj-bars">{Array.from({ length: 16 }, (_, index) => <i key={index} style={{ animationDelay: `${index * -0.08}s`, height: `${20 + ((index * 17 + bar * 9) % 65)}%` }} />)}</div></div><div className="dj-meta"><div><small>BAR</small><strong>{bar} / {MAX_DECISIONS}</strong></div><div><small>ENERGY</small><strong>{decision.loop.energy}</strong></div><div><small>MODE</small><strong>{audioMode === 'not-started' ? 'waiting for Play' : audioMode}</strong></div><div><small>SOURCE</small><strong>original synth</strong></div></div>{replayed && <p className="notice">Trace replayed visually. Replayは音声を自動再生しません。</p>}</section>
      <section className="panel"><div className="section-title"><div><div className="eyebrow">DECISION TRACE</div><h2>プロンプト → 選択 → 小節</h2></div><button className="secondary" onClick={replayTrace} disabled={!trace.events.length}>Replay trace</button></div>{decisions.length === 0 ? <p className="muted">Playすると、各barで使われた入力と選択がここに記録されます。</p> : <div className="dj-trace">{decisions.slice().reverse().map(item => <div className="dj-trace-row" key={item.decisionId}><b>#{item.bar}</b><span>{item.prompt}</span><strong>{item.loop.label}</strong><em>{item.loop.pattern} · {item.loop.energy}</em></div>)}</div>}</section>
    </main><aside className="dj-side"><section className="panel"><h2>Comparison metrics</h2><div className="metric"><span>Decision count</span><b>{metrics.decisionCount} / {MAX_DECISIONS}</b></div><div className="metric"><span>Bars rendered</span><b>{metrics.barsRendered}</b></div><div className="metric"><span>Prompt changes</span><b>{metrics.promptChanges}</b></div><div className="metric"><span>Latency</span><b>unavailable</b></div><div className="metric"><span>Cost</span><b>unavailable</b></div><p className="muted">外部APIを呼ばないため、usage / cost / provider latencyは測定対象外です。比較時は同じseed・同じbar数を使います。</p></section><section className="panel safety"><h2>Guardrails</h2><ul><li>Playは明示操作後のみ</li><li>最大24 decisions / run</li><li>音量上限 35%</li><li>Stop・Mute・reset対応</li><li>Promptは160文字まで</li><li>async stale decisionは破棄</li></ul></section><section className="panel disclosure"><h2>Source & license</h2><p>音はWeb Audio APIのOscillatorNodeで実行時に合成する、オリジナルの短い波形パターンです。第三者の音源・学習済み音声・外部API・永続化されたキーは使いません。</p><p className="muted">JEV接続は未実装。既存のlive設定を暗黙に使用しません。</p></section></aside></div>
  </div>;
}
