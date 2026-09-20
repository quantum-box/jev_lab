export type RouteTarget = 'rules' | 'light' | 'high-performance' | 'human-review';
export type DataSensitivity = 'public' | 'internal' | 'restricted';
export type RequestProfile = {
  text: string;
  dataSensitivity?: DataSensitivity;
  estimatedTokens?: number;
  needsTools?: boolean;
};

export type Candidate = {
  id: string;
  label: string;
  capabilities: string[];
  constraints: string[];
  maxContext: number;
  supportsTools: boolean;
  dataClass: DataSensitivity;
  inputCostPer1k: number;
  outputCostPer1k: number;
  latencyMs: number;
};

export type RoutingCriteria = {
  longReasoningTokens: number;
  longReasoningWords: string[];
  sensitiveNeedsHuman: boolean;
  incompleteNeedsHuman: boolean;
  ambiguityNeedsHuman: boolean;
  maxLightTokens: number;
  maxLightCost: number;
  defaultRoute: RouteTarget;
};

export type JudgmentItem = {
  label: string;
  value: string;
  result: 'pass' | 'warn' | 'hold';
};

export type RoutingDecision = {
  target: RouteTarget;
  modelId?: string;
  modelLabel?: string;
  confidence: number;
  reason: string;
  flags: string[];
  estimatedCost: number;
  judgmentItems: JudgmentItem[];
};

export type ValidationIssue = { field: string; message: string };
export const MODEL_ROUTING_RULES_VERSION = 'routing-rules-2026.09.1';
export const MODEL_ROUTING_PRICE_BASIS = '仮単価: USD / 1K tokens（入力 $0.001〜0.015、出力 $0.004〜0.06）。実課金とは無関係。';

export const defaultCandidates: Candidate[] = [
  { id: 'rules-v1', label: 'ルール処理', capabilities: ['定型分類', '明確な制約'], constraints: ['no-sensitive-data', 'no-long-reasoning'], maxContext: 4000, supportsTools: false, dataClass: 'public', inputCostPer1k: 0, outputCostPer1k: 0, latencyMs: 5 },
  { id: 'light-v1', label: '軽量モデル', capabilities: ['要約', '短い分類', '一般的な抽出'], constraints: ['no-restricted-data'], maxContext: 16000, supportsTools: false, dataClass: 'internal', inputCostPer1k: 0.001, outputCostPer1k: 0.004, latencyMs: 350 },
  { id: 'high-v1', label: '高性能モデル', capabilities: ['長い推論', '複数条件比較', 'ツール利用'], constraints: ['no-restricted-data'], maxContext: 128000, supportsTools: true, dataClass: 'internal', inputCostPer1k: 0.015, outputCostPer1k: 0.06, latencyMs: 1600 },
  { id: 'human-review', label: '人への確認', capabilities: ['機密判断', '情報不足の確認', '高リスク判断'], constraints: ['no-automatic-decision'], maxContext: 0, supportsTools: false, dataClass: 'restricted', inputCostPer1k: 0, outputCostPer1k: 0, latencyMs: 14400000 },
];

export const defaultCriteria: RoutingCriteria = {
  longReasoningTokens: 1600,
  longReasoningWords: ['比較', '設計', '多段', '深く', '検証', 'plan', 'trade-off'],
  sensitiveNeedsHuman: true,
  incompleteNeedsHuman: true,
  ambiguityNeedsHuman: true,
  maxLightTokens: 900,
  maxLightCost: 0.02,
  defaultRoute: 'light',
};

