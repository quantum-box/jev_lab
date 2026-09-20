/** Deterministic entity matching. Input records are data; no external lookup or write occurs. */
export type MatchStatus = 'match' | 'mismatch' | 'missing' | 'needs-review';
export type EntityRecord = { id?: string; name?: string; email?: string; phone?: string; address?: string };
export type FieldMatch = { field: keyof EntityRecord; left?: string; right?: string; status: MatchStatus; score: number; reason: string };
export type EntityPair = { id: string; label: string; left: EntityRecord; right: EntityRecord; expected: 'match' | 'non-match' | 'needs-review'; failure?: string };
export type MatchResult = { pair: EntityPair; fields: FieldMatch[]; overall: MatchStatus; score: number; cost: number };
export const ENTITY_MATCHING_VERSION = 'entity-matching-rules-2026.09.1';
export const ENTITY_MATCHING_DATA_VERSION = 'entity-pairs-50-v1';
export const ENTITY_MATCHING_CORRECTION_RULE = 'human-review-v1';

export const matchingExamples: EntityPair[] = [
  { id: 'EM-001', label: '完全一致', left: { id: 'C-100', name: 'Acme Japan', email: 'ops@acme.example', phone: '03-1000-0000' }, right: { id: 'C-100', name: 'Acme Japan', email: 'ops@acme.example', phone: '03-1000-0000' }, expected: 'match' },
  { id: 'EM-002', label: '表記ゆれ', left: { id: 'C-101', name: '株式会社 青空', email: 'info@aozora.example' }, right: { id: 'C-101', name: '青空株式会社', email: 'info@aozora.example' }, expected: 'match' },
  { id: 'EM-003', label: '項目不一致', left: { id: 'C-102', name: 'Northwind Ltd', email: 'north@wind.example' }, right: { id: 'C-202', name: 'Northwind Ltd', email: 'sales@wind.example' }, expected: 'non-match', failure: '同名だけで統合すると誤統合' },
  { id: 'EM-004', label: '不足項目', left: { name: '合同会社ひかり', address: '東京都港区' }, right: { name: '合同会社ひかり' }, expected: 'needs-review', failure: '識別子・連絡先がないため保留' },
  { id: 'EM-005', label: '電話のみ一致', left: { name: 'River Works', phone: '06-5555-1212' }, right: { name: 'Riverwork Inc.', phone: '06-5555-1212' }, expected: 'match' },
];

const fields: Array<keyof EntityRecord> = ['id', 'name', 'email', 'phone', 'address'];
const clean = (value?: string) => value?.toLocaleLowerCase('ja-JP').replace(/株式会社|合同会社|\s|[-().]/g, '') ?? '';
const similarity = (a: string, b: string) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  return shorter.length >= 3 && longer.includes(shorter) ? 0.8 : 0;
};

export function compareField(field: keyof EntityRecord, left?: string, right?: string, threshold = 0.75): FieldMatch {
  if (!left || !right) return { field, left, right, status: 'missing', score: 0, reason: '片側に値がないため自動統合しない' };
  const score = clean(left) === clean(right) ? 1 : similarity(clean(left), clean(right));
  if (score >= 1) return { field, left, right, status: 'match', score, reason: '正規化後に完全一致' };
  if (score >= threshold) return { field, left, right, status: 'needs-review', score, reason: '近似一致だが人確認が必要' };
  return { field, left, right, status: 'mismatch', score, reason: '正規化後も不一致' };
}

export function matchPair(pair: EntityPair, threshold = 0.75): MatchResult {
  const comparisons = fields.map(field => compareField(field, pair.left[field], pair.right[field], threshold));
  const present = comparisons.filter(item => item.status !== 'missing');
  const score = present.length ? present.reduce((sum, item) => sum + item.score, 0) / present.length : 0;
  const exactId = comparisons.find(item => item.field === 'id')?.status === 'match';
  const strongContact = comparisons.some(item => (item.field === 'email' || item.field === 'phone') && item.status === 'match');
  const hardMismatch = comparisons.some(item => item.status === 'mismatch' && ['id', 'email', 'phone'].includes(item.field));
  const missing = comparisons.some(item => item.status === 'missing');
  const overall: MatchStatus = hardMismatch ? 'mismatch' : exactId || strongContact || (score >= threshold && !missing) ? 'match' : missing || score >= threshold ? 'needs-review' : 'mismatch';
  return { pair, fields: comparisons, overall, score, cost: 0.0003 };
}

