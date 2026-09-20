export type ValueKind = 'invoice-total' | 'payment-due';
export type CandidateKind = 'amount' | 'date';

export type ValueCandidate = {
  id: string;
  kind: CandidateKind;
  raw: string;
  normalized: string;
  start: number;
  end: number;
  label: string;
  currency?: string;
  valid: boolean;
};

export type Selection = {
  target: ValueKind;
  candidateId: string | null;
  status: 'selected' | 'unknown';
  value: string | null;
  raw: string | null;
  reason: string;
};

export type SelectionExample = {
  id: string;
  label: string;
  text: string;
  expectedTotal: string | null;
  expectedDue: string | null;
  fixedResponse: string;
};

export const VALUE_SELECTION_RULES_VERSION = 'value-selection-rules-2026.09.1';
export const VALUE_SELECTION_PRICE_BASIS = '仮単価: 抽出 $0.0000、候補選択 $0.0002 / 文書（USD）。実課金・会計登録とは無関係。';

const amountPattern = /[-−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;
const datePattern = /\d{4}(?:年|[./-])\d{1,2}(?:月|[./-])\d{1,2}日?/g;
const totalWords = ['請求総額', '請求額', '合計', 'total', 'amount due', 'grand total'];
const dueWords = ['支払期日', '支払期限', '支払日', 'due date', 'payment due', 'due'];
const currencyAt = (text: string, start: number, end: number) => {
  const window = text.slice(Math.max(0, start - 5), Math.min(text.length, end + 5));
  if (/[￥¥円]/.test(window)) return 'JPY';
  if (/\$|USD/i.test(window)) return 'USD';
  if (/€|EUR/i.test(window)) return 'EUR';
  if (/£|GBP/i.test(window)) return 'GBP';
  return undefined;
};
const contextLabel = (text: string, start: number, words: string[]) => {
  const lineStart = Math.max(text.lastIndexOf('\n', start), text.lastIndexOf('\r', start)) + 1;
  const context = text.slice(lineStart, start).toLocaleLowerCase('ja-JP');
  const matches = (word: string) => /[A-Za-z]/.test(word) ? new RegExp(`\\b${word}\\b`, 'i').test(context) : context.includes(word);
  return words.find(matches) ?? (context.trim().slice(-24) || '未ラベル');
};
const isAmountBoundary = (text: string, start: number, end: number) => {
  const previous = text[start - 1] ?? '';
  const next = text[end] ?? '';
  if (/[年月日./-]/.test(previous) || /[年月日./-]/.test(next)) return false;
  return !/[A-Za-z0-9ＯＯ]/.test(previous) && !/[A-Za-z0-9ＯＯ]/.test(next) && previous !== ',' && next !== ',';
};
function normalizeDate(raw: string) {
  const parts = raw.match(/\d{4}|\d{1,2}/g)?.map(Number) ?? [];
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
}
function normalizeAmount(raw: string, currency?: string) {
  const negative = /[-−]/.test(raw);
  const magnitude = Number(raw.replaceAll(',', '').replace(/[^\d.]/g, ''));
  const value = negative ? -magnitude : magnitude;
  if (!Number.isFinite(value)) return null;
  return `${currency ?? 'UNIT'} ${value.toFixed(2)}`;
}

export function extractValueCandidates(text: string): ValueCandidate[] {
  const candidates: ValueCandidate[] = [];
  amountPattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = amountPattern.exec(text))) {
    const prefix = text.slice(Math.max(0, match.index - 10), match.index);
    const signedCurrency = prefix.match(/[-−]\s*(?:USD|EUR|GBP|[$€£￥¥])\s*$/i)?.[0] ?? '';
    const start = match.index - signedCurrency.length;
    const sourceEnd = match.index + match[0].length;
    if (!isAmountBoundary(text, start, sourceEnd)) continue;
    const currency = currencyAt(text, start, sourceEnd);
    const raw = text.slice(start, sourceEnd);
    const normalized = normalizeAmount(raw, currency);
    if (normalized) candidates.push({ id: `amount-${candidates.filter(item => item.kind === 'amount').length + 1}`, kind: 'amount', raw, normalized, start, end: sourceEnd, currency, label: contextLabel(text, start, totalWords) || '未ラベル', valid: true });
  }
  datePattern.lastIndex = 0;
  while ((match = datePattern.exec(text))) {
    const start = match.index;
    const end = start + match[0].length;
    const normalized = normalizeDate(match[0]);
    candidates.push({ id: `date-${candidates.filter(item => item.kind === 'date').length + 1}`, kind: 'date', raw: match[0], normalized: normalized ?? match[0], start, end, label: contextLabel(text, start, dueWords), valid: Boolean(normalized) });
  }
  return candidates.sort((a, b) => a.start - b.start);
}