export function validateCandidates(candidates: Candidate[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.id.trim()) issues.push({ field: 'id', message: '候補IDは必須です。' });
    if (ids.has(candidate.id)) issues.push({ field: candidate.id, message: '候補IDが重複しています。' });
    ids.add(candidate.id);
    if (!candidate.label.trim()) issues.push({ field: candidate.id, message: '表示名は必須です。' });
    if (!candidate.capabilities.length) issues.push({ field: candidate.id, message: '候補能力を1つ以上指定してください。' });
    if (candidate.maxContext < 0 || !Number.isFinite(candidate.maxContext)) issues.push({ field: candidate.id, message: '最大コンテキストが不正です。' });
    if (candidate.inputCostPer1k < 0 || candidate.outputCostPer1k < 0 || !Number.isFinite(candidate.inputCostPer1k + candidate.outputCostPer1k)) issues.push({ field: candidate.id, message: '単価は0以上の数値にしてください。' });
    if (candidate.latencyMs < 0 || !Number.isFinite(candidate.latencyMs)) issues.push({ field: candidate.id, message: '遅延は0以上の数値にしてください。' });
    const constraints = new Set(candidate.constraints);
    if (constraints.has('requires-tools') && !candidate.supportsTools) issues.push({ field: candidate.id, message: '矛盾した制約: requires-tools なのにツール能力がありません。' });
    if (constraints.has('requires-long-context') && candidate.maxContext < 16000) issues.push({ field: candidate.id, message: '矛盾した制約: requires-long-context には16K以上が必要です。' });
    if (constraints.has('requires-restricted-data') && candidate.dataClass !== 'restricted') issues.push({ field: candidate.id, message: '矛盾した制約: restrictedデータ対応を指定していますが、dataClassがrestrictedではありません。' });
    if (constraints.has('requires-restricted-data') && constraints.has('no-restricted-data')) issues.push({ field: candidate.id, message: '矛盾した制約: 機密データを要求しつつ拒否しています。' });
    if (candidate.id === 'rules-v1' && candidate.constraints.includes('requires-long-reasoning')) issues.push({ field: candidate.id, message: 'ルール処理に長い推論を要求できません。' });
  }
  return issues;
}

export function validateCriteria(criteria: RoutingCriteria): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (criteria.longReasoningTokens < 1 || !Number.isFinite(criteria.longReasoningTokens)) issues.push({ field: 'longReasoningTokens', message: '長い推論の閾値は1以上です。' });
  if (criteria.maxLightTokens < 1 || !Number.isFinite(criteria.maxLightTokens)) issues.push({ field: 'maxLightTokens', message: '軽量モデルの最大トークンは1以上です。' });
  if (criteria.maxLightCost < 0 || !Number.isFinite(criteria.maxLightCost)) issues.push({ field: 'maxLightCost', message: '軽量モデルの上限費用は0以上です。' });
  return issues;
}

const lower = (value: string) => value.toLocaleLowerCase('ja-JP');
const hasAny = (text: string, words: string[]) => words.some(word => lower(text).includes(lower(word)));
const routeRank: Record<RouteTarget, number> = { rules: 0, light: 1, 'high-performance': 2, 'human-review': 3 };

function candidateFor(target: RouteTarget, candidates: Candidate[]) {
  const aliases: Record<RouteTarget, string> = { rules: 'rules-v1', light: 'light-v1', 'high-performance': 'high-v1', 'human-review': 'human-review' };
  const capabilityHint = target === 'high-performance' ? '推論' : target === 'light' ? '要約' : target === 'human-review' ? '機密' : '定型';
  return candidates.find(candidate => candidate.id === aliases[target]) ?? candidates.find(candidate => candidate.capabilities.some(capability => lower(capability).includes(lower(capabilityHint))));
}

const defaultRouteReason: Record<RouteTarget, string> = {
  rules: '設定された既定経路としてルール処理を選択。',
  light: '設定された既定経路として軽量モデルを選択。',
  'high-performance': '設定された既定経路として高性能モデルを選択。',
  'human-review': '設定された既定経路として人への確認に保留。',
};
const estimateCandidateCost = (candidate: Candidate | undefined, tokens: number) => candidate ? ((tokens / 1000) * candidate.inputCostPer1k + (Math.max(80, Math.ceil(tokens * 0.25)) / 1000) * candidate.outputCostPer1k) : 0;

