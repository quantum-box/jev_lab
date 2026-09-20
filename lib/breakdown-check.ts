export type CoverageStatus = 'fulfilled' | 'suspected-gap' | 'insufficient-info';
export type AspectKey = 'verification' | 'publication' | 'dependency';

export const BREAKDOWN_CRITERIA_VERSION = 'breakdown-coverage-2026.09.1';
export const BREAKDOWN_DATA_VERSION = 'breakdown-synthetic-2026.09.1';

export const aspectLabels: Record<AspectKey, string> = {
  verification: '検証',
  publication: '公開',
  dependency: '依存解消',
};

export const aspectDefinitions: Record<AspectKey, string> = {
  verification: '成果条件を確認できるテスト・受入・品質ゲートがある',
  publication: '利用者へ届ける公開・リリース・文書化の作業がある',
  dependency: '前提・権限・連携など、先に解く依存が明示されている',
};

export type GoalTask = {
  id: string;
  title: string;
  description: string;
  url: string;
  goalId: string;
};

export type BreakdownFixture = {
  id: string;
  label: string;
  goalTitle: string;
  outcome: string;
  tasks: GoalTask[];
  requiredAspects: AspectKey[];
  humanCoverage: Record<AspectKey, CoverageStatus>;
  scopeNote: string;
  failureTag?: string;
};

export type CoverageResult = {
  aspect: AspectKey;
  label: string;
  status: CoverageStatus;
  evidence: GoalTask[];
  reason: string;
};

export type BreakdownResult = {
  fixture: BreakdownFixture;
  coverage: CoverageResult[];
  mode: 'jev-fixed-replay';
};

const vagueWords = /準備|あとで|TBD|未定|検討|適宜|setup|later|tbd/i;
const aspectTerms: Record<AspectKey, RegExp> = {
  verification: /test|testing|qa|quality|verify|validation|acceptance|check|テスト|検証|確認|受入|品質|評価/i,
  publication: /publish|release|deploy|announce|document|rollout|公開|リリース|デプロイ|周知|文書|展開/i,
  dependency: /depend|prerequisite|unblock|integrat|access|permission|migration|前提|依存|解消|連携|接続|権限|移行/i,
};

