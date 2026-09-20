/**
 * Living UI is intentionally a closed, replayable display system.
 * The prompt resolver can only choose components from this registry and the
 * records below are immutable synthetic fixtures. Nothing in this module
 * calls a provider or mutates a source record.
 */

export type LivingIntent = 'scan' | 'compare' | 'plan' | 'trend' | 'detail';
export type DisplayComponentId = 'table' | 'comparison' | 'cards' | 'timeline' | 'chart';

export type LivingEvent = {
  id: string;
  label: string;
  date: string;
  tone: 'neutral' | 'positive' | 'warning';
};

export type LivingProgressPoint = {
  date: string;
  value: number;
};

export type LivingRecord = {
  id: string;
  title: string;
  owner: string;
  status: '進行中' | 'レビュー' | '完了' | '保留';
  priority: '高' | '中' | '低';
  due: string;
  progress: number;
  progressHistory: readonly LivingProgressPoint[];
  summary: string;
  tags: readonly string[];
  events: readonly LivingEvent[];
};

export const LIVING_RECORDS: readonly LivingRecord[] = [
  {
    id: 'work-101', title: '新しい料金ページ', owner: 'Mika', status: '進行中', priority: '高', due: '2026-09-22', progress: 72,
    progressHistory: [{date: '09/08', value: 24}, {date: '09/15', value: 46}, {date: '09/20', value: 72}],
    summary: '価格表と FAQ の最終レビューを進めています。', tags: ['web', 'release'],
    events: [
      {id: 'work-101-1', label: '要件を確認', date: '09/16', tone: 'positive'},
      {id: 'work-101-2', label: 'コピーをレビュー', date: '09/19', tone: 'warning'},
      {id: 'work-101-3', label: '公開準備', date: '09/22', tone: 'neutral'},
    ],
  },
  {
    id: 'work-102', title: 'オンボーディング改善', owner: 'Ren', status: 'レビュー', priority: '中', due: '2026-09-25', progress: 48,
    progressHistory: [{date: '09/08', value: 15}, {date: '09/15', value: 33}, {date: '09/20', value: 48}],
    summary: '初回ユーザーの迷いを減らす導線を比較しています。', tags: ['product', 'research'],
    events: [
      {id: 'work-102-1', label: 'インタビューを整理', date: '09/14', tone: 'positive'},
      {id: 'work-102-2', label: '案 A/B を比較', date: '09/20', tone: 'warning'},
      {id: 'work-102-3', label: 'レビュー会', date: '09/25', tone: 'neutral'},
    ],
  },
  {
    id: 'work-103', title: '請求書照合フロー', owner: 'Sora', status: '完了', priority: '低', due: '2026-09-18', progress: 100,
    progressHistory: [{date: '09/08', value: 38}, {date: '09/15', value: 72}, {date: '09/18', value: 100}],
    summary: 'サンプル請求書 30 件で照合ルールを確認しました。', tags: ['ops', 'finance'],
    events: [
      {id: 'work-103-1', label: 'ルールを定義', date: '09/10', tone: 'positive'},
      {id: 'work-103-2', label: 'サンプルを検証', date: '09/16', tone: 'positive'},
      {id: 'work-103-3', label: '完了', date: '09/18', tone: 'positive'},
    ],
  },
  {
    id: 'work-104', title: 'モバイル通知の整理', owner: 'Yui', status: '保留', priority: '高', due: '2026-09-29', progress: 25,
    progressHistory: [{date: '09/08', value: 10}, {date: '09/15', value: 18}, {date: '09/21', value: 25}],
    summary: '通知頻度の仮説はあるものの、計測設計を待っています。', tags: ['mobile', 'analytics'],
    events: [
      {id: 'work-104-1', label: '仮説を作成', date: '09/12', tone: 'positive'},
      {id: 'work-104-2', label: '計測設計を待機', date: '09/21', tone: 'warning'},
      {id: 'work-104-3', label: '再開予定', date: '09/29', tone: 'neutral'},
    ],
  },
  {
    id: 'work-105', title: '検索結果の品質確認', owner: 'Kai', status: '進行中', priority: '中', due: '2026-10-01', progress: 63,
    progressHistory: [{date: '09/08', value: 20}, {date: '09/15', value: 44}, {date: '09/20', value: 63}],
    summary: '検索語ごとの結果品質を週次で追跡しています。', tags: ['search', 'quality'],
    events: [
      {id: 'work-105-1', label: '評価軸を決定', date: '09/13', tone: 'positive'},
      {id: 'work-105-2', label: '週次データを追加', date: '09/20', tone: 'positive'},
      {id: 'work-105-3', label: '次回確認', date: '10/01', tone: 'neutral'},
    ],
  },
  {
    id: 'work-106', title: 'サポート回答テンプレート', owner: 'Aoi', status: 'レビュー', priority: '低', due: '2026-10-03', progress: 36,
    progressHistory: [{date: '09/08', value: 8}, {date: '09/15', value: 21}, {date: '09/22', value: 36}],
    summary: '問い合わせ種別ごとの回答品質を揃えています。', tags: ['support', 'content'],
    events: [
      {id: 'work-106-1', label: '問い合わせを分類', date: '09/15', tone: 'positive'},
      {id: 'work-106-2', label: 'テンプレートを確認', date: '09/22', tone: 'warning'},
      {id: 'work-106-3', label: '公開候補', date: '10/03', tone: 'neutral'},
    ],
  },
] as const;

