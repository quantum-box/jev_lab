export const COLUMN_MAPPING_INPUT_VERSION = 'csv-column-mapping-input-1.0';
export const COLUMN_MAPPING_SCHEMA_VERSION = 'customer-import-schema-2026.09';
export const COLUMN_MAPPING_LIMITS = { maxBytes: 1_000_000, maxColumns: 64 } as const;

export type TargetType = 'string' | 'email' | 'integer' | 'date';
export type TargetField = { id: string; label: string; type: TargetType; required: boolean };
export const targetSchema: TargetField[] = [
  { id: 'customer_name', label: '顧客名', type: 'string', required: true },
  { id: 'email', label: 'メールアドレス', type: 'email', required: true },
  { id: 'signup_date', label: '登録日', type: 'date', required: true },
  { id: 'age', label: '年齢', type: 'integer', required: false },
  { id: 'notes', label: '備考', type: 'string', required: false },
];

export type MappingStatus = 'matched' | 'needs-review' | 'unmatched';
export type MappingCandidate = { source: string; target: string; score: number; reason: string };
export type MappingRow = { source: string; target?: string; status: MappingStatus; candidates: MappingCandidate[]; reason: string };
export type ParsedCsv = { headers: string[]; rows: string[][]; warnings: string[] };
export type MappingConfig = { inputVersion: string; schemaVersion: string; mappings: Record<string, string>; excludedColumns: string[]; generatedAt: string; safety: string[] };
export type EvaluationOutcome = 'matched' | 'needs-review' | 'unmatched';

export const interactionSamples = [
  { id: 'jp-basic', label: '日本語の顧客CSV', csv: '氏名,メール,登録日,年齢\n山田花子,hanako@example.com,2026-09-01,32\n佐藤健,ken@example.com,2026-09-03,41' },
  { id: 'english', label: '英語ヘッダー', csv: 'name,email,created_at,age,notes\nAva Chen,ava@example.com,2026-08-12,29,VIP' },
  { id: 'ambiguous', label: '候補が曖昧', csv: '氏名,連絡先,日付\n田中一郎,080-1234-5678,2026/09/10' },
  { id: 'unmatched', label: '未対応列あり', csv: '顧客名,mail,登録日,社内メモ,region\n鈴木, suzuki@example.com,2026-09-11,要確認,JP' },
  { id: 'quoted', label: '引用符・カンマ', csv: 'name,email,notes\n"Doe, Jane",jane@example.com,"Call, next week"' },
] as const;

function splitCsvLine(line: string): string[] { const values: string[] = []; let value = ''; let quoted = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') { if (quoted && line[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; } else if (c === ',' && !quoted) { values.push(value.trim()); value = ''; } else value += c; } values.push(value.trim()); return values; }
/** Split records while respecting quoted newlines (RFC 4180-style CSV). */
function splitCsvRecords(raw: string): { records: string[]; unclosedQuote: boolean } { const records: string[] = []; let record = ''; let quoted = false; for (let i = 0; i < raw.length; i++) { const c = raw[i]; if (c === '"') { record += c; if (quoted && raw[i + 1] === '"') { record += raw[++i]; } else quoted = !quoted; } else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && raw[i + 1] === '\n') i++; if (record.trim()) records.push(record); record = ''; } else record += c; } if (record.trim()) records.push(record); return { records, unclosedQuote: quoted }; }

export function validateCsvSource(raw: string): string[] { const warnings: string[] = []; const bytes = new TextEncoder().encode(raw).length; if (bytes > COLUMN_MAPPING_LIMITS.maxBytes) warnings.push(`source exceeds ${COLUMN_MAPPING_LIMITS.maxBytes.toLocaleString()} bytes`); if (raw.includes('\uFFFD')) warnings.push('encoding must be UTF-8 (replacement character detected)'); return warnings; }
export function parseCsv(raw: string): ParsedCsv { const warnings = validateCsvSource(raw); const { records, unclosedQuote } = splitCsvRecords(raw.replace(/^\uFEFF/, '')); if (unclosedQuote) warnings.push('unterminated quoted field'); if (!records.length) return { headers: [], rows: [], warnings: [...warnings, 'CSV is empty'] }; const headers = splitCsvLine(records[0]); if (headers.length > COLUMN_MAPPING_LIMITS.maxColumns) warnings.push(`too many columns (maximum ${COLUMN_MAPPING_LIMITS.maxColumns})`); const seen = new Set<string>(); headers.forEach((h, i) => { if (!h) warnings.push(`empty column header at ${i + 1}`); if (seen.has(h)) warnings.push(`duplicate header: ${h || '(empty)'}`); seen.add(h); }); const rows = records.slice(1).map(splitCsvLine); if (rows.some(row => row.length !== headers.length)) warnings.push('row width does not match header count'); return { headers, rows, warnings }; }