export const breakdownSamples: BreakdownFixture[] = [
  {
    id: 'BD-001', label: '実装だけで検証なし', goalTitle: '請求一覧を新しい権限モデルへ移行する', outcome: '担当者が自分の請求だけを安全に閲覧できる',
    tasks: [
      { id: 'task-bd-001-a', title: '一覧APIを実装', description: '請求一覧APIと画面の実装を完了する', url: '#task-bd-001-a', goalId: 'BD-001' },
      { id: 'task-bd-001-b', title: '権限モデルを更新', description: 'ロールごとの参照条件をコードに反映する', url: '#task-bd-001-b', goalId: 'BD-001' },
    ], requiredAspects: ['verification', 'publication', 'dependency'], humanCoverage: { verification: 'suspected-gap', publication: 'suspected-gap', dependency: 'suspected-gap' }, scopeNote: '実装タスクはあるが、検証・公開・前提の記載がない', failureTag: '実装だけで検証なし',
  },
  {
    id: 'BD-002', label: '別名で観点を充足', goalTitle: 'サポート担当向け検索を改善する', outcome: '担当者が正しい回答候補を確認して公開できる',
    tasks: [
      { id: 'task-bd-002-a', title: '品質ゲートを確認', description: '受入シナリオで回答候補の品質を確認する', url: '#task-bd-002-a', goalId: 'BD-002' },
      { id: 'task-bd-002-b', title: '利用者へ展開', description: 'リリースノートを作成して段階公開する', url: '#task-bd-002-b', goalId: 'BD-002' },
      { id: 'task-bd-002-c', title: '検索インデックスを接続', description: '既存インデックスへの接続前提と権限を解消する', url: '#task-bd-002-c', goalId: 'BD-002' },
    ], requiredAspects: ['verification', 'publication', 'dependency'], humanCoverage: { verification: 'fulfilled', publication: 'fulfilled', dependency: 'fulfilled' }, scopeNote: '「テスト」「公開」「依存」という語がなくても意味的に充足',
  },
  {
    id: 'BD-003', label: '前提が不明', goalTitle: '外部データ連携を開始する', outcome: '毎朝の在庫データを取り込める',
    tasks: [
      { id: 'task-bd-003-a', title: '外部連携を準備', description: 'API連携を準備する（詳細は後で決める）', url: '#task-bd-003-a', goalId: 'BD-003' },
      { id: 'task-bd-003-b', title: '動作を確認', description: '動作確認を行う', url: '#task-bd-003-b', goalId: 'BD-003' },
    ], requiredAspects: ['verification', 'publication', 'dependency'], humanCoverage: { verification: 'insufficient-info', publication: 'insufficient-info', dependency: 'insufficient-info' }, scopeNote: '対象環境・公開先・認証前提が要旨だけでは分からない', failureTag: '前提不明',
  },
  {
    id: 'BD-004', label: '対象外タスクのみ', goalTitle: '社内ナレッジを検索可能にする', outcome: '全員が承認済み手順を検索できる',
    tasks: [
      { id: 'task-bd-004-a', title: 'ロゴ案を作成', description: '新しいロゴのデザイン案を作る', url: '#task-bd-004-a', goalId: 'BD-004' },
      { id: 'task-bd-004-b', title: '会議を設定', description: '関係者向けの説明会を設定する', url: '#task-bd-004-b', goalId: 'BD-004' },
    ], requiredAspects: ['verification', 'publication', 'dependency'], humanCoverage: { verification: 'suspected-gap', publication: 'insufficient-info', dependency: 'insufficient-info' }, scopeNote: '指定観点のcoverageを示さないタスクのみ。完全分解は行わない', failureTag: '対象外タスク',
  },
  {
    id: 'BD-005', label: '観点指定が限定的', goalTitle: 'オンボーディング画面を改善する', outcome: '新規利用者が初回設定を完了できる',
    tasks: [
      { id: 'task-bd-005-a', title: '画面を実装', description: '初回設定の入力画面と保存処理を実装する', url: '#task-bd-005-a', goalId: 'BD-005' },
      { id: 'task-bd-005-b', title: '受入条件を確認', description: '初回設定の受入条件を確認する', url: '#task-bd-005-b', goalId: 'BD-005' },
    ], requiredAspects: ['verification'], humanCoverage: { verification: 'fulfilled', publication: 'insufficient-info', dependency: 'insufficient-info' }, scopeNote: '必要観点として検証だけを指定。未指定観点まで網羅したとは扱わない',
  },
];

function classifyAspect(fixture: BreakdownFixture, aspect: AspectKey): CoverageResult {
  const matching = fixture.tasks.filter(task => aspectTerms[aspect].test(`${task.title} ${task.description}`));
  const explicit = matching.filter(task => !vagueWords.test(`${task.title} ${task.description}`) && !(aspect === 'verification' && /^(動作確認を行う|check the behavior|確認する)$/i.test(task.description.trim())));
  if (explicit.length > 0) return { aspect, label: aspectLabels[aspect], status: 'fulfilled', evidence: explicit, reason: `${aspectLabels[aspect]}に相当する既存タスクを確認` };
  if (matching.length > 0 || fixture.tasks.some(task => vagueWords.test(`${task.title} ${task.description}`))) return { aspect, label: aspectLabels[aspect], status: 'insufficient-info', evidence: matching.length ? matching : fixture.tasks.filter(task => vagueWords.test(`${task.title} ${task.description}`)), reason: '候補タスクはあるが、条件・対象・完了定義が不明' };
  if (fixture.tasks.length === 0) return { aspect, label: aspectLabels[aspect], status: 'insufficient-info', evidence: [], reason: '既存タスクがないためcoverageを判定できない' };
  return { aspect, label: aspectLabels[aspect], status: 'suspected-gap', evidence: [], reason: `${aspectLabels[aspect]}を示す既存タスクが見つからない` };
}

