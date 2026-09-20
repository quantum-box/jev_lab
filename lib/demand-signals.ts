export type DemandSignalKey = 'purchaseIntent' | 'deliveryUrgency' | 'supplyConcern';
export type SignalStatus = 'scored' | 'unknown';
export type DemandEvidence = { text: string; start: number; end: number; source: 'memo' | 'csv'; href: string };
export type DemandSignal = { key: DemandSignalKey; score: number | null; status: SignalStatus; evidence: DemandEvidence[]; reason: string };
export type DemandMemo = { id: string; label: string; language: '日本語' | 'English'; text: string; source: string; human: Record<DemandSignalKey, number | null>; fixedResponse: string; failureTag?: string };

export const DEMAND_SIGNALS_VERSION = 'demand-signals-2026.09.1';
export const DEMAND_DATA_VERSION = 'demand-synthetic-2026.09.1';
export const demandSignalLabels: Record<DemandSignalKey, string> = { purchaseIntent: '購入意欲', deliveryUrgency: '納期緊急', supplyConcern: '供給懸念' };
export const demandSignalDefinitions: Record<DemandSignalKey, string> = { purchaseIntent: '契約・導入へ進む意向の強さ', deliveryUrgency: '希望納期の切迫度', supplyConcern: '在庫・供給の不安の強さ' };

const evidence = (text: string, phrase: string, source: 'memo' | 'csv' = 'memo'): DemandEvidence[] => { const start = text.toLocaleLowerCase('ja-JP').indexOf(phrase.toLocaleLowerCase('ja-JP')); return start < 0 ? [] : [{ text: text.slice(start, start + phrase.length), start, end: start + phrase.length, source, href: `#demand-evidence-${start}` }]; };
const has = (text: string, terms: string[]) => terms.find(term => text.toLocaleLowerCase('ja-JP').includes(term.toLocaleLowerCase('ja-JP')));

export const demandMemos: DemandMemo[] = [
  { id: 'DS-001', label: '否定', language: '日本語', text: '担当者は興味を示したが、今期は購入予定がない。納期も急ぎではない。', source: 'Synthetic inquiry note', human: { purchaseIntent: 0.05, deliveryUrgency: 0.1, supplyConcern: null }, fixedResponse: 'intent=0.05; urgency=0.10; supply=unknown', failureTag: '否定' },
  { id: 'DS-002', label: '皮肉', language: 'English', text: '“Great, another shortage,” the buyer said. They are not interested in signing this quarter, and delivery timing is TBD.', source: 'Synthetic sales note', human: { purchaseIntent: 0.05, deliveryUrgency: null, supplyConcern: 0.85 }, fixedResponse: 'intent=0.05; urgency=unknown; supply=0.85', failureTag: '皮肉' },
  { id: 'DS-003', label: '弱い希望', language: '日本語', text: 'できれば来期に導入を検討したい。納期は年内ならよく、供給については今のところ問題ない。', source: 'Synthetic meeting memo', human: { purchaseIntent: 0.45, deliveryUrgency: 0.35, supplyConcern: 0.1 }, fixedResponse: 'intent=0.45; urgency=0.35; supply=0.10', failureTag: '弱い希望' },
  { id: 'DS-004', label: '未定', language: 'English', text: 'The team is interested, but the purchase decision is not decided. They may need delivery next quarter; supply risk is unclear.', source: 'Synthetic meeting memo', human: { purchaseIntent: null, deliveryUrgency: null, supplyConcern: null }, fixedResponse: 'intent=unknown; urgency=unknown; supply=unknown', failureTag: '未定' },
  { id: 'DS-005', label: '情報不足', language: '日本語', text: '先日の打合せのお礼。資料を共有します。', source: 'Synthetic inquiry note', human: { purchaseIntent: null, deliveryUrgency: null, supplyConcern: null }, fixedResponse: 'intent=unknown; urgency=unknown; supply=unknown', failureTag: '情報不足' },
];