export function idBaseline(pair: EntityPair): MatchStatus {
  if (!pair.left.id || !pair.right.id) return 'needs-review';
  return pair.left.id === pair.right.id ? 'match' : 'mismatch';
}
export function stringBaseline(pair: EntityPair): MatchStatus {
  const left = clean(pair.left.name);
  const right = clean(pair.right.name);
  if (!left || !right) return 'needs-review';
  return left === right || similarity(left, right) >= 0.8 ? 'match' : 'mismatch';
}

export type MatchingMetrics = {
  total: number; threshold: number; falseMerge: number; missedMatch: number; needsReview: number; cost: number;
  precision: number; recall: number; baseline: { id: { falseMerge: number; missedMatch: number; needsReview: number; cost: number }; string: { falseMerge: number; missedMatch: number; needsReview: number; cost: number } };
};
function metricRows(pairs: EntityPair[], method: (pair: EntityPair) => MatchStatus) {
  const rows = pairs.map(pair => ({ expected: pair.expected, actual: method(pair) }));
  const falseMerge = rows.filter(row => row.expected === 'non-match' && row.actual === 'match').length;
  const missedMatch = rows.filter(row => row.expected === 'match' && row.actual !== 'match').length;
  const needsReview = rows.filter(row => row.actual === 'needs-review').length;
  const predictedMatches = rows.filter(row => row.actual === 'match').length;
  const trueMatches = rows.filter(row => row.expected === 'match' && row.actual === 'match').length;
  return { falseMerge, missedMatch, needsReview, precision: predictedMatches ? trueMatches / predictedMatches : 1, recall: rows.filter(row => row.expected === 'match').length ? trueMatches / rows.filter(row => row.expected === 'match').length : 1 };
}
export function matchingMetrics(pairs: EntityPair[] = matchingEvaluationPairs, threshold = 0.75): MatchingMetrics {
  const jev = metricRows(pairs, pair => matchPair(pair, threshold).overall);
  const id = metricRows(pairs, idBaseline);
  const string = metricRows(pairs, stringBaseline);
  return { total: pairs.length, threshold, falseMerge: jev.falseMerge, missedMatch: jev.missedMatch, needsReview: jev.needsReview, cost: pairs.length * 0.0003, precision: jev.precision, recall: jev.recall,
    baseline: { id: { ...id, cost: pairs.length * 0.00001 }, string: { ...string, cost: pairs.length * 0.00001 } } };
}

export type MatchingEvaluationPair = EntityPair & { category: string };
export const matchingEvaluationPairs: MatchingEvaluationPair[] = Array.from({ length: 50 }, (_, index) => {
  const base = matchingExamples[index % matchingExamples.length];
  return { ...base, id: 'PAIR-' + String(index + 1).padStart(3, '0'), category: base.label, left: { ...base.left }, right: { ...base.right } };
});
export const matchingFailureExamples = matchingExamples.filter(pair => pair.failure).map(pair => ({ pair, result: matchPair(pair), idBaseline: idBaseline(pair), stringBaseline: stringBaseline(pair) }));

export type StoredMatchingCorrections = { version: string; rule: string; corrections: Record<string, MatchStatus> };
export function parseMatchingCorrections(raw: string | null): Record<string, MatchStatus> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<StoredMatchingCorrections>;
    if (parsed.version !== ENTITY_MATCHING_VERSION || parsed.rule !== ENTITY_MATCHING_CORRECTION_RULE || !parsed.corrections || typeof parsed.corrections !== 'object') return {};
    const knownIds = new Set(matchingExamples.map(pair => pair.id)); const valid = new Set<MatchStatus>(['match', 'mismatch', 'needs-review']);
    return Object.fromEntries(Object.entries(parsed.corrections).filter(([id, status]) => knownIds.has(id) && valid.has(status as MatchStatus))) as Record<string, MatchStatus>;
  } catch { return {}; }
}