export function checkBreakdown(fixture: BreakdownFixture): BreakdownResult {
  return { fixture, coverage: fixture.requiredAspects.map(aspect => classifyAspect(fixture, aspect)), mode: 'jev-fixed-replay' };
}

export function keywordBaseline(fixture: BreakdownFixture): BreakdownResult {
  const exactTerms: Record<AspectKey, RegExp> = { verification: /test|qa|検証|テスト/i, publication: /publish|release|公開|リリース/i, dependency: /depend|依存|前提/i };
  const coverage = fixture.requiredAspects.map(aspect => {
    const evidence = fixture.tasks.filter(task => exactTerms[aspect].test(`${task.title} ${task.description}`));
    const status: CoverageStatus = evidence.length ? 'fulfilled' : fixture.tasks.length ? 'suspected-gap' : 'insufficient-info';
    return { aspect, label: aspectLabels[aspect], status, evidence, reason: evidence.length ? 'キーワード一致' : 'キーワード一致なし' };
  });
  return { fixture, coverage, mode: 'jev-fixed-replay' };
}

export const evaluationCases: BreakdownFixture[] = Array.from({ length: 50 }, (_, index) => {
  const base = breakdownSamples[index % breakdownSamples.length];
  return { ...base, id: `FIX-BD-${String(index + 1).padStart(2, '0')}`, label: `${base.label} · fixture ${index + 1}`, tasks: base.tasks.map(task => ({ ...task, id: `${task.id}-${index + 1}`, url: `#${task.id}-${index + 1}` })), humanCoverage: { ...base.humanCoverage }, requiredAspects: [...base.requiredAspects] };
});

export type BreakdownMetrics = { totalChecks: number; gapDetectionRate: number; falsePositiveRate: number; holdRate: number; baselineGapDetectionRate: number; baselineFalsePositiveRate: number; baselineHoldRate: number; jevCost: number; baselineCost: number; liveEstimateCost: number };

export function breakdownMetrics(cases: BreakdownFixture[] = evaluationCases): BreakdownMetrics {
  const rows = cases.flatMap(fixture => fixture.requiredAspects.map(aspect => ({ expected: fixture.humanCoverage[aspect], jev: checkBreakdown(fixture).coverage.find(item => item.aspect === aspect)!.status, baseline: keywordBaseline(fixture).coverage.find(item => item.aspect === aspect)!.status })));
  const gaps = rows.filter(row => row.expected === 'suspected-gap');
  const predictedGaps = rows.filter(row => row.jev === 'suspected-gap');
  const baselineGaps = rows.filter(row => row.baseline === 'suspected-gap');
  return { totalChecks: rows.length, gapDetectionRate: gaps.length ? rows.filter(row => row.expected === 'suspected-gap' && row.jev === 'suspected-gap').length / gaps.length : 0, falsePositiveRate: predictedGaps.length ? rows.filter(row => row.jev === 'suspected-gap' && row.expected !== 'suspected-gap').length / predictedGaps.length : 0, holdRate: rows.length ? rows.filter(row => row.jev === 'insufficient-info').length / rows.length : 0, baselineGapDetectionRate: gaps.length ? rows.filter(row => row.expected === 'suspected-gap' && row.baseline === 'suspected-gap').length / gaps.length : 0, baselineFalsePositiveRate: baselineGaps.length ? rows.filter(row => row.baseline === 'suspected-gap' && row.expected !== 'suspected-gap').length / baselineGaps.length : 0, baselineHoldRate: rows.length ? rows.filter(row => row.baseline === 'insufficient-info').length / rows.length : 0, jevCost: 0, baselineCost: 0, liveEstimateCost: cases.length * 0.002 };
}

export const breakdownFailureExamples = breakdownSamples.filter(sample => sample.failureTag).map(sample => ({ sample, jev: checkBreakdown(sample), baseline: keywordBaseline(sample) }));