const includesWord = (value: string, words: string[]) => {
  const normalized = value.toLocaleLowerCase('ja-JP');
  return words.some(word => /[A-Za-z]/.test(word) ? new RegExp(`\\b${word}\\b`, 'i').test(normalized) : normalized.includes(word));
};
function matchingCandidates(candidates: ValueCandidate[], target: ValueKind) {
  const kind = target === 'invoice-total' ? 'amount' : 'date';
  const words = target === 'invoice-total' ? totalWords : dueWords;
  return candidates.filter(candidate => candidate.kind === kind && candidate.valid && includesWord(candidate.label, words));
}

export function selectByJev(candidates: ValueCandidate[], target: ValueKind): Selection {
  const matches = matchingCandidates(candidates, target);
  if (matches.length !== 1) return { target, candidateId: null, status: 'unknown', value: null, raw: null, reason: matches.length === 0 ? '該当ラベルの候補がないため不明。資料にない値は補完しない。' : '該当候補が複数あるため不明。日付/金額を勝手に決めない。' };
  const candidate = matches[0];
  return { target, candidateId: candidate.id, status: 'selected', value: candidate.normalized, raw: candidate.raw, reason: 'コード抽出済み候補の候補IDだけを固定応答で選択。値は候補からコピー。' };
}

export function copyAndNormalizeSelection(text: string, candidates: ValueCandidate[], selection: Selection): Selection {
  if (selection.candidateId === null) return selection;
  const candidate = candidates.find(item => item.id === selection.candidateId);
  if (!candidate || text.slice(candidate.start, candidate.end) !== candidate.raw) return { ...selection, status: 'unknown', candidateId: null, value: null, raw: null, reason: '候補IDまたは元文書の位置が不正なため拒否。' };
  if (!candidate.valid) return { ...selection, status: 'unknown', candidateId: null, value: null, raw: null, reason: '日付が暦として不正なため拒否。' };
  return { ...selection, value: candidate.normalized, raw: candidate.raw };
}

export function validateSelection(candidates: ValueCandidate[], selection: Selection): string[] {
  if (selection.candidateId === null) return [];
  const candidate = candidates.find(item => item.id === selection.candidateId);
  if (!candidate) return ['候補IDが候補一覧に存在しません。'];
  if (!candidate.valid) return ['不正な日付または値候補は選択できません。'];
  if (selection.target === 'payment-due' && candidate.kind !== 'date') return ['支払期日は日付候補のみ選択できます。'];
  if (selection.target === 'invoice-total' && candidate.kind !== 'amount') return ['請求総額は金額候補のみ選択できます。'];
  return [];
}

export const selectionExamples: SelectionExample[] = [
  { id: 'jpy-multiple-dates', label: 'JPY / 小計・税・合計', text: '請求書番号: JP-100\n発行日: 2026年09月01日\n支払期日: 2026年10月31日\n小計 ¥10,000\n消費税 ¥1,000\n請求総額 ¥11,000', expectedTotal: 'JPY 11000.00', expectedDue: '2026-10-31', fixedResponse: 'amount-3 / date-2' },
  { id: 'usd-negative', label: 'USD / 負数クレジット', text: 'Invoice date: 2026-09-05\nPayment due: 2026-09-30\nSubtotal USD 120.00\nCredit -USD 20.00\nTotal USD 100.00', expectedTotal: 'USD 100.00', expectedDue: '2026-09-30', fixedResponse: 'amount-3 / date-2' },
  { id: 'no-total', label: '請求総額なし', text: '小計 ¥8,000\n消費税 ¥800\n参考: 前回請求 ¥7,500\n支払期日: 2026年11月10日', expectedTotal: null, expectedDue: '2026-11-10', fixedResponse: 'unknown / date-1' },
  { id: 'ambiguous-due', label: '日付が曖昧', text: '発行日: 2026年09月01日\n支払期日: 2026年10月31日\n支払期日: 2026年11月15日\n請求総額 €90', expectedTotal: 'EUR 90.00', expectedDue: null, fixedResponse: 'amount-1 / unknown' },
  { id: 'ocr-like', label: 'OCR誤り風', text: '請求総額 ¥1O,000\n支払期日: 2026-12-01\n※ OCR文字 O を 0 と推測してはいけない', expectedTotal: null, expectedDue: '2026-12-01', fixedResponse: 'unknown / date-1' },
];

