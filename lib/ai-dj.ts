/**
 * Deterministic, asset-free AI DJ decision model.
 *
 * The model only selects metadata. The UI owns playback and is responsible for
 * asking for an AudioContext from an explicit user gesture. No audio is
 * generated, decoded, or uploaded here.
 */
export type DjEnergy = 'low' | 'mid' | 'high';
export type DjPattern = 'pulse' | 'swing' | 'break' | 'ambient';
export type DjLoop = {
  id: string;
  label: string;
  bpm: number;
  pattern: DjPattern;
  energy: DjEnergy;
  source: 'owned-web-audio';
  license: 'original-synth';
};

export type DjScenario = {
  id: string;
  seed: number;
  title: string;
  prompt: string;
  targetEnergy: DjEnergy;
};

export type DjDecision = {
  bar: number;
  prompt: string;
  loop: DjLoop;
  reason: string;
  decisionId: string;
};

export type DjTraceEvent =
  | { type: 'prompt'; bar: number; prompt: string }
  | { type: 'decision'; bar: number; decision: DjDecision }
  | { type: 'bar'; bar: number; loopId: string };

export type DjTrace = {
  schema: 'jev-ai-dj-trace';
  version: 1;
  seed: number;
  events: DjTraceEvent[];
};

export const DJ_LOOPS: readonly DjLoop[] = [
  { id: 'mist-pulse', label: 'Mist Pulse', bpm: 88, pattern: 'ambient', energy: 'low', source: 'owned-web-audio', license: 'original-synth' },
  { id: 'soft-swing', label: 'Soft Swing', bpm: 102, pattern: 'swing', energy: 'low', source: 'owned-web-audio', license: 'original-synth' },
  { id: 'daybreak', label: 'Daybreak', bpm: 112, pattern: 'pulse', energy: 'mid', source: 'owned-web-audio', license: 'original-synth' },
  { id: 'neon-walk', label: 'Neon Walk', bpm: 120, pattern: 'pulse', energy: 'mid', source: 'owned-web-audio', license: 'original-synth' },
  { id: 'paper-cranes', label: 'Paper Cranes', bpm: 96, pattern: 'break', energy: 'mid', source: 'owned-web-audio', license: 'original-synth' },
  { id: 'night-drive', label: 'Night Drive', bpm: 128, pattern: 'swing', energy: 'high', source: 'owned-web-audio', license: 'original-synth' },
  { id: 'bright-room', label: 'Bright Room', bpm: 132, pattern: 'pulse', energy: 'high', source: 'owned-web-audio', license: 'original-synth' },
];

export const DJ_SCENARIOS: readonly DjScenario[] = [
  { id: 'seed-01', seed: 489101, title: 'First light', prompt: '朝の静かな集中', targetEnergy: 'low' },
  { id: 'seed-02', seed: 489102, title: 'Open desk', prompt: '作業に集中、少しだけ前向きに', targetEnergy: 'mid' },
  { id: 'seed-03', seed: 489103, title: 'Deep work', prompt: '深い作業。変化は控えめに', targetEnergy: 'low' },
  { id: 'seed-04', seed: 489104, title: 'Team warm-up', prompt: 'チームの始まり、軽やかに', targetEnergy: 'mid' },
  { id: 'seed-05', seed: 489105, title: 'Afternoon lift', prompt: '午後、少し元気を出したい', targetEnergy: 'mid' },
  { id: 'seed-06', seed: 489106, title: 'Commute', prompt: '夜の移動、街の光', targetEnergy: 'high' },
  { id: 'seed-07', seed: 489107, title: 'Reset', prompt: '気分を落ち着けてリセット', targetEnergy: 'low' },
  { id: 'seed-08', seed: 489108, title: 'Sprint', prompt: '短いスプリントを走り切る', targetEnergy: 'high' },
  { id: 'seed-09', seed: 489109, title: 'Late notes', prompt: '夜のメモ、余白を残す', targetEnergy: 'low' },
  { id: 'seed-10', seed: 489110, title: 'Free play', prompt: 'おまかせ、自然な流れで', targetEnergy: 'mid' },
];