export function routeRequest(request: RequestProfile, candidates = defaultCandidates, criteria = defaultCriteria): RoutingDecision {
  const text = request.text.trim();
  const tokens = request.estimatedTokens ?? Math.max(20, Math.ceil(text.length * 1.5));
  const sensitive = request.dataSensitivity === 'restricted' || hasAny(text, ['機密', '秘密', '個人情報', 'secret', 'confidential']);
  const incomplete = hasAny(text, ['情報不足', '不明', 'わからない', '不足', 'unknown', 'missing']);
  const ambiguous = hasAny(text, ['曖昧', 'どちら', '迷う', '判断して', 'ambiguous']);
  const longReasoning = tokens >= criteria.longReasoningTokens || hasAny(text, criteria.longReasoningWords);
  const needsTools = request.needsTools || hasAny(text, ['ツール', '検索', 'API', '実行']);
  const items: JudgmentItem[] = [
    { label: '機密性', value: sensitive ? 'restricted' : request.dataSensitivity ?? 'public/internal', result: sensitive ? 'hold' : 'pass' },
    { label: '情報充足度', value: incomplete ? '不足' : '十分', result: incomplete ? 'hold' : 'pass' },
    { label: '曖昧さ', value: ambiguous ? 'あり' : 'なし', result: ambiguous ? 'warn' : 'pass' },
    { label: '推論負荷', value: longReasoning ? `long (${tokens} tokens)` : `short (${tokens} tokens)`, result: longReasoning ? 'warn' : 'pass' },
    { label: 'ツール要求', value: needsTools ? 'あり' : 'なし', result: needsTools ? 'warn' : 'pass' },
  ];
  let target: RouteTarget = criteria.defaultRoute;
  const flags: string[] = [];
  let reason = defaultRouteReason[target];
  if (sensitive && criteria.sensitiveNeedsHuman) { target = 'human-review'; flags.push('機密'); reason = '機密性のある入力は自動モデルへ渡さず、人への確認に保留。'; }
  else if (incomplete && criteria.incompleteNeedsHuman) { target = 'human-review'; flags.push('情報不足'); reason = '不足情報を推測で補わず、人への確認に保留。'; }
  else if (ambiguous && criteria.ambiguityNeedsHuman) { target = 'human-review'; flags.push('曖昧'); reason = '解釈が複数あるため、人への確認に保留。'; }
  else if (!longReasoning && !needsTools && tokens <= criteria.maxLightTokens && hasAny(text, ['定型', '請求', '分類', '抽出', '一覧', 'summarize'])) { target = 'rules'; reason = '定型入力で制約が明確なため、ルール処理を選択。'; }
  else if (longReasoning || needsTools || tokens > criteria.maxLightTokens) { target = 'high-performance'; flags.push(longReasoning ? '長い推論' : 'ツール/文脈'); reason = '長い推論、ツール、または文脈量が軽量モデルの範囲を超えるため、高性能モデルを選択。'; }
  let candidate = candidateFor(target, candidates);
  if (target === 'light' && estimateCandidateCost(candidate, tokens) > criteria.maxLightCost) {
    target = 'high-performance'; flags.push('軽量費用上限'); reason = '軽量モデルの見積費用が設定上限を超えるため、高性能モデルへ振り分け。'; candidate = candidateFor(target, candidates);
  }
  if (needsTools && target !== 'human-review' && !candidate?.supportsTools) {
    target = 'human-review'; flags.push('ツール能力不足'); reason = '選択候補が要求されたツール能力を持たないため、人への確認に保留。'; candidate = candidateFor(target, candidates);
  }
  const estimatedCost = estimateCandidateCost(candidate, tokens);
  const confidence = target === 'human-review' ? 0.98 : target === 'rules' ? 0.94 : target === 'high-performance' ? 0.86 : 0.82;
  return { target, modelId: candidate?.id, modelLabel: candidate?.label, confidence, reason, flags, estimatedCost, judgmentItems: items };
}