const aliases: Record<string, string[]> = { customer_name: ['name', '氏名', '顧客名', 'customer name', 'full_name', 'cust_name'], email: ['email', 'メール', 'メールアドレス', 'mail'], signup_date: ['date', '登録日', 'created_at', 'signup date'], age: ['age', '年齢'], notes: ['notes', '備考', 'メモ', '社内メモ'] };
function normalized(value: string): string { return value.toLowerCase().replace(/[\s_\-]/g, ''); }
export function inferMappings(headers: string[], schema = targetSchema): MappingRow[] { const assignments = new Map<string, number>(); return headers.map(source => { const norm = normalized(source); const candidates = schema.map(target => { const names = [target.id, target.label, ...(aliases[target.id] ?? [])].map(normalized); const exact = names.includes(norm); const partial = names.some(name => name && (norm.includes(name) || name.includes(norm))); const score = exact ? 1 : partial ? .72 : 0; return { source, target: target.id, score, reason: exact ? 'header alias exact match' : partial ? 'header similarity; review recommended' : 'no compatible header signal' }; }).filter(x => x.score > 0).sort((a, b) => b.score - a.score); const best = candidates[0]; if (!best) return { source, status: 'unmatched', candidates: [], reason: 'no candidate target' }; if (assignments.has(best.target)) return { source, status: 'needs-review', candidates, reason: `target ${best.target} is already assigned` }; assignments.set(best.target, 1); return { source, target: best.target, status: best.score === 1 ? 'matched' : 'needs-review', candidates, reason: best.reason }; }); }
export function typeCompatible(value: string, type: TargetType): boolean { if (!value.trim()) return true; if (type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); if (type === 'integer') return /^-?\d+$/.test(value.trim()); if (type === 'date') return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(value.trim()); return true; }
export function validateMappings(parsed: ParsedCsv, rows: MappingRow[], schema = targetSchema): string[] { const errors = [...parsed.warnings]; const assigned = new Set<string>(); rows.forEach(row => { if (!row.target) return; if (assigned.has(row.target)) errors.push(`duplicate target assignment: ${row.target}`); assigned.add(row.target); const target = schema.find(x => x.id === row.target); if (target && parsed.rows.some(values => !typeCompatible(values[parsed.headers.indexOf(row.source)] ?? '', target.type))) errors.push(`type compatibility failed: ${row.source} → ${row.target}`); }); schema.filter(x => x.required).forEach(target => { if (!assigned.has(target.id)) errors.push(`required target is unmapped: ${target.id}`); }); return [...new Set(errors)]; }
export function buildConfig(rows: MappingRow[], excludedColumns: string[] = []): MappingConfig { return { inputVersion: COLUMN_MAPPING_INPUT_VERSION, schemaVersion: COLUMN_MAPPING_SCHEMA_VERSION, mappings: Object.fromEntries(rows.filter(row => row.target && row.status !== 'unmatched' && !excludedColumns.includes(row.source)).map(row => [row.source, row.target!])), excludedColumns, generatedAt: 'replay-fixed-2026-09-20', safety: ['original values are preserved', 'no transform code is executed', 'external uploads are disabled'] }; }

type EvaluationFixtureCase = { id: string; category: string; csv: string; expected: EvaluationOutcome };
const fixtureGroups: Array<{ category: string; expected: EvaluationOutcome; headers: string; row: string }> = [
  { category: 'english aliases', expected: 'matched', headers: 'name,email,created_at', row: 'User,email@example.com,2026-09-01' },
  { category: 'Japanese aliases', expected: 'matched', headers: '氏名,メール,登録日', row: '利用者,user@example.com,2026-09-02' },
  { category: 'abbreviations', expected: 'needs-review', headers: 'cust_name,mail,signup', row: '利用者,user@example.com,2026-09-03' },
  { category: 'ambiguous headers', expected: 'needs-review', headers: 'name,contact,date', row: '利用者,080-1234-5678,2026/09/04' },
  { category: 'unmatched headers', expected: 'unmatched', headers: 'foo,bar,baz', row: 'x,y,z' },
  { category: 'duplicate headers', expected: 'needs-review', headers: 'name,email,email,created_at', row: '利用者,user@example.com,other@example.com,2026-09-05' },
];
export const evaluationFixture: EvaluationFixtureCase[] = Array.from({ length: 50 }, (_, i) => { const group = fixtureGroups[i % fixtureGroups.length]; return { id: `CM-${String(i + 1).padStart(3, '0')}`, category: group.category, csv: `${group.headers}\n${group.row.replace('利用者', `User ${i + 1}`)}`, expected: group.expected }; });
export function evaluateFixtureCase(item: EvaluationFixtureCase): { actual: EvaluationOutcome; passed: boolean } { const parsed = parseCsv(item.csv); const rows = inferMappings(parsed.headers); const hasMatched = rows.some(row => row.status === 'matched'); const hasReview = rows.some(row => row.status === 'needs-review') || validateMappings(parsed, rows).length > 0; const actual: EvaluationOutcome = hasReview ? (hasMatched ? 'needs-review' : 'unmatched') : hasMatched ? 'matched' : 'unmatched'; return { actual, passed: actual === item.expected }; }