export type DisplayComponentDefinition = {
  id: DisplayComponentId;
  label: string;
  description: string;
  schemaVersion: 'living-ui-component-v1';
  accepts: readonly string[];
};

export const DISPLAY_COMPONENT_REGISTRY: readonly DisplayComponentDefinition[] = [
  {id: 'table', label: 'Table', description: '複数レコードを行と列で俯瞰', schemaVersion: 'living-ui-component-v1', accepts: ['record[]']},
  {id: 'comparison', label: 'Comparison', description: '2 件の差分と選択理由を比較', schemaVersion: 'living-ui-component-v1', accepts: ['record[2]']},
  {id: 'cards', label: 'Cards', description: '要点と状態をレコード単位で表示', schemaVersion: 'living-ui-component-v1', accepts: ['record[]']},
  {id: 'timeline', label: 'Timeline', description: '期限とイベントの順序を表示', schemaVersion: 'living-ui-component-v1', accepts: ['event[]']},
  {id: 'chart', label: 'Progress trend', description: '時系列の進捗推移を比較できるチャート', schemaVersion: 'living-ui-component-v1', accepts: ['record[]']},
] as const;

const COMPONENT_IDS = new Set<DisplayComponentId>(DISPLAY_COMPONENT_REGISTRY.map((definition) => definition.id));
const INTENTS = new Set<LivingIntent>(['scan', 'compare', 'plan', 'trend', 'detail']);

export type LivingComposition = {
  intent: LivingIntent;
  components: DisplayComponentId[];
  reason: string;
  matchedKeywords: string[];
  sourceRecordIds: string[];
  safeFallback: boolean;
};

export type LivingResolution = {
  prompt: string;
  records: readonly LivingRecord[];
  composition: LivingComposition;
  warning?: string;
};

export type LivingHistoryEntry = {prompt: string; resolution: LivingResolution};

/** Select an older snapshot and discard the entries that were newer than it. */
export function reconcileHistorySelection(history: readonly LivingHistoryEntry[], selectedIndex: number): {current: LivingHistoryEntry; history: LivingHistoryEntry[]} | null {
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= history.length) return null;
  return {current: history[selectedIndex], history: history.slice(0, selectedIndex)};
}

export type OperationSample = {
  id: string;
  label: string;
  prompt: string;
  intent: LivingIntent;
  expectedComponents: readonly DisplayComponentId[];
};

export const LIVING_OPERATION_SAMPLES: readonly OperationSample[] = [
  {id: 'sample-scan', label: '全体を一覧', prompt: '今の仕事を担当者とステータスで一覧にして', intent: 'scan', expectedComponents: ['table']},
  {id: 'sample-compare', label: '優先順位を比較', prompt: '優先度の高い仕事を比較して、どちらを先に見るべき？', intent: 'compare', expectedComponents: ['comparison']},
  {id: 'sample-plan', label: '期限を確認', prompt: '締切までの予定と次のイベントを見せて', intent: 'plan', expectedComponents: ['timeline']},
  {id: 'sample-trend', label: '進捗の推移', prompt: '進捗のトレンドを棒グラフで見たい', intent: 'trend', expectedComponents: ['chart']},
  {id: 'sample-detail', label: '要点を読む', prompt: '各仕事の要点をカードで確認したい', intent: 'detail', expectedComponents: ['cards']},
] as const;

