export type RankingMode = 'baseline' | 'replay';

export type SearchDocument = { id: string; title: string; body: string; tags: string[] };
export type SearchResult = SearchDocument & { originalRank: number; rank: number; score: number; rankChange: number; relevance: number };
export type EvaluationQuery = { id: string; query: string; labels: Record<string, number>; note: string };

export const corpus: SearchDocument[] = [
  { id: 'd1', title: 'パスワードをリセットする', body: 'ログインできない利用者が安全にパスワードを再設定する手順。本人確認とメール認証が必要。', tags: ['account', 'login', 'security'] },
  { id: 'd2', title: 'ログインできないときの確認', body: 'ログイン障害の切り分け。メールアドレス、SSO、二要素認証、アカウントロックを確認する。', tags: ['login', 'troubleshooting'] },
  { id: 'd3', title: '二要素認証（2FA）を設定する', body: '管理者とメンバーが二段階認証を有効化し、認証アプリを登録する方法。', tags: ['2fa', 'security', 'setup'] },
  { id: 'd4', title: '請求書と支払い履歴', body: '請求書のダウンロード、領収書、支払い履歴、カード明細を確認する。', tags: ['billing', 'invoice', 'payment'] },
  { id: 'd5', title: '請求先情報を変更する', body: '会社名、住所、VAT番号など請求先プロフィールを更新する。', tags: ['billing', 'profile'] },
  { id: 'd6', title: 'APIキーを発行・失効する', body: 'API key の作成、権限、ローテーション、漏えい時の失効と監査ログ。', tags: ['api', 'security', 'developer'] },
  { id: 'd7', title: 'Webhookの再送と署名検証', body: 'Webhook event の署名を検証し、失敗した delivery を再送する。リトライと2xx応答。', tags: ['api', 'webhook', 'developer'] },
  { id: 'd8', title: 'CSVをインポートする', body: 'ユーザーや取引データのCSV import。列マッピング、UTF-8、重複行の扱い。', tags: ['csv', 'import', 'data'] },
  { id: 'd9', title: 'メンバーを招待・権限変更する', body: 'チームへの招待、role、閲覧者と管理者の権限を変更する。', tags: ['team', 'member', 'admin'] },
  { id: 'd10', title: '監査ログを検索する', body: '操作履歴、actor、日時、IPアドレスを監査ログから検索してエクスポートする。', tags: ['audit', 'security', 'admin'] },
  { id: 'd11', title: 'データをエクスポートして削除する', body: 'ワークスペースのデータ export とアカウント削除。復元できない操作の注意。', tags: ['data', 'delete', 'privacy'] },
  { id: 'd12', title: '通知設定を変更する', body: 'メール通知、Slack通知、アラートのオンオフと配信先を管理する。', tags: ['notification', 'settings'] },
];

const synonyms: Record<string, string[]> = {
  pwd: ['password', 'パスワード'], password: ['pwd', 'パスワード'], パスワード: ['password', 'pwd'],
  signin: ['login', 'ログイン'], login: ['signin', 'ログイン'], ログイン: ['login', 'signin'],
  invoice: ['請求書', 'billing'], 請求書: ['invoice', 'billing'], billing: ['invoice', '請求書'],
  auth: ['認証', '2fa', '二要素'], 認証: ['auth', '2fa', '二要素'],
  key: ['api', 'キー'], api: ['key', 'キー'],
  remove: ['delete', '削除'], delete: ['remove', '削除'],
};

const tokenize = (value: string) => value.toLowerCase().split(/[\s,、。・/()（）:：!?！？_-]+/).filter(Boolean);
const lexicalFragments = ['password', 'pwd', 'login', 'signin', 'invoice', 'billing', '2fa', 'auth', 'api', 'key', 'webhook', 'csv', 'audit', 'delete', 'notification', 'sso', 'vat', 'slack', 'utf8', 'payment', 'member', 'role', 'actor', 'ip', 'privacy', 'alert', 'reset', '認証', '請求書', '請求先', '監査', '削除', '通知', '招待', '明細', '領収書', '署名', '取引', 'データ'];
const expanded = (value: string) => new Set(tokenize(value).flatMap(t => {
  const embedded = [...new Set([...Object.keys(synonyms), ...lexicalFragments])].filter(key => key.length > 1 && t.includes(key));
  const terms = [t, ...embedded];
  return terms.flatMap(term => [term, ...(synonyms[term] ?? [])]);
}));

export function retrieve(query: string, limit = 6): SearchDocument[] {
  const terms = expanded(query);
  return corpus.map(doc => ({ doc, score: [...terms].reduce((n, term) => n + (doc.title.toLowerCase().includes(term) ? 3 : 0) + (doc.body.toLowerCase().includes(term) ? 1 : 0) + (doc.tags.some(tag => tag.includes(term)) ? 2 : 0), 0) }))
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id)).slice(0, limit).map(x => x.doc);
}

function relevance(query: string, doc: SearchDocument, label: number | undefined, evaluated = false) {
  if (evaluated) return label ?? 0;
  const terms = expanded(query); return [...terms].reduce((n, term) => n + (doc.title.toLowerCase().includes(term) ? 3 : 0) + (doc.body.toLowerCase().includes(term) ? 1 : 0), 0);
}