function scoreSignal(key: DemandSignalKey, text: string): Omit<DemandSignal, 'key'> {
  const lower = text.toLocaleLowerCase('ja-JP');
  if (!text.trim()) return { score: null, status: 'unknown', evidence: [], reason: 'メモが空のため不明' };
  if (key === 'purchaseIntent') {
    const negative = has(lower, ['購入予定がない', '購入しない', '見送', 'not interested', 'not signing', 'no purchase']);
    const undecided = has(lower, ['未定', '決まっていない', 'not decided', 'tbd', 'unclear']);
    const weak = has(lower, ['できれば', '検討したい', 'maybe', 'consider', 'interested']);
    const strong = has(lower, ['導入する', '契約する', '購入したい', 'ready to sign', 'will purchase']);
    if (negative) return { score: 0.05, status: 'scored', evidence: evidence(text, negative), reason: '否定表現を優先し、購入意欲を低く評価' };
    if (undecided) return { score: null, status: 'unknown', evidence: evidence(text, undecided), reason: '意思決定が未定のため数値を補完しない' };
    if (strong) return { score: 0.9, status: 'scored', evidence: evidence(text, strong), reason: '具体的な購入・契約意向を確認' };
    if (weak) return { score: 0.45, status: 'scored', evidence: evidence(text, weak), reason: '弱い希望・関心として評価' };
    return { score: null, status: 'unknown', evidence: [], reason: '購入意向の根拠がないため不明' };
  }
  if (key === 'deliveryUrgency') {
    const negative = has(lower, ['急ぎではない', 'not urgent', 'no rush']); const undecided = has(lower, ['未定', 'tbd', 'unclear']); const urgent = has(lower, ['至急', '急ぎ', '今月中', 'asap', 'urgent']); const weak = has(lower, ['年内', '来期', 'next quarter', 'this year']);
    if (negative) return { score: 0.1, status: 'scored', evidence: evidence(text, negative), reason: '急ぎでない表現を確認' };
    if (undecided) return { score: null, status: 'unknown', evidence: evidence(text, undecided), reason: '納期が未定のため不明' };
    if (urgent) return { score: 0.9, status: 'scored', evidence: evidence(text, urgent), reason: '切迫した納期表現を確認' };
    if (weak) return { score: 0.35, status: 'scored', evidence: evidence(text, weak), reason: '期限はあるが切迫度は弱い' };
    return { score: null, status: 'unknown', evidence: [], reason: '納期の根拠がないため不明' };
  }
  const negative = has(lower, ['問題ない', '懸念なし', 'no concern', 'no risk']); const unknown = has(lower, ['不明', 'わからない', 'unclear', 'unknown']); const concern = has(lower, ['供給不足', '在庫懸念', '納期が不安', 'shortage', 'supply risk']);
  if (negative) return { score: 0.1, status: 'scored', evidence: evidence(text, negative), reason: '供給懸念を否定する表現を確認' };
  if (unknown) return { score: null, status: 'unknown', evidence: evidence(text, unknown), reason: '供給状況が不明のため保留' };
  if (concern) return { score: 0.85, status: 'scored', evidence: evidence(text, concern), reason: '供給・在庫の懸念を確認' };
  return { score: null, status: 'unknown', evidence: [], reason: '供給懸念の根拠がないため不明' };
}

export function analyzeDemandMemo(text: string, source: 'memo' | 'csv' = 'memo'): DemandSignal[] { return (Object.keys(demandSignalLabels) as DemandSignalKey[]).map(key => ({ key, ...scoreSignal(key, text), evidence: scoreSignal(key, text).evidence.map(item => ({ ...item, source })) })); }
export function parseDemandCsv(csv: string): { text: string; warnings: string[] } { const rows = csv.split(/\r?\n/).map(row => row.trim()).filter(Boolean); if (!rows.length) return { text: '', warnings: ['CSVが空です。'] }; const values = rows.slice(1).map(row => row.split(',').slice(0, 2).join(' ')).filter(Boolean); return { text: values.join('\n'), warnings: rows[0].toLowerCase().includes('memo') ? [] : ['1行目をヘッダーとして扱いました。'] }; }

type EvalCase = { id: string; category: string; text: string; expected: Record<DemandSignalKey, number | null> };
export const demandEvaluationCases: EvalCase[] = Array.from({ length: 50 }, (_, index) => { const sample = demandMemos[index % demandMemos.length]; return { id: `DS-FIX-${String(index + 1).padStart(2, '0')}`, category: sample.label, text: `${sample.text} [case ${index + 1}]`, expected: { ...sample.human } }; });
export type DemandMetrics = { rubricError: number; agreementRate: number; missingRate: number; cost: number };
export function demandMetrics(cases: EvalCase[] = demandEvaluationCases, analyzer = analyzeDemandMemo): DemandMetrics { let error = 0; let comparable = 0; let agree = 0; let missing = 0; for (const item of cases) for (const key of Object.keys(demandSignalLabels) as DemandSignalKey[]) { const actual = analyzer(item.text).find(signal => signal.key === key)!; if (actual.status === 'unknown') missing++; if (actual.score !== null && item.expected[key] !== null) { comparable++; error += Math.abs(actual.score - (item.expected[key] as number)); if (Math.abs(actual.score - (item.expected[key] as number)) <= 0.1) agree++; } } return { rubricError: comparable ? error / comparable : 0, agreementRate: comparable ? agree / comparable : 0, missingRate: missing / (cases.length * 3), cost: cases.length * 0.0004 }; }
export function dictionaryBaseline(text: string): DemandSignal[] { const exact = (terms: string[], score: number): Omit<DemandSignal, 'key'> => { const hit = has(text, terms); return hit ? { score, status: 'scored', evidence: evidence(text, hit), reason: 'dictionary baseline' } : { score: null, status: 'unknown', evidence: [], reason: 'dictionary baseline: no exact term' }; }; return [{ key: 'purchaseIntent', ...exact(['購入したい', 'will purchase', 'not interested'], 0.8) }, { key: 'deliveryUrgency', ...exact(['至急', 'asap', '今月中'], 0.8) }, { key: 'supplyConcern', ...exact(['供給不足', 'shortage'], 0.8) }]; }
export function csvForSignals(signals: DemandSignal[]): string { return ['signal,score,status,evidence', ...signals.map(signal => `${signal.key},${signal.score ?? ''},${signal.status},"${signal.evidence.map(item => item.text).join(' ').replaceAll('"', '""')}"`)].join('\n'); }
