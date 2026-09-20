export type Goal = { id: string; title: string; keywords: string[]; workspaceId: string };
export type GoalTask = { id: string; text: string; workspaceId: string; humanCorrection?: { goalId: string; reason: string } };
export type GoalLink = { goalId: string; score: number; source: 'jev'; evidence: string[] };
export type GoalDecision = { status: 'linked' | 'review' | 'unresolved'; links: GoalLink[]; reason: string; fixedResponse: string };
export const GOAL_LINKING_VERSION = 'goal-linking-2026.09.1';
export const defaultGoals: Goal[] = [
  { id: 'G-SEC', title: '安全性を高める', keywords: ['安全', '脆弱性', '監査', 'security'], workspaceId: 'ws-alpha' },
  { id: 'G-GROW', title: '売上を伸ばす', keywords: ['売上', '営業', '顧客', 'growth'], workspaceId: 'ws-alpha' },
  { id: 'G-OPS', title: '運用を効率化する', keywords: ['運用', '自動化', 'コスト', '効率'], workspaceId: 'ws-alpha' },
  { id: 'G-OTHER', title: '別ワークスペースの目標', keywords: ['安全', '売上'], workspaceId: 'ws-other' },
];
const tokens = (text: string) => text.toLocaleLowerCase('ja-JP').split(/[\s、。,.・/]+/).filter(Boolean);
export function linkTask(task: GoalTask, goals = defaultGoals): GoalDecision {
  const scoped = goals.filter(goal => goal.workspaceId === task.workspaceId);
  const taskTokens = tokens(task.text);
  const links = scoped.map(goal => { const evidence = goal.keywords.filter(keyword => task.text.toLocaleLowerCase('ja-JP').includes(keyword.toLocaleLowerCase('ja-JP'))); return { goalId: goal.id, score: evidence.length / Math.max(1, goal.keywords.length), source: 'jev' as const, evidence }; }).filter(link => link.score > 0).sort((a, b) => b.score - a.score);
  if (!links.length) return { status: 'unresolved', links: [], reason: '該当目標がありません。別workspaceの目標や人手修正は混ぜません。', fixedResponse: 'goal=unknown; status=unresolved' };
  if (links.length > 1 && links[0].score === links[1].score) return { status: 'review', links, reason: '複数目標が同率のため、人の確認へ保留。', fixedResponse: `goals=${links.map(link => link.goalId).join(',')}; status=review` };
  return { status: 'linked', links: links.slice(0, 2), reason: `同一workspace内でキーワード根拠が一致: ${links[0].evidence.join(', ')}`, fixedResponse: `goal=${links[0].goalId}; status=linked` };
}
export type GoalCase = { id: string; category: '直接' | '複数' | '該当なし' | '人手修正' | 'workspace隔離'; task: GoalTask; expected: string[] };
export const goalCases: GoalCase[] = [
  { id: 'goal-01', category: '直接', task: { id: 'T-1', text: '脆弱性監査を自動化する', workspaceId: 'ws-alpha' }, expected: ['G-SEC'] },
  { id: 'goal-02', category: '複数', task: { id: 'T-2', text: '安全な運用自動化でコストを下げる', workspaceId: 'ws-alpha' }, expected: ['G-SEC', 'G-OPS'] },
  { id: 'goal-03', category: '該当なし', task: { id: 'T-3', text: 'チームのランチを予約する', workspaceId: 'ws-alpha' }, expected: [] },
  { id: 'goal-04', category: '人手修正', task: { id: 'T-4', text: '売上の営業資料を更新する', workspaceId: 'ws-alpha', humanCorrection: { goalId: 'G-SEC', reason: '人が誤関連を修正した記録（評価から除外）' } }, expected: ['G-GROW'] },
  { id: 'goal-05', category: 'workspace隔離', task: { id: 'T-5', text: '安全の確認をする', workspaceId: 'ws-other' }, expected: ['G-OTHER'] },
];
export const goalEvaluationCases: GoalCase[] = Array.from({ length: 50 }, (_, index) => { const base = goalCases[index % goalCases.length]; return { ...base, id: `goal-${String(index + 1).padStart(2, '0')}`, task: { ...base.task, id: `T-${index + 1}` } }; });
export type GoalMetrics = { recall: number; falseRelatedRate: number; unresolvedRate: number; cost: number };
function scoreMetrics(cases: GoalCase[], linker: (task: GoalTask) => GoalDecision): GoalMetrics { const evaluated = cases.filter(item => !item.task.humanCorrection); let hits = 0; let expected = 0; let falseRelated = 0; for (const item of evaluated) { const actual = linker(item.task).links.map(link => link.goalId); expected += item.expected.length; hits += item.expected.filter(goal => actual.includes(goal)).length; falseRelated += actual.filter(goal => !item.expected.includes(goal)).length; } return { recall: expected ? hits / expected : 0, falseRelatedRate: evaluated.length ? falseRelated / evaluated.length : 0, unresolvedRate: evaluated.length ? evaluated.filter(item => linker(item.task).status === 'unresolved').length / evaluated.length : 0, cost: evaluated.length * 0.00015 }; }
export function keywordBaseline(task: GoalTask): GoalDecision { const links = defaultGoals.filter(goal => goal.workspaceId === task.workspaceId && goal.keywords.some(keyword => task.text.includes(keyword))).map(goal => ({ goalId: goal.id, score: 1, source: 'jev' as const, evidence: goal.keywords.filter(keyword => task.text.includes(keyword)) })); return { status: links.length ? 'linked' : 'unresolved', links, reason: 'keyword baseline', fixedResponse: `baseline=${links.map(link => link.goalId).join(',') || 'unknown'}` }; }
export function goalMetrics(cases = goalEvaluationCases) { return { jev: scoreMetrics(cases, task => linkTask(task)), baseline: scoreMetrics(cases, keywordBaseline) }; }
export const fixedGoalResponses = goalCases.map(item => ({ id: item.id, label: item.category, response: linkTask(item.task).fixedResponse }));