const KEYWORD_RULES: readonly {intent: LivingIntent; terms: readonly string[]; components: readonly DisplayComponentId[]; reason: string}[] = [
  {intent: 'compare', terms: ['比較', '優先', 'どちら', '差分', '選ぶ'], components: ['comparison'], reason: '比較・優先の意図に対して比較コンポーネントを選択'},
  {intent: 'plan', terms: ['予定', '期限', '締切', 'いつ', 'イベント', 'スケジュール'], components: ['timeline'], reason: '期限・順序の意図に対してタイムラインを選択'},
  {intent: 'trend', terms: ['進捗', '推移', 'トレンド', '割合', 'グラフ', 'チャート', '増減'], components: ['chart'], reason: '推移の意図に対して時系列チャートを選択'},
  {intent: 'detail', terms: ['要点', '詳細', 'カード', '概要', '内容'], components: ['cards'], reason: '要点確認の意図に対してカードを選択'},
  {intent: 'scan', terms: ['一覧', 'リスト', '担当', 'ステータス', '全体', 'まとめ'], components: ['table'], reason: '一覧の意図に対してテーブルを選択'},
] as const;

function normalized(prompt: string): string {
  return String(prompt ?? '').trim().toLocaleLowerCase('ja-JP');
}

export function isRegisteredComponent(id: string): id is DisplayComponentId {
  return COMPONENT_IDS.has(id as DisplayComponentId);
}

export function validateComposition(composition: Partial<LivingComposition> | null | undefined): composition is LivingComposition {
  if (!composition || !INTENTS.has(composition.intent as LivingIntent) || !Array.isArray(composition.components) || composition.components.length === 0) return false;
  if (composition.components.some((id) => !isRegisteredComponent(id))) return false;
  if (!Array.isArray(composition.sourceRecordIds) || composition.sourceRecordIds.some((id) => typeof id !== 'string')) return false;
  return typeof composition.reason === 'string' && typeof composition.safeFallback === 'boolean' && Array.isArray(composition.matchedKeywords) && composition.matchedKeywords.every((keyword) => typeof keyword === 'string');
}

function safeComposition(records: readonly LivingRecord[], prompt: string, warning?: string): LivingResolution {
  const sourceRecordIds = records.map((record) => record.id);
  return {
    prompt,
    records,
    warning,
    composition: {
      intent: 'scan', components: ['table'], matchedKeywords: [], sourceRecordIds,
      safeFallback: true,
      reason: warning ?? '安全な既定表示としてテーブルを選択',
    },
  };
}

export function resolveLivingUi(prompt: string, inputRecords: readonly LivingRecord[] | null | undefined = LIVING_RECORDS): LivingResolution {
  const records = Array.isArray(inputRecords) ? inputRecords.filter((record): record is LivingRecord => Boolean(record && typeof record.id === 'string')) : [];
  if (records.length === 0) return safeComposition([], prompt, '表示できる固定レコードがないため、安全な空状態を表示しています。');

  const text = normalized(prompt);
  const rule = KEYWORD_RULES.find((candidate) => candidate.terms.some((term) => text.includes(term)));
  const selected = rule ?? {intent: 'scan' as const, terms: [], components: ['table'] as const, reason: '意図を特定できないため安全な一覧へフォールバック'};
  const composition: LivingComposition = {
    intent: selected.intent,
    components: [...selected.components],
    reason: selected.reason,
    matchedKeywords: rule ? rule.terms.filter((term) => text.includes(term)) : [],
    sourceRecordIds: records.map((record) => record.id),
    safeFallback: !rule,
  };
  if (!validateComposition(composition)) return safeComposition(records, prompt, '構成設定が不正なため、安全な一覧へフォールバックしています。');
  return {prompt, records, composition};
}