export type FixedRoutingCase = { id: string; label: string; input: RequestProfile; expected: RouteTarget; fixedResponse: string; failure?: string };
export const fixedRoutingCases: FixedRoutingCase[] = [
  { id: 'template-01', label: '定型分類', input: { text: '定型の請求書を分類する', estimatedTokens: 150 }, expected: 'rules', fixedResponse: 'route=rules-v1; confidence=0.94' },
  { id: 'ambiguous-01', label: '曖昧な依頼', input: { text: 'この申請はどちらの扱いか判断して', estimatedTokens: 130 }, expected: 'human-review', fixedResponse: 'route=human-review; reason=曖昧' },
  { id: 'reasoning-01', label: '長い推論', input: { text: '複数案のtrade-offを比較し、深く設計して', estimatedTokens: 5000 }, expected: 'high-performance', fixedResponse: 'route=high-v1; confidence=0.86' },
  { id: 'sensitive-01', label: '機密情報', input: { text: '機密の個人情報を含む申請を確認', dataSensitivity: 'restricted', estimatedTokens: 300 }, expected: 'human-review', fixedResponse: 'route=human-review; reason=機密' },
  { id: 'incomplete-01', label: '情報不足', input: { text: '情報不足なので適切なモデルを選んで', estimatedTokens: 200 }, expected: 'human-review', fixedResponse: 'route=human-review; reason=情報不足' },
];

type EvalCategory = '定型' | '曖昧' | '長い推論' | '機密' | '情報不足';
export type RoutingEvaluationCase = { id: string; category: EvalCategory; input: RequestProfile; expected: RouteTarget };
const evalSeed: Array<[EvalCategory, RequestProfile, RouteTarget]> = [
  ['定型', { text: '定型の請求書を分類する' }, 'rules'], ['定型', { text: '定型データを抽出する' }, 'rules'],
  ['曖昧', { text: '曖昧な申請を判断して' }, 'human-review'], ['曖昧', { text: 'どちらを選ぶか迷う' }, 'human-review'],
  ['長い推論', { text: '複数案のtrade-offを比較する', estimatedTokens: 2500 }, 'high-performance'], ['長い推論', { text: '多段の設計を検証する', estimatedTokens: 3000 }, 'high-performance'],
  ['機密', { text: '機密情報を含む申請', dataSensitivity: 'restricted' }, 'human-review'], ['機密', { text: 'secret dataの処理', estimatedTokens: 300 }, 'human-review'],
  ['情報不足', { text: '情報不足のため判断して' }, 'human-review'], ['情報不足', { text: 'missing contextで選んで' }, 'human-review'],
];
export const routingEvaluationCases: RoutingEvaluationCase[] = Array.from({ length: 50 }, (_, index) => {
  const [category, input, expected] = evalSeed[index % evalSeed.length];
  return { id: `routing-${String(index + 1).padStart(2, '0')}`, category, input: { ...input, text: `${input.text} #${index + 1}` }, expected };
});

export type RoutingMetrics = { accuracy: number; underRoutingRate: number; overRoutingRate: number; holdRate: number; decisionCost: number };
export function routingMetrics(cases: RoutingEvaluationCase[], route = routeRequest): RoutingMetrics {
  const decisions = cases.map(item => ({ item, decision: route(item.input) }));
  const correct = decisions.filter(({ item, decision }) => decision.target === item.expected).length;
  const under = decisions.filter(({ item, decision }) => routeRank[decision.target] < routeRank[item.expected]).length;
  const over = decisions.filter(({ item, decision }) => routeRank[decision.target] > routeRank[item.expected]).length;
  return { accuracy: correct / cases.length, underRoutingRate: under / cases.length, overRoutingRate: over / cases.length, holdRate: decisions.filter(({ decision }) => decision.target === 'human-review').length / cases.length, decisionCost: decisions.reduce((sum, item) => sum + item.decision.estimatedCost, 0) };
}
export function ruleBaseline(request: RequestProfile): RoutingDecision {
  const sensitive = request.dataSensitivity === 'restricted' || hasAny(request.text, ['機密', '秘密', '個人情報', 'secret', 'confidential']);
  return routeRequest({ ...request, text: sensitive ? request.text : '定型 ' + request.text, estimatedTokens: Math.min(request.estimatedTokens ?? 200, 500) }, defaultCandidates, { ...defaultCriteria, sensitiveNeedsHuman: true, incompleteNeedsHuman: false, ambiguityNeedsHuman: false, longReasoningTokens: 999999 });
}
export function compareRouting(cases = routingEvaluationCases) { return { jev: routingMetrics(cases), baseline: routingMetrics(cases, ruleBaseline) }; }
