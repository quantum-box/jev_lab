export type CompanyProfile = 'standard' | 'studio';
export type CategorizerMode = 'baseline' | 'replay' | 'jev';
export type CategorizationStatus = 'matched' | 'needs-review' | 'unmatched';

export type Transaction = { id: string; date: string; description: string; amount: number };
export type AccountCandidate = { id: string; name: string; score: number; reason: string };
export type Categorization = {
  transactionId: string;
  mode: CategorizerMode;
  company: CompanyProfile;
  status: CategorizationStatus;
  accountId?: string;
  accountName?: string;
  candidates: AccountCandidate[];
  reason: string;
  sourceRule: string;
  rulesVersion: string;
};

export const ACCOUNT_RULES_VERSION = 'account-rules-2026.09.1';
export const accounts = [
  { id: '5100', name: '旅費交通費' },
  { id: '5200', name: '会議費' },
  { id: '5300', name: '通信費' },
  { id: '6100', name: '地代家賃' },
  { id: '6200', name: '消耗品費' },
  { id: '8100', name: '交際費' },
] as const;

const rules: Record<CompanyProfile, Array<{ rule: string; accountId: string; words: string[] }>> = {
  standard: [
    { rule: 'rent.v1', accountId: '6100', words: ['家賃', '賃借', 'オフィス', 'office', 'rent'] },
    { rule: 'travel.v1', accountId: '5100', words: ['交通', '電車', 'タクシー', 'travel', 'rail'] },
    { rule: 'meeting.v1', accountId: '5200', words: ['会議', 'meeting', 'conference'] },
    { rule: 'telecom.v1', accountId: '5300', words: ['通信', '携帯', 'internet', '電話'] },
    { rule: 'supplies.v1', accountId: '6200', words: ['文具', '備品', '消耗', 'supplies'] },
    { rule: 'entertainment.v1', accountId: '8100', words: ['交際', '接待', 'entertainment'] },
  ],
  studio: [
    { rule: 'studio.rent.v2', accountId: '6100', words: ['家賃', '賃借', 'スタジオ', 'studio', 'office', 'rent'] },
    { rule: 'studio.travel.v1', accountId: '5100', words: ['交通', '電車', 'タクシー', 'travel', 'rail'] },
    { rule: 'studio.meeting.v1', accountId: '5200', words: ['会議', 'meeting', 'conference'] },
    { rule: 'studio.supplies.v1', accountId: '6200', words: ['機材', '備品', '消耗', 'supplies'] },
    { rule: 'studio.telecom.v1', accountId: '5300', words: ['通信', '携帯', 'internet', '電話'] },
  ],
};

export const syntheticTransactions: Transaction[] = [
  { id: 'TX-1001', date: '2026-09-01', description: 'Office rent September', amount: 180000 },
  { id: 'TX-1002', date: '2026-09-02', description: '新幹線 東京-大阪 会議', amount: 14500 },
  { id: 'TX-1003', date: '2026-09-03', description: 'Cloud internet monthly', amount: 12800 },
  { id: 'TX-1004', date: '2026-09-04', description: '交通費か交際費か不明', amount: 9800 },
  { id: 'TX-1005', date: '2026-09-05', description: '未分類の支出', amount: 2700 },
];

export function validateTransaction(input: Transaction): string[] {
  const errors: string[] = [];
  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/i.test(input.id)) errors.push('取引IDの形式が不正です');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date))) errors.push('日付の形式が不正です');
  if (!input.description.trim() || input.description.length > 240) errors.push('摘要は1〜240文字で入力してください');
  if (!Number.isFinite(input.amount) || input.amount < 0 || input.amount > 1_000_000_000) errors.push('金額は0以上10億以下の数値で入力してください');
  return errors;
}

export function validAccountId(id: string): boolean { return /^\d{4}$/.test(id) && accounts.some(a => a.id === id); }

function candidatesFor(transaction: Transaction, company: CompanyProfile): { candidates: AccountCandidate[]; sourceRule: string } {
  const text = transaction.description.toLocaleLowerCase();
  const found = rules[company].flatMap(rule => {
    const hits = rule.words.filter(word => text.includes(word.toLocaleLowerCase())).length;
    return hits ? [{ id: rule.accountId, name: accounts.find(a => a.id === rule.accountId)!.name, score: Math.min(.99, .62 + hits * .16), reason: `摘要に「${rule.words.find(word => text.includes(word.toLocaleLowerCase()))}」` , sourceRule: rule.rule }] : [];
  });
  const deduped = [...new Map(found.map(candidate => [candidate.id, candidate])).values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return { candidates: deduped.slice(0, 3).map(({ sourceRule: _sourceRule, ...candidate }) => candidate), sourceRule: found[0]?.sourceRule ?? 'no-match.v1' };
}

export function categorizeTransaction(transaction: Transaction, company: CompanyProfile = 'standard', mode: CategorizerMode = 'replay'): Categorization {
  const errors = validateTransaction(transaction);
  if (errors.length) return { transactionId: transaction.id, mode, company, status: 'unmatched', candidates: [], reason: errors.join(' / '), sourceRule: 'validation.v1', rulesVersion: ACCOUNT_RULES_VERSION };
  const { candidates, sourceRule } = candidatesFor(transaction, company);
  const first = candidates[0];
  const ambiguous = candidates.length > 1 && candidates[0].score - candidates[1].score < .18;
  const status: CategorizationStatus = !first ? 'unmatched' : ambiguous || first.score < .78 ? 'needs-review' : 'matched';
  return { transactionId: transaction.id, mode, company, status, accountId: status === 'unmatched' ? undefined : first.id, accountName: status === 'unmatched' ? undefined : first.name, candidates, reason: !first ? '一致するルールがありません' : ambiguous ? '候補の差が小さいため確認が必要です' : first.reason, sourceRule, rulesVersion: ACCOUNT_RULES_VERSION };
}

export function compareCategorization(transaction: Transaction, company: CompanyProfile = 'standard') {
  const baseline = categorizeTransaction(transaction, company, 'baseline');
  const replay = categorizeTransaction(transaction, company, 'replay');
  const jev = categorizeTransaction(transaction, company, 'jev');
  return { baseline, replay, jev, consistent: replay.status === jev.status && replay.accountId === jev.accountId };
}

export type Correction = { transactionId: string; from?: string; to: string; reason: string; at: string };
export function replayCorrections(rows: Categorization[], corrections: Correction[]): Categorization[] {
  return rows.map(row => { const correction = corrections.find(item => item.transactionId === row.transactionId); if (!correction || !validAccountId(correction.to)) return row; const account = accounts.find(item => item.id === correction.to)!; return { ...row, status: 'matched', accountId: account.id, accountName: account.name, reason: `訂正を再生: ${correction.reason}` }; });
}