const clampPrompt = (prompt: string) => prompt.trim().slice(0, 160) || 'おまかせ、自然な流れで';
const hash = (value: string) => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
};

function requestedEnergy(prompt: string): DjEnergy | null {
  const p = prompt.toLowerCase();
  if (/静|落ち着|集中|余白|calm|focus|quiet|soft/.test(p)) return 'low';
  if (/元気|走|強|夜|高|energy|bright|sprint|drive/.test(p)) return 'high';
  if (/軽|前向|自然|作業|warm|flow|work/.test(p)) return 'mid';
  return null;
}

const energyDistance = (a: DjEnergy, b: DjEnergy) => Math.abs(['low', 'mid', 'high'].indexOf(a) - ['low', 'mid', 'high'].indexOf(b));

export function selectDjLoop(seed: number, promptInput: string, bar: number): DjDecision {
  const prompt = clampPrompt(promptInput);
  const requested = requestedEnergy(prompt);
  const target = requested ?? DJ_SCENARIOS.find(s => s.seed === seed)?.targetEnergy ?? 'mid';
  const ranked = DJ_LOOPS.map((loop, index) => ({ loop, index, score: energyDistance(loop.energy, target) * 10 + ((hash(`${seed}:${bar}:${prompt}:${loop.id}`) % 997) / 1000) }))
    .sort((a, b) => a.score - b.score);
  const loop = ranked[0].loop;
  const reason = requested ? `prompt→${requested} / bar ${bar}` : `seed→${target} / bar ${bar}`;
  return { bar, prompt, loop, reason, decisionId: `dj-${seed}-${bar}-${hash(prompt).toString(16)}` };
}

export function makeDjTrace(seed: number, prompts: readonly string[], bars = 8): DjTrace {
  const events: DjTraceEvent[] = [];
  let currentPrompt = prompts[0] ?? 'おまかせ、自然な流れで';
  for (let bar = 1; bar <= bars; bar += 1) {
    if (prompts[bar - 1] !== undefined) {
      const nextPrompt = clampPrompt(prompts[bar - 1]);
      if (nextPrompt !== clampPrompt(currentPrompt)) {
        currentPrompt = nextPrompt;
        events.push({ type: 'prompt', bar, prompt: currentPrompt });
      } else currentPrompt = nextPrompt;
    }
    const decision = selectDjLoop(seed, currentPrompt, bar);
    events.push({ type: 'decision', bar, decision });
    events.push({ type: 'bar', bar, loopId: decision.loop.id });
  }
  return { schema: 'jev-ai-dj-trace', version: 1, seed, events };
}

export function replayDjTrace(value: string | DjTrace): { state: DjDecision | null; events: DjTraceEvent[] } {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || parsed.schema !== 'jev-ai-dj-trace' || parsed.version !== 1 || !Number.isFinite(parsed.seed) || !Array.isArray(parsed.events) || parsed.events.length > 1000) throw new Error('Invalid AI DJ trace');
  const events = parsed.events as DjTraceEvent[];
  const decisions = events.filter((event): event is Extract<DjTraceEvent, { type: 'decision' }> => event.type === 'decision');
  return { state: decisions.at(-1)?.decision ?? null, events: structuredClone(events) };
}

export function comparisonMetrics(trace: DjTrace) {
  const decisions = trace.events.filter(event => event.type === 'decision');
  const bars = trace.events.filter(event => event.type === 'bar');
  return { decisionCount: decisions.length, barsRendered: bars.length, promptChanges: trace.events.filter(event => event.type === 'prompt').length, measuredLatencyMs: 'unavailable' as const, measuredCost: 'unavailable' as const };
}