type EvaluationSeed = {
  prompt: string;
  expectedIntents: readonly LivingIntent[];
  expectedComponents: readonly DisplayComponentId[];
};

export type LivingEvaluationCase = EvaluationSeed & {id: string};

// Keep the fixture large enough to expose intent/display regressions, but make
// every case a real user request instead of padding the report with repeats.
export const LIVING_EVALUATION_CASES: readonly LivingEvaluationCase[] = [
  {id: 'living-eval-01', prompt: '担当者別に作業を一覧表示', expectedIntents: ['scan'], expectedComponents: ['table']},
  {id: 'living-eval-02', prompt: '進行中の案件をリストで確認', expectedIntents: ['scan'], expectedComponents: ['table']},
  {id: 'living-eval-03', prompt: '全タスクの状態をまとめて', expectedIntents: ['scan'], expectedComponents: ['table']},
  {id: 'living-eval-04', prompt: '部門ごとの仕事を表で見たい', expectedIntents: ['scan'], expectedComponents: ['table']},
  {id: 'living-eval-05', prompt: '未完了項目を一覧化', expectedIntents: ['scan'], expectedComponents: ['table']},
  {id: 'living-eval-06', prompt: 'すべての案件を俯瞰したい', expectedIntents: ['scan'], expectedComponents: ['table']},
  {id: 'living-eval-07', prompt: 'ステータス別に並べる', expectedIntents: ['scan'], expectedComponents: ['table']},
  {id: 'living-eval-08', prompt: '今週の仕事を表形式で整理', expectedIntents: ['scan'], expectedComponents: ['table']},
  {id: 'living-eval-09', prompt: '担当と状態を一望したい', expectedIntents: ['scan'], expectedComponents: ['table']},
  {id: 'living-eval-10', prompt: 'レコード全体をまとめて表示', expectedIntents: ['scan'], expectedComponents: ['table']},
  {id: 'living-eval-11', prompt: '高優先度の案件を比較', expectedIntents: ['compare'], expectedComponents: ['comparison']},
  {id: 'living-eval-12', prompt: 'AとBの差分を見せて', expectedIntents: ['compare'], expectedComponents: ['comparison']},
  {id: 'living-eval-13', prompt: 'どちらの仕事を先に選ぶ？', expectedIntents: ['compare'], expectedComponents: ['comparison']},
  {id: 'living-eval-14', prompt: '二つの候補の差分を確認', expectedIntents: ['compare'], expectedComponents: ['comparison']},
  {id: 'living-eval-15', prompt: '優先順位を決めるため並べて比較', expectedIntents: ['compare'], expectedComponents: ['comparison']},
  {id: 'living-eval-16', prompt: 'レビュー対象を選ぶため比較したい', expectedIntents: ['compare'], expectedComponents: ['comparison']},
  {id: 'living-eval-17', prompt: '先に進める案件をどちらか決めたい', expectedIntents: ['compare'], expectedComponents: ['comparison']},
  {id: 'living-eval-18', prompt: '今月の候補を比較表で見る', expectedIntents: ['compare'], expectedComponents: ['comparison']},
  {id: 'living-eval-19', prompt: '進捗と期限の差分を比べたい', expectedIntents: ['compare'], expectedComponents: ['comparison']},
  {id: 'living-eval-20', prompt: '選ぶべき作業の違いを整理', expectedIntents: ['compare'], expectedComponents: ['comparison']},
  {id: 'living-eval-21', prompt: '今後の締切を時系列で確認', expectedIntents: ['plan'], expectedComponents: ['timeline']},
  {id: 'living-eval-22', prompt: '次のイベント予定を教えて', expectedIntents: ['plan'], expectedComponents: ['timeline']},
  {id: 'living-eval-23', prompt: '期限までの流れをタイムラインで', expectedIntents: ['plan'], expectedComponents: ['timeline']},
  {id: 'living-eval-24', prompt: '公開スケジュールを整理したい', expectedIntents: ['plan'], expectedComponents: ['timeline']},
  {id: 'living-eval-25', prompt: 'いつ何をするか確認', expectedIntents: ['plan'], expectedComponents: ['timeline']},
  {id: 'living-eval-26', prompt: '次回レビューの予定と順序を見せて', expectedIntents: ['plan'], expectedComponents: ['timeline']},
  {id: 'living-eval-27', prompt: '作業の締切とイベントを並べる', expectedIntents: ['plan'], expectedComponents: ['timeline']},
  {id: 'living-eval-28', prompt: '来週までの予定を一覧化', expectedIntents: ['plan'], expectedComponents: ['timeline']},
  {id: 'living-eval-29', prompt: '期限の近い仕事から計画したい', expectedIntents: ['plan'], expectedComponents: ['timeline']},
  {id: 'living-eval-30', prompt: 'マイルストーンのスケジュールを確認', expectedIntents: ['plan'], expectedComponents: ['timeline']},
  {id: 'living-eval-31', prompt: '進捗率の変化をグラフで確認', expectedIntents: ['trend'], expectedComponents: ['chart']},
  {id: 'living-eval-32', prompt: '各案件の進捗をチャートで見たい', expectedIntents: ['trend'], expectedComponents: ['chart']},
  {id: 'living-eval-33', prompt: '完了割合の推移を追跡', expectedIntents: ['trend'], expectedComponents: ['chart']},
  {id: 'living-eval-34', prompt: '仕事の増減を可視化して', expectedIntents: ['trend'], expectedComponents: ['chart']},
  {id: 'living-eval-35', prompt: '週ごとの進捗推移を比べたい', expectedIntents: ['trend'], expectedComponents: ['chart']},
  {id: 'living-eval-36', prompt: 'プロジェクトのトレンドを表示', expectedIntents: ['trend'], expectedComponents: ['chart']},
  {id: 'living-eval-37', prompt: '最近の進捗推移を棒グラフで', expectedIntents: ['trend'], expectedComponents: ['chart']},
  {id: 'living-eval-38', prompt: '完了までの割合を時系列で見る', expectedIntents: ['trend'], expectedComponents: ['chart']},
  {id: 'living-eval-39', prompt: '作業速度の変化をグラフ化', expectedIntents: ['trend'], expectedComponents: ['chart']},
  {id: 'living-eval-40', prompt: '案件ごとの進展をチャートで見る', expectedIntents: ['trend'], expectedComponents: ['chart']},
  {id: 'living-eval-41', prompt: '案件の概要をカードで確認', expectedIntents: ['detail'], expectedComponents: ['cards']},
  {id: 'living-eval-42', prompt: '各タスクの要点を読む', expectedIntents: ['detail'], expectedComponents: ['cards']},
  {id: 'living-eval-43', prompt: '内容を詳しく表示して', expectedIntents: ['detail'], expectedComponents: ['cards']},
  {id: 'living-eval-44', prompt: '仕事ごとのサマリーをカード化', expectedIntents: ['detail'], expectedComponents: ['cards']},
  {id: 'living-eval-45', prompt: 'プロジェクトの詳細を確認', expectedIntents: ['detail'], expectedComponents: ['cards']},
  {id: 'living-eval-46', prompt: 'それぞれの仕事の詳細を見たい', expectedIntents: ['detail'], expectedComponents: ['cards']},
  {id: 'living-eval-47', prompt: '重要なポイントの要点を確認', expectedIntents: ['detail'], expectedComponents: ['cards']},
  {id: 'living-eval-48', prompt: 'レコードの概要をカードで読む', expectedIntents: ['detail'], expectedComponents: ['cards']},
  {id: 'living-eval-49', prompt: '担当案件の詳細情報を表示', expectedIntents: ['detail'], expectedComponents: ['cards']},
  {id: 'living-eval-50', prompt: '作業内容をカード一覧で確認', expectedIntents: ['detail'], expectedComponents: ['cards']},
];

export function evaluateLivingCase(testCase: LivingEvaluationCase): {intentAccepted: boolean; componentAccepted: boolean; resolution: LivingResolution} {
  const resolution = resolveLivingUi(testCase.prompt);
  return {
    intentAccepted: testCase.expectedIntents.includes(resolution.composition.intent),
    componentAccepted: resolution.composition.components.some((component) => testCase.expectedComponents.includes(component)),
    resolution,
  };
}