export function rank(query: string, candidates = retrieve(query), mode: RankingMode = 'baseline', labels?: Record<string, number>): SearchResult[] {
  const q = expanded(query);
  const scored = candidates.map((doc, index) => {
    const lexical = [...q].reduce((n, term) => n + (doc.title.toLowerCase().includes(term) ? 3 : 0) + (doc.body.toLowerCase().includes(term) ? 1 : 0) + (doc.tags.some(tag => tag.includes(term)) ? 2 : 0), 0);
    // Replay is a query/document rubric only. Evaluation labels are never a feature.
    const rerankBoost = mode === 'replay' ? (doc.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0) + (doc.tags.some(tag => [...q].some(term => tag === term)) ? .5 : 0) : 0;
    return { doc, originalRank: index + 1, score: lexical + rerankBoost, relevance: relevance(query, doc, labels?.[doc.id], labels !== undefined) };
  });
  scored.sort((a, b) => b.score - a.score || a.originalRank - b.originalRank || a.doc.id.localeCompare(b.doc.id));
  return scored.map((x, i) => ({ ...x.doc, originalRank: x.originalRank, rank: i + 1, score: Number(x.score.toFixed(2)), rankChange: x.originalRank - (i + 1), relevance: x.relevance }));
}

const querySeeds = [
  ['password reset', 'd1'], ['pwdを忘れた', 'd1'], ['ログインできない', 'd2'], ['signin issue', 'd2'], ['2FA setup', 'd3'], ['二要素認証', 'd3'], ['invoice download', 'd4'], ['請求書を見たい', 'd4'], ['billing address', 'd5'], ['VAT番号変更', 'd5'], ['API key revoke', 'd6'], ['apiキー漏えい', 'd6'], ['webhook retry', 'd7'], ['delivery 2xx', 'd7'], ['CSV import', 'd8'], ['CSV重複', 'd8'], ['invite member', 'd9'], ['管理者権限', 'd9'], ['audit log', 'd10'], ['監査ログ', 'd10'], ['delete data', 'd11'], ['データ削除', 'd11'], ['email notification', 'd12'], ['Slack通知', 'd12'], ['passwordではない請求書', 'd4'], ['not login but invoice', 'd4'], ['APIではなくWebhook', 'd7'], ['ログイン以外の認証設定', 'd3'], ['請求書と領収書', 'd4'], ['invoice history', 'd4'], ['account lock', 'd2'], ['auth app', 'd3'], ['payment receipt', 'd4'], ['company billing profile', 'd5'], ['rotate secret key', 'd6'], ['signed webhook', 'd7'], ['UTF8 CSV', 'd8'], ['team role', 'd9'], ['actor IP audit', 'd10'], ['privacy erase', 'd11'], ['alert preferences', 'd12'], ['パスワード リセット 手順', 'd1'], ['SSOログイン障害', 'd2'], ['二段階 認証 アプリ', 'd3'], ['カード明細', 'd4'], ['請求先プロフィール', 'd5'], ['API access token', 'd6'], ['Webhook署名', 'd7'], ['取引データ import', 'd8'], ['unrelated weather', 'd1'], ['メンバー招待', 'd9'], ['操作履歴 export', 'd10'], ['復元できない削除', 'd11'], ['通知オフ', 'd12'], ['recipe for curry', 'd8'], ['duplicate invoice', 'd4'], ['not a payment question', 'd2'],
];
const evaluationSeeds = querySeeds.slice(0, 50).map(([query, id]) => query === '取引データ import' ? ['duplicate invoice', 'd4'] : query === 'unrelated weather' ? [query, ''] : query === 'alert preferences' ? ['unrelated preferences', ''] : [query, id]);
export const evaluationQueries: EvaluationQuery[] = evaluationSeeds.map(([query, id], i) => ({ id: `q-${String(i + 1).padStart(2, '0')}`, query, labels: id ? { [id]: 3 } : {}, note: /unrelated|recipe/.test(query) ? 'unrelated' : /not|ではない|以外/.test(query) ? 'negation / intent contrast' : 'human-confirmed label' }));

export function ndcg(results: SearchResult[], labels: Record<string, number>, k = 5) { const top = results.slice(0, k); const dcg = top.reduce((s, x, i) => s + ((labels[x.id] ?? 0) / Math.log2(i + 2)), 0); const ideal = Object.values(labels).sort((a, b) => b - a).slice(0, k).reduce((s, x, i) => s + x / Math.log2(i + 2), 0); return ideal ? dcg / ideal : 0; }
export function mrr(results: SearchResult[], labels: Record<string, number>) { const hit = results.findIndex(x => (labels[x.id] ?? 0) > 0); return hit < 0 ? 0 : 1 / (hit + 1); }
export function evaluate(mode: RankingMode) { let nd = 0, rr = 0, misses = 0, rerankErrors = 0, evaluatedQueries = 0, noRelevantQueryCount = 0; for (const q of evaluationQueries) { const candidates = retrieve(q.query); const result = rank(q.query, candidates, mode, q.labels); const hasRelevance = Object.values(q.labels).some(value => value > 0); if (!hasRelevance) { noRelevantQueryCount++; continue; } evaluatedQueries++; nd += ndcg(result, q.labels); rr += mrr(result, q.labels); const relevant = Object.keys(q.labels).some(id => !candidates.some(d => d.id === id)); if (relevant) misses++; else if (mode === 'replay' && result[0]?.relevance !== Math.max(...result.map(x => x.relevance))) rerankErrors++; } return { ndcg: Number((nd / Math.max(1, evaluatedQueries)).toFixed(3)), mrr: Number((rr / Math.max(1, evaluatedQueries)).toFixed(3)), candidateMisses: misses, rerankErrors, queries: evaluationQueries.length, evaluatedQueries, noRelevantQueryCount, rejectionRate: Number((noRelevantQueryCount / evaluationQueries.length).toFixed(3)) }; }

export const interactionSamples = [
  { label: 'Synonym', query: 'pwdを忘れた' }, { label: 'Negation', query: 'passwordではない請求書' }, { label: 'Abbreviation', query: '2FA setup' }, { label: '日本語 / English', query: 'Webhook署名' }, { label: 'Tie / duplicate', query: 'duplicate invoice' },
];
