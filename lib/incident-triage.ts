export type IncidentCategory = 'auth' | 'network' | 'data' | 'availability' | 'security' | 'unknown';
export type IncidentLog = { id: string; service: string; message: string; workspaceId?: string };
export type Runbook = { id: string; title: string; category: IncidentCategory; steps: string[] };
export type TriageResult = { category: IncidentCategory; severity: 'low' | 'medium' | 'high' | 'unknown'; maskedMessage: string; similar: string[]; runbooks: Runbook[]; needsInfo: boolean; reason: string; fixedResponse: string };
export const INCIDENT_TRIAGE_VERSION = 'incident-triage-2026.09.1';
export const runbooks: Runbook[] = [
  { id: 'RB-AUTH-01', title: '認証トークン失効の確認', category: 'auth', steps: ['失敗率を確認', 'トークン期限を確認'] },
  { id: 'RB-NET-01', title: 'ネットワーク接続の確認', category: 'network', steps: ['疎通を確認', '依存先の状態を確認'] },
  { id: 'RB-DATA-01', title: 'データ不整合の隔離', category: 'data', steps: ['影響範囲を固定', '書き込みを止めて確認'] },
  { id: 'RB-AVAIL-01', title: '可用性インシデントの初動', category: 'availability', steps: ['エラー率を確認', 'ロールバック候補を確認'] },
  { id: 'RB-SEC-01', title: 'セキュリティ事象の封じ込め', category: 'security', steps: ['アクセスを隔離', '秘密をローテーション'] },
];
const categoryWords: Record<IncidentCategory, string[]> = { auth: ['401', '403', 'token', '認証', 'ログイン'], network: ['timeout', 'dns', '接続', 'network', '502'], data: ['schema', '不整合', 'database', 'データ'], availability: ['down', '503', '停止', 'latency', '可用性'], security: ['侵入', '漏洩', '攻撃', 'secret', '不正アクセス'], unknown: [] };
export function maskSecrets(message: string) { return message.replace(/(Bearer\s+|api[_-]?key\s*[=:]\s*|password\s*[=:]\s*)([^\s,;]+)/gi, '$1[REDACTED]').replace(/sk-[A-Za-z0-9_-]+/g, 'sk-[REDACTED]'); }
function classify(message: string): IncidentCategory { const lower = message.toLocaleLowerCase('ja-JP'); const scored = (Object.keys(categoryWords) as IncidentCategory[]).filter(category => category !== 'unknown').map(category => ({ category, score: categoryWords[category].filter(word => lower.includes(word.toLocaleLowerCase('ja-JP'))).length })).sort((a, b) => b.score - a.score); return scored[0]?.score ? scored[0].category : 'unknown'; }
export const syntheticSimilar: IncidentLog[] = [
  { id: 'INC-101', service: 'api', message: '401 token expired after deployment' },
  { id: 'INC-102', service: 'edge', message: 'DNS timeout from edge to origin' },
  { id: 'INC-103', service: 'db', message: 'schema mismatch caused write failures' },
  { id: 'INC-104', service: 'web', message: '503 service unavailable and high latency' },
  { id: 'INC-105', service: 'auth', message: 'secret exposed in access log' },
];
export function triageIncident(log: IncidentLog): TriageResult { const maskedMessage = maskSecrets(log.message); const category = classify(maskedMessage); const needsInfo = maskedMessage.trim().length < 12 || /情報不足|unknown|不明/i.test(maskedMessage); const severity = category === 'security' ? 'high' : category === 'unknown' || needsInfo ? 'unknown' : category === 'availability' || category === 'data' ? 'high' : 'medium'; const similar = syntheticSimilar.filter(item => classify(item.message) === category).map(item => item.id).slice(0, 3); const selected = runbooks.filter(runbook => runbook.category === category); const finalCategory = needsInfo ? 'unknown' : category; const finalRunbooks = finalCategory === 'unknown' ? [] : selected; return { category: finalCategory, severity, maskedMessage, similar, runbooks: finalRunbooks, needsInfo, reason: needsInfo ? 'ログが短い/未知語で不足しています。推測せず保留。' : `キーワードと類似事例から ${category} に分類。runbookは候補提示のみ。`, fixedResponse: `category=${finalCategory}; runbook=${finalRunbooks[0]?.id ?? 'unknown'}; execute=false` }; }
export type IncidentCase = { id: string; category: 'auth' | 'network' | 'data' | 'availability' | 'security' | 'unknown'; log: IncidentLog; expected: IncidentCategory; expectedRunbook?: string };
export const incidentCases: IncidentCase[] = [
  { id: 'incident-01', category: 'auth', log: { id: 'I-1', service: 'api', message: '401 token expired after deploy' }, expected: 'auth', expectedRunbook: 'RB-AUTH-01' },
  { id: 'incident-02', category: 'network', log: { id: 'I-2', service: 'edge', message: 'DNS timeout to origin' }, expected: 'network', expectedRunbook: 'RB-NET-01' },
  { id: 'incident-03', category: 'data', log: { id: 'I-3', service: 'db', message: 'schema mismatch and database inconsistency' }, expected: 'data', expectedRunbook: 'RB-DATA-01' },
  { id: 'incident-04', category: 'availability', log: { id: 'I-4', service: 'web', message: '503 service down with latency' }, expected: 'availability', expectedRunbook: 'RB-AVAIL-01' },
  { id: 'incident-05', category: 'security', log: { id: 'I-5', service: 'auth', message: 'secret=sk-abc123 leaked by suspicious access' }, expected: 'security', expectedRunbook: 'RB-SEC-01' },
  { id: 'incident-06', category: 'unknown', log: { id: 'I-6', service: 'unknown', message: '情報不足' }, expected: 'unknown' },
];
export const incidentEvaluationCases: IncidentCase[] = Array.from({ length: 50 }, (_, index) => { const base = incidentCases[index % incidentCases.length]; return { ...base, id: `incident-${String(index + 1).padStart(2, '0')}`, log: { ...base.log, id: `I-${index + 1}` } }; });
export type IncidentMetrics = { accuracy: number; topRunbookFit: number; dangerousMisrouteRate: number; cost: number };
export function incidentMetrics(cases: IncidentCase[], triager = triageIncident): IncidentMetrics { const rows = cases.map(item => ({ item, result: triager(item.log) })); return { accuracy: rows.filter(row => row.result.category === row.item.expected).length / cases.length, topRunbookFit: rows.filter(row => !row.item.expectedRunbook || row.result.runbooks[0]?.id === row.item.expectedRunbook).length / cases.length, dangerousMisrouteRate: rows.filter(row => row.item.expected === 'security' && row.result.category !== 'security').length / cases.filter(item => item.expected === 'security').length, cost: cases.length * 0.00025 }; }
export function keywordIncidentBaseline(log: IncidentLog): TriageResult { const result = triageIncident({ ...log, message: maskSecrets(log.message) }); return { ...result, reason: 'keyword baseline', fixedResponse: `baseline=${result.category}` }; }
export const fixedIncidentResponses = incidentCases.map(item => ({ id: item.id, label: item.category, response: triageIncident(item.log).fixedResponse }));