type EvalCategory = '複数通貨' | '負数' | '請求総額なし' | '日付曖昧' | 'OCR誤り風';
export type SelectionEvaluationCase = { id: string; category: EvalCategory; text: string; expectedTotal: string | null; expectedDue: string | null; totalPresent: boolean; duePresent: boolean };
export const selectionEvaluationCases: SelectionEvaluationCase[] = Array.from({ length: 50 }, (_, index) => {
  const example = selectionExamples[index % selectionExamples.length];
  return { id: `value-${String(index + 1).padStart(2, '0')}`, category: (['複数通貨', '負数', '請求総額なし', '日付曖昧', 'OCR誤り風'] as EvalCategory[])[index % 5], text: `${example.text}\ncase=${index + 1}`, expectedTotal: example.expectedTotal, expectedDue: example.expectedDue, totalPresent: example.expectedTotal !== null || example.id === 'ocr-like', duePresent: example.expectedDue !== null || example.id === 'ambiguous-due' };
});

export type SelectionMetrics = { selectionAccuracy: number; extractionMissRate: number; selectionMissRate: number; holdRate: number; cost: number };
export function selectionMetrics(cases: SelectionEvaluationCase[], selector = selectByJev): SelectionMetrics {
  let expected = 0; let extractedMisses = 0; let selectionMisses = 0; let holds = 0;
  for (const item of cases) {
    const candidates = extractValueCandidates(item.text);
    for (const [target, expectedValue, present] of [['invoice-total', item.expectedTotal, item.totalPresent], ['payment-due', item.expectedDue, item.duePresent] as const]) {
      if (!present) { holds++; continue; }
      expected++;
      const words = target === 'invoice-total' ? totalWords : dueWords;
      const kind = target === 'invoice-total' ? 'amount' : 'date';
      const labeled = candidates.filter(candidate => candidate.kind === kind && includesWord(candidate.label, words));
      const found = expectedValue !== null && candidates.some(candidate => candidate.normalized === expectedValue);
      if (!found) {
        if (expectedValue === null && labeled.length > 1) { holds++; continue; }
        extractedMisses++;
        continue;
      }
      const selected = selector(candidates, target as ValueKind);
      if (selected.status === 'unknown') { holds++; selectionMisses++; continue; }
      if (selected.value !== expectedValue) selectionMisses++;
    }
  }
  return { selectionAccuracy: expected ? (expected - extractedMisses - selectionMisses) / expected : 0, extractionMissRate: expected ? extractedMisses / expected : 0, selectionMissRate: expected ? selectionMisses / expected : 0, holdRate: cases.length ? holds / (cases.length * 2) : 0, cost: cases.length * 0.0002 };
}

export function labelNearBaseline(candidates: ValueCandidate[], target: ValueKind): Selection {
  const matches = matchingCandidates(candidates, target);
  if (matches.length === 0) return { target, candidateId: null, status: 'unknown', value: null, raw: null, reason: 'label baseline: no candidate' };
  const selected = target === 'invoice-total' ? matches.reduce((best, candidate) => Number(candidate.normalized.replace(/\D/g, '')) > Number(best.normalized.replace(/\D/g, '')) ? candidate : best) : matches[0];
  return { target, candidateId: selected.id, status: 'selected', value: selected.normalized, raw: selected.raw, reason: 'label-near baseline' };
}

export function compareSelection(cases = selectionEvaluationCases) {
  const jev = selectionMetrics(cases);
  const baseline = selectionMetrics(cases, labelNearBaseline);
  return { jev, baseline };
}
